/**
 * Test cases for V2 cancel-loop features
 * Run: npx tsx tests/v2-features.test.ts
 */

const store: Record<string, string> = {};
const mockLS = {
  getItem: (k: string) => store[k] || null,
  setItem: (k: string, v: string) => { store[k] = v; },
};
(globalThis as any).localStorage = mockLS;

const PENDING_CANCEL_KEY = "oopssubs_pending_cancel";
const CANCELLED_KEY = "oopssubs_cancelled";

interface PendingCancel { subId: string; name: string; timestamp: number; }
function getPendingCancels(): PendingCancel[] {
  try { return JSON.parse(localStorage.getItem(PENDING_CANCEL_KEY) || '[]'); }
  catch { return []; }
}
function savePendingCancel(pc: PendingCancel) {
  const all = getPendingCancels().filter(p => p.subId !== pc.subId);
  all.push(pc);
  localStorage.setItem(PENDING_CANCEL_KEY, JSON.stringify(all));
}
function clearPendingCancel(subId: string) {
  localStorage.setItem(PENDING_CANCEL_KEY, JSON.stringify(getPendingCancels().filter(p => p.subId !== subId)));
}
interface CancelledSub { name: string; amount: number; cycle: string; date: string; }
function getCancelled(): CancelledSub[] {
  try { return JSON.parse(localStorage.getItem(CANCELLED_KEY) || '[]'); }
  catch { return []; }
}
function addCancelled(name: string, amount: number, cycle: string) {
  const all = getCancelled();
  all.push({ name, amount, cycle, date: new Date().toISOString() });
  localStorage.setItem(CANCELLED_KEY, JSON.stringify(all));
}
function lifetimeSavings(): number {
  return getCancelled().reduce((sum, c) => sum + (c.cycle === 'yearly' ? c.amount : c.amount * 12), 0);
}

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e: any) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
}

console.log("\n=== #1 Cancel Confirmation ===\n");

test("save + retrieve pending cancel", () => {
  savePendingCancel({ subId: "a1", name: "Netflix", timestamp: Date.now() });
  const all = getPendingCancels();
  if (all.length !== 1) throw new Error("len != 1");
  if (all[0].name !== "Netflix") throw new Error("wrong name");
});

test("update existing pending (same subId)", () => {
  savePendingCancel({ subId: "a1", name: "Netflix Updated", timestamp: Date.now() });
  if (getPendingCancels().length !== 1) throw new Error("should still be 1");
});

test("clear specific pending", () => {
  savePendingCancel({ subId: "b2", name: "Spotify", timestamp: Date.now() });
  clearPendingCancel("a1");
  const all = getPendingCancels();
  if (all.length !== 1) throw new Error("should have 1 left");
  if (all[0].subId !== "b2") throw new Error("wrong one left");
  clearPendingCancel("b2");
  if (getPendingCancels().length !== 0) throw new Error("should be empty");
});

test(">1 hour old → show follow-up", () => {
  savePendingCancel({ subId: "old", name: "Old", timestamp: Date.now() - 7200000 });
  const should = getPendingCancels().some(p => Date.now() - p.timestamp > 3600000);
  if (!should) throw new Error("should show");
  clearPendingCancel("old");
});

test("<1 hour old → don't show", () => {
  savePendingCancel({ subId: "new", name: "New", timestamp: Date.now() - 600000 });
  const should = getPendingCancels().some(p => Date.now() - p.timestamp > 3600000);
  if (should) throw new Error("should NOT show");
  clearPendingCancel("new");
});

console.log("\n=== #2 Celebration + Savings ===\n");

test("addCancelled increases count", () => {
  const before = getCancelled().length;
  addCancelled("Netflix", 15.99, "monthly");
  if (getCancelled().length !== before + 1) throw new Error("count didn't increase");
});

test("lifetimeSavings monthly × 12", () => {
  addCancelled("Spotify", 9.99, "monthly");
  // Netflix $191.88 + Spotify $119.88 = $311.76
  const s = lifetimeSavings();
  if (Math.abs(s - 311.76) > 0.01) throw new Error(`expected 311.76, got ${s}`);
});

test("lifetimeSavings yearly added directly", () => {
  addCancelled("Prime", 139, "yearly");
  const s = lifetimeSavings();
  if (Math.abs(s - 450.76) > 0.01) throw new Error(`expected 450.76, got ${s}`);
});

test("savings = 0 after clear", () => {
  Object.keys(store).forEach(k => delete store[k]);
  if (lifetimeSavings() !== 0) throw new Error("not zero");
});

console.log("\n=== #3 Weekly Checkup ===\n");

test("first visit → should show", () => {
  if (localStorage.getItem("oopssubs_weekly_check") !== null) throw new Error("should be null");
});

test("< 7 days → should NOT show", () => {
  localStorage.setItem("oopssubs_weekly_check", String(Date.now() - 86400000));
  const lw = localStorage.getItem("oopssubs_weekly_check")!;
  if (!lw || Date.now() - parseInt(lw) > 604800000) throw new Error("should not show");
});

test("> 7 days → should show", () => {
  localStorage.setItem("oopssubs_weekly_check", String(Date.now() - 700000000));
  const lw = localStorage.getItem("oopssubs_weekly_check")!;
  if (!lw || Date.now() - parseInt(lw) <= 604800000) throw new Error("should show");
});

console.log("\n=== #4 Share Card ===\n");

test("share text includes amount + domain", () => {
  addCancelled("Foo", 10, "monthly");
  const s = lifetimeSavings();
  const text = `I found $${s}/yr using OopsSubs. Check → oopssubs.com`;
  if (!text.includes(String(s))) throw new Error("missing amount");
  if (!text.includes("oopssubs.com")) throw new Error("missing domain");
});

test("share text includes service names", () => {
  const names = getCancelled().map(c => c.name).join(", ");
  if (!names.includes("Foo")) throw new Error("missing name");
});

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
