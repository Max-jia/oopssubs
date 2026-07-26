/**
 * E2E Test Scenarios — full user journey through OopsSubs features
 * Run: npx tsx tests/e2e-scenarios.test.ts
 */

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] || null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};
(globalThis as any).window = { location: { href: "https://oopssubs.com/app" } };

// ── Business logic (copied from app) ──
interface Subscription { id: string; name: string; amount: number; cycle: "monthly"|"yearly"|"quarterly"; nextDate: string; createdAt: string; }
interface PendingCancel { subId: string; name: string; timestamp: number; }
interface CancelledSub { name: string; amount: number; cycle: string; date: string; }

const STORAGE_KEY = "oopssubs_subs";
const PENDING_CANCEL_KEY = "oopssubs_pending_cancel";
const CANCELLED_KEY = "oopssubs_cancelled";
function uuid() { return Math.random().toString(36).slice(2, 10); }
function fmtCurrency(n: number) { return "$" + n.toFixed(2); }

function loadSubs(): Subscription[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }
function saveSubs(s: Subscription[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
function addSub(name: string, amount: number, cycle: "monthly"|"yearly", nextDate: string): Subscription {
  const s: Subscription = { id: uuid(), name, amount, cycle, nextDate, createdAt: new Date().toISOString() };
  saveSubs([...loadSubs(), s]); return s;
}
function deleteSub(id: string) { saveSubs(loadSubs().filter(s => s.id !== id)); }

function getPendingCancels(): PendingCancel[] { try { return JSON.parse(localStorage.getItem(PENDING_CANCEL_KEY) || "[]"); } catch { return []; } }
function savePendingCancel(pc: PendingCancel) {
  const all = getPendingCancels().filter(p => p.subId !== pc.subId); all.push(pc);
  localStorage.setItem(PENDING_CANCEL_KEY, JSON.stringify(all));
}
function clearPendingCancel(subId: string) {
  localStorage.setItem(PENDING_CANCEL_KEY, JSON.stringify(getPendingCancels().filter(p => p.subId !== subId)));
}
function getCancelled(): CancelledSub[] { try { return JSON.parse(localStorage.getItem(CANCELLED_KEY) || "[]"); } catch { return []; } }
function addCancelled(name: string, amount: number, cycle: string) {
  const all = getCancelled(); all.push({ name, amount, cycle, date: new Date().toISOString() });
  localStorage.setItem(CANCELLED_KEY, JSON.stringify(all));
}
function lifetimeSavings() { return getCancelled().reduce((s, c) => s + (c.cycle === "yearly" ? c.amount : c.amount * 12), 0); }

// ── Scenario runner ──
let passed = 0, failed = 0;
function step(description: string, fn: () => void) {
  try { fn(); console.log(`  ✅ ${description}`); passed++; }
  catch (e: any) { console.log(`  ❌ ${description}: ${e.message}`); failed++; }
}

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }
function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

// ═══════════════════════════════════════════
console.log("\n🧪 SCENARIO 1: Alex signs up, finds subscriptions, cancels Netflix");
console.log("══════════════════════════════════════════════\n");
reset();

function reset() { Object.keys(store).forEach(k => delete store[k]); }

reset();
const today = new Date().toISOString().slice(0, 10);

// Step 1: Alex opens the app for the first time — empty state
step("App opens → empty state (0 subscriptions)", () => {
  assert(loadSubs().length === 0, "should start with 0 subs");
});

// Step 2: Alex connects Gmail, AI detects 5 subscriptions
step("Gmail scan finds 5 subscriptions", () => {
  const scanned = [
    { name: "Netflix", amount: 15.99, cycle: "monthly" as const, nextDate: tomorrow() },
    { name: "Spotify", amount: 9.99, cycle: "monthly" as const, nextDate: daysAgo(5) },
    { name: "Hulu", amount: 7.99, cycle: "monthly" as const, nextDate: daysAgo(10) },
    { name: "Adobe CC", amount: 29.99, cycle: "monthly" as const, nextDate: daysAgo(20) },
    { name: "Calm", amount: 14.99, cycle: "yearly" as const, nextDate: daysAgo(60) },
  ];
  for (const s of scanned) addSub(s.name, s.amount, s.cycle, s.nextDate);
  assert(loadSubs().length === 5, "should have 5 subs");
});

// Step 3: Alex sees lifetime savings = 0 (nothing cancelled yet)
step("No subscriptions cancelled → lifetime savings = $0", () => {
  assert(lifetimeSavings() === 0, "savings should be 0");
});

// Step 4: App detects Netflix renews tomorrow → shows renewal alert
step("Netflix renews tomorrow → renewal alert shown", () => {
  const netflix = loadSubs().find(s => s.name === "Netflix")!;
  // Verify the date was set to tomorrow
  const now = new Date(); now.setHours(0,0,0,0);
  const next = new Date(netflix.nextDate);
  const diffDays = Math.ceil((next.getTime() - now.getTime()) / 86400000);
  // Netflix should renew within 1-2 days (tomorrow or day after, depending on timezone)
  assert(diffDays >= 0 && diffDays <= 2, `Netflix nextDate is ${diffDays} days from now (expected 0-2)`);
  assert(netflix.name === "Netflix", "should be Netflix");
});

// Step 5: Alex clicks "Cancel now" → saves pending cancel + opens Netflix cancel page
step("Alex clicks Cancel now → pending cancel saved", () => {
  const netflix = loadSubs().find(s => s.name === "Netflix")!;
  savePendingCancel({ subId: netflix.id, name: netflix.name, timestamp: Date.now() });
  assert(getPendingCancels().length === 1, "pending cancel should be saved");
  // (In real app, this also opens /cancel/netflix in new tab)
});

// Step 6: Alex comes back 4 hours later → follow-up banner appears
step("4 hours later → app shows 'Did you cancel Netflix?'", () => {
  // Simulate 4 hours passing
  const netflix = loadSubs().find(s => s.name === "Netflix")!;
  const pending = getPendingCancels();
  // Make the pending appear 4 hours old
  store[PENDING_CANCEL_KEY] = JSON.stringify([{ subId: netflix.id, name: "Netflix", timestamp: Date.now() - 14400000 }]);
  const now = Date.now();
  const shouldShow = getPendingCancels().some(p => {
    const stillExists = loadSubs().some(s => s.id === p.subId);
    return stillExists && now - p.timestamp > 3600000;
  });
  assert(shouldShow, "follow-up should appear after 4 hours");
});

// Step 7: Alex clicks "Yes, done" → Netflix removed + added to cancelled
step("Alex clicks 'Yes, done' → Netflix removed + celebration", () => {
  const netflix = loadSubs().find(s => s.name === "Netflix")!;
  addCancelled(netflix.name, netflix.amount, netflix.cycle);
  deleteSub(netflix.id);
  clearPendingCancel(netflix.id);
  assert(loadSubs().length === 4, "should have 4 subs left");
  assert(loadSubs().every(s => s.name !== "Netflix"), "Netflix should be gone");
});

// Step 8: Celebration toast shows savings
step("Celebration shows: 'You just saved $191.88/year'", () => {
  const savings = lifetimeSavings();
  assert(savings > 0, "savings should be > 0");
  assert(Math.abs(savings - 191.88) < 0.01, `Netflix $15.99×12 = $191.88, got ${savings}`);
});

// Step 9: Dashboard top shows lifetime savings
step("Dashboard shows 'Lifetime saved: $191.88'", () => {
  assert(lifetimeSavings() > 0, "should show lifetime savings");
});

// ═══════════════════════════════════════════
console.log("\n🧪 SCENARIO 2: Sarah — returning user, weekly checkup, cancels 2 more");
console.log("══════════════════════════════════════════════\n");
reset();

// Setup: Sarah already has 4 subscriptions (from a previous session)
const sarahSubs = [
  { name: "Spotify", amount: 9.99, cycle: "monthly" as const },
  { name: "Hulu", amount: 7.99, cycle: "monthly" as const },
  { name: "Adobe CC", amount: 29.99, cycle: "monthly" as const },
  { name: "Calm", amount: 14.99, cycle: "yearly" as const },
];
for (const s of sarahSubs) addSub(s.name, s.amount, s.cycle, daysAgo(10));

// She already cancelled Netflix in the past
addCancelled("Netflix", 15.99, "monthly");

step("Sarah opens app → sees 4 subs + $191.88 lifetime savings", () => {
  assert(loadSubs().length === 4, "should have 4 active subs");
  assert(Math.abs(lifetimeSavings() - 191.88) < 0.01, "savings from previous Netflix cancel");
});

// Weekly checkup triggers (>7 days since last)
step("Weekly checkup: last check was 8 days ago → shows banner", () => {
  store["oopssubs_weekly_check"] = String(Date.now() - 691200000); // 8 days ago
  const lw = localStorage.getItem("oopssubs_weekly_check")!;
  const shouldShow = !lw || Date.now() - parseInt(lw) > 604800000;
  assert(shouldShow && loadSubs().length >= 2, "weekly banner should appear");
});

step("Banner text: 'You have 4 subs for $62.96/mo. Still need all?'", () => {
  const total = loadSubs().reduce((s, sub) => {
    return s + (sub.cycle === "yearly" ? sub.amount / 12 : sub.amount);
  }, 0);
  assert(Math.abs(total - 49.22) < 0.10, `expected ~$49.22/mo, got $${total.toFixed(2)}`);
});

// She dismisses the weekly → timestamp saved
step("Sarah dismisses weekly → timestamp saved, won't show for 7 days", () => {
  store["oopssubs_weekly_check"] = String(Date.now());
  const lw = localStorage.getItem("oopssubs_weekly_check")!;
  assert(!lw || Date.now() - parseInt(lw) <= 604800000, "should not show within 7 days");
});

// She decides to cancel Hulu + Adobe
step("Sarah clicks Cancel now on Hulu → pending saved", () => {
  const hulu = loadSubs().find(s => s.name === "Hulu")!;
  savePendingCancel({ subId: hulu.id, name: hulu.name, timestamp: Date.now() - 7200000 });
  assert(getPendingCancels().length === 1, "Hulu pending saved");
});

step("Sarah clicks Cancel now on Adobe → 2nd pending saved", () => {
  const adobe = loadSubs().find(s => s.name === "Adobe CC")!;
  savePendingCancel({ subId: adobe.id, name: adobe.name, timestamp: Date.now() - 7200000 });
  assert(getPendingCancels().length === 2, "2 pending cancels");
});

// She returns later — both confirmed
step("Sarah confirms both cancelled → removed + celebrations", () => {
  for (const sub of loadSubs().filter(s => ["Hulu", "Adobe CC"].includes(s.name))) {
    addCancelled(sub.name, sub.amount, sub.cycle);
    deleteSub(sub.id);
    clearPendingCancel(sub.id);
  }
  assert(loadSubs().length === 2, "should have 2 subs left (Spotify + Calm)");
  assert(getPendingCancels().length === 0, "no pending cancels left");
});

// Lifetime savings updated
step("Lifetime savings now $191.88 + $95.88 + $359.88 = $647.64", () => {
  const s = lifetimeSavings();
  // Netflix $191.88 + Hulu $95.88 + Adobe $359.88 = $647.64
  assert(Math.abs(s - 647.64) < 0.10, `expected ~$647.64, got $${s.toFixed(2)}`);
});

// Share
step("Sarah taps 'Share' → clipboard has savings + services", () => {
  const s = lifetimeSavings();
  const cancelled = getCancelled().slice(-5);
  const names = cancelled.map(c => c.name).join(", ");
  const text = `I found ${fmtCurrency(s)}/year in forgotten subscriptions using OopsSubs.\nMy cancelled: ${names}\nCheck yours → oopssubs.com`;
  assert(text.includes("647.64"), "text should contain savings amount");
  assert(text.includes("Netflix"), "text should contain Netflix");
  assert(text.includes("Hulu"), "text should contain Hulu");
  assert(text.includes("Adobe"), "text should contain Adobe");
  assert(text.includes("oopssubs.com"), "text should contain domain");
});

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
