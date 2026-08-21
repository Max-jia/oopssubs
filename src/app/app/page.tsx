"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import { getAppStoreSubscriptions, isMobileWeb } from "@/lib/app-store-scan";
import { initPurchases, checkPro, buyPro, restorePro, isNativeApp, handleStripeReturn } from "@/lib/purchases";
import { enableRipple } from "@/lib/ripple";
import { drawShareCard, saveShareToPhotos, shareCardNative } from "@/lib/share-card";
import { cancelGuides } from "@/data/cancel-guides";
import { Browser } from "@capacitor/browser";
import { App as CapApp } from "@capacitor/app";

// ── Known sender domain → service name mapping (auto-generated from cancel guides)
const SENDER_DOMAIN_MAP: Record<string, string> = {};
for (const g of cancelGuides) {
  const slug = g.slug;
  const domainHints = [slug.replace(/-/g, ''), slug.replace(/-plus|-premium|-cc|-pass|-tv|-app/g, '')];
  for (const hint of domainHints) {
    SENDER_DOMAIN_MAP[hint] = g.name;
  }
}

/* ── Types ── */
interface Subscription {
  id: string;
  name: string;
  amount: number;
  cycle: "monthly" | "yearly" | "quarterly";
  nextDate: string;
  createdAt: string;
  isTrial?: boolean;
  trialEnd?: string;
}

interface ScannedSub {
  name: string;
  amount: number;
  cycle: "monthly" | "yearly";
  confidence: "high" | "medium" | "low";
  isTrial?: boolean;
  trialEnd?: string;
  source?: string; // "Sender Name <email>" from the matched email
}

/* ── Helpers ── */
const STORAGE_KEY = "oopssubs_subs";
const TOKEN_KEY = "oopssubs_gmail_token";
const PENDING_CANCEL_KEY = "oopssubs_pending_cancel";
const CANCELLED_KEY = "oopssubs_cancelled";
const PENDING_PROOF_KEY = "oopssubs_pending_proof";
const FREE_LIMIT = 3;

/* 取消證據：AI 審核結果 + 截圖（截圖只存 IndexedDB，localStorage 5MB 放不下） */
interface ProofRecord {
  verified: "ai";
  reason?: string; // AI 的判定理由（若有）
  at: number;
}
interface CancelledSub { name: string; amount: number; cycle: string; date: string; subId?: string; proof?: ProofRecord; }
interface Celebration extends CancelledSub { caseNo: number; rankTitle: string; rankUp: boolean; }
function getCancelled(): CancelledSub[] {
  try { return JSON.parse(localStorage.getItem(CANCELLED_KEY) || '[]'); }
  catch { return []; }
}
function addCancelled(sub: Subscription, proof?: ProofRecord) {
  const all = getCancelled();
  all.push({ name: sub.name, amount: sub.amount, cycle: sub.cycle, date: new Date().toISOString(), subId: sub.id, ...(proof ? { proof } : {}) });
  localStorage.setItem(CANCELLED_KEY, JSON.stringify(all));
}

/* 截圖存 IndexedDB（容量大、不會被清掉） */
const PROOF_DB = "oopssubs_db";
const PROOF_STORE = "proof_images";
function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PROOF_DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(PROOF_STORE)) req.result.createObjectStore(PROOF_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function proofPut(subId: string, dataUrl: string) {
  try {
    const db = await idbOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PROOF_STORE, "readwrite");
      tx.objectStore(PROOF_STORE).put(dataUrl, subId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* 存失敗不阻斷主流程 */ }
}
async function proofGet(subId: string): Promise<string | null> {
  try {
    const db = await idbOpen();
    const val = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(PROOF_STORE, "readonly");
      const req = tx.objectStore(PROOF_STORE).get(subId);
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return val;
  } catch { return null; }
}

/* 未交證據的追債清單：說「已取消」但沒交截圖 → 每 24 小時提醒 */
interface PendingProof { subId: string; name: string; startedAt: number; }
function getPendingProofs(): PendingProof[] {
  try { return JSON.parse(localStorage.getItem(PENDING_PROOF_KEY) || '[]'); }
  catch { return []; }
}
function savePendingProof(p: PendingProof) {
  const all = getPendingProofs().filter(x => x.subId !== p.subId);
  all.push(p);
  localStorage.setItem(PENDING_PROOF_KEY, JSON.stringify(all));
}
function clearPendingProof(subId: string) {
  localStorage.setItem(PENDING_PROOF_KEY, JSON.stringify(getPendingProofs().filter(x => x.subId !== subId)));
}
function proofDays(p: PendingProof): number {
  return Math.floor((Date.now() - p.startedAt) / 86400000) + 1;
}

/* 截圖壓縮：最長邊 1200px、JPEG 0.85——一張截圖 ~200KB，不會吃光手機空間 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image decode failed")); };
    img.src = url;
  });
}

/* AI 偵探台詞庫：審核結果隨機抽一句（{name} 會換成服務名） */
const DETECTIVE_LINES_PASS = [
  "Nice catch. This one's toast.",
  "Confirmed. Sayonara, {name}.",
  "Proof accepted. Case closed.",
  "The bloodsucker is dead.",
  "Approved. Your wallet breathes again.",
  "Case closed. {name} won't bug you again.",
];
const DETECTIVE_LINES_FAIL = [
  "Nice try, but I'm not convinced.",
  "This screenshot says nothing. Get the real one.",
  "That's not {name}. Don't test me.",
  "Evidence rejected. I need the cancellation page.",
  "Hmm… this proves nothing. Try again.",
];
function pickDetectiveLine(pass: boolean, name: string): string {
  const pool = pass ? DETECTIVE_LINES_PASS : DETECTIVE_LINES_FAIL;
  return pool[Math.floor(Math.random() * pool.length)].replace("{name}", name);
}

/* 催繳台詞：天數越高偵探越急（4 秒輪換一句） */
const DEBT_LINES: [string[], string[], string[], string[]] = [
  ["The case is open. Evidence due.", "Day one. I'm patient. Not for long."],
  ["I'm waiting. Where's the proof?", "The case is getting cold…", "I can't close this file without evidence."],
  ["The suspect is getting away!", "My patience has a limit.", "Tick tock. Going cold!"],
  ["DAY SIX?! The suspect is getting away!", "This is the loudest case on my desk!", "I've seen colder cases. No. I haven't."],
];
function debtLevel(days: number): number {
  return days >= 6 ? 3 : days >= 4 ? 2 : days >= 2 ? 1 : 0;
}

/* 追債卡片：天數越高動效越煩人（呼吸 → 搖晃 → 紅閃崩潰） */
function DebtCard({ p, onOpen }: { p: PendingProof; onOpen: () => void }) {
  const days = proofDays(p);
  const level = debtLevel(days);
  const pool = DEBT_LINES[level];
  const [line, setLine] = useState(() => pool[Math.floor(Math.random() * pool.length)]);
  useEffect(() => { enableRipple();
    const t = setInterval(() => setLine(pool[Math.floor(Math.random() * pool.length)]), 4000);
    return () => clearInterval(t);
  }, [level]);

  // 動效參數：等級越高搖越大、閃越快；第 1 天只有呼吸（v18 起搖晃強度減半、紅光只閃兩下）
  const shakeX = level >= 3 ? [0, -4, 4, -2.5, 2.5, 0] : level >= 2 ? [0, -3, 3, -2, 2, 0] : level === 1 ? [0, -2, 2, 0] : [0];
  const shakeDur = level >= 3 ? 1.6 : level >= 2 ? 2.2 : 3;
  const breathe = level === 0 ? [1, 1.015, 1] : level >= 3 ? [1, 1.025, 1] : [1, 1.02, 1];
  const breatheDur = level === 0 ? 2.8 : level >= 3 ? 1.8 : 2;
  const flashPeak = level >= 3 ? 0.12 : level >= 2 ? 0.08 : 0;
  const flashDur = level >= 3 ? 0.9 : 1.3;

  return (
    <motion.div
      className="card bg-[var(--text)] overflow-hidden mb-6"
      animate={{ x: shakeX, scale: breathe }}
      transition={{ duration: shakeDur, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="relative px-5 py-4">
        {/* 紅閃層：天數越高紅光越強（v18 起只閃兩下就停，避免刺眼） */}
        {flashPeak > 0 && (
          <motion.div
            className="absolute inset-0 bg-[var(--amber)]"
            animate={{ opacity: [0, flashPeak, 0] }}
            transition={{ duration: flashDur, repeat: 1, ease: "easeInOut" }}
          />
        )}
        <div className="relative">
          <p className="text-[10px] font-bold tracking-[0.16em] text-[var(--amber)] mb-2">OPEN CASE · EVIDENCE DUE</p>
          <motion.p
            className="text-[40px] font-black leading-none text-[var(--amber)]"
            animate={level >= 2 ? { scale: [1, 1.12, 1] } : {}}
            transition={{ duration: level >= 3 ? 0.7 : 1.1, repeat: Infinity, ease: "easeInOut" }}
          >
            DAY {days}
          </motion.p>
          <p className="text-[16px] font-semibold text-[var(--bg)] mt-1">{p.name}</p>
          <p className="text-[13px] text-[var(--text-on-card)] min-h-[18px] mt-0.5 mb-4">{line}</p>
          <button
            onClick={onOpen}
            className="w-full bg-[var(--amber)] text-[var(--bg)] text-[15px] font-semibold py-3 rounded-xl active:scale-[0.98] transition-transform"
          >
            Turn in the evidence
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* 送截圖給網站後台 → Gemini 審核。後台只在網站伺服器上有鑰匙，App 拿不到。
   App 內部伺服器沒有 /api，必須呼叫線上網站；網站版同源用相對路徑。 */
async function callVerifyProof(sub: Subscription, dataUrl: string, isAudio = false): Promise<{ aiAvailable: boolean; passed: boolean; confidence: string; reason: string; transcript?: string }> {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(5, comma);
  const base = isNativeApp() ? "https://oopssubs.com" : "";
  const body = isAudio
    ? {
        name: sub.name, amount: fmtCurrency(sub.amount), cycle: sub.cycle,
        audioBase64: dataUrl.slice(comma + 1),
        mimeType: header.includes("mp4") ? "audio/mp4" : header.includes("wav") ? "audio/wav" : "audio/webm",
      }
    : {
        name: sub.name, amount: fmtCurrency(sub.amount), cycle: sub.cycle,
        imageBase64: dataUrl.slice(comma + 1),
        mimeType: header.includes("png") ? "image/png" : "image/jpeg",
      };
  const res = await fetch(`${base}/api/verify-proof/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("AI unavailable");
  return res.json();
}
function lifetimeSavings(): number {
  return getCancelled().reduce((sum, c) => sum + (c.cycle === 'yearly' ? c.amount : c.amount * 12), 0);
}
const DEEPSEEK_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_KEY || "";

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

function uuid() { return crypto.randomUUID(); }
function loadSubs(): Subscription[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveSubs(subs: Subscription[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(subs)); }

/* ── 偵探等級系統:破案數 + 連續破案 streak ── */
const DETECTIVE_KEY = "oopssubs_detective";
interface DetectiveState { cases: number; streak: number; lastCaseAt: string; }
function getDetective(): DetectiveState {
  try { return JSON.parse(localStorage.getItem(DETECTIVE_KEY) || '{"cases":0,"streak":0,"lastCaseAt":""}'); }
  catch { return { cases: 0, streak: 0, lastCaseAt: "" }; }
}
// 破案一次:streak 30 天內連續計,超過重置為 1
function recordCase(): DetectiveState {
  const d = getDetective();
  const now = new Date();
  const last = d.lastCaseAt ? new Date(d.lastCaseAt) : null;
  const streak = last && now.getTime() - last.getTime() < 30 * 864e5 ? d.streak + 1 : 1;
  const next = { cases: d.cases + 1, streak, lastCaseAt: now.toISOString() };
  localStorage.setItem(DETECTIVE_KEY, JSON.stringify(next));
  return next;
}
function detectiveRank(cases: number): { title: string; next: string | null; need: number } {
  if (cases >= 30) return { title: "Chief Inspector", next: null, need: 0 };
  if (cases >= 15) return { title: "Inspector", next: "Chief Inspector", need: 30 };
  if (cases >= 5) return { title: "Detective", next: "Inspector", need: 15 };
  if (cases >= 1) return { title: "Junior Detective", next: "Detective", need: 5 };
  return { title: "Cadet", next: "Junior Detective", need: 1 };
}
// 去重檢查:同名(忽略大小寫與首尾空格)視為已存在
function hasDuplicate(subs: Subscription[], name: string): boolean {
  const n = name.trim().toLowerCase();
  return subs.some(s => s.name.trim().toLowerCase() === n);
}
function monthlyEquivalent(sub: Subscription): number {
  if (sub.cycle === "yearly") return sub.amount / 12;
  if (sub.cycle === "quarterly") return sub.amount / 3;
  return sub.amount;
}
function totalMonthly(subs: Subscription[]): number {
  return subs.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
}
// 點擊微互動：Android WebView 支援 vibrate,網站自動忽略
function buzz(ms = 30) { try { navigator.vibrate?.(ms); } catch { /* noop */ } }

/* 數字滾動:值變化時從舊值滑到新值(省錢 App 的「加油機」效果) */
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    prevRef.current = to;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <p className={className}>{fmtCurrency(display)}</p>;
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function daysUntil(dateStr: string): number {
  // 日期字串「YYYY-MM-DD」在 JS 中固定解析成格林威治(UTC)午夜，
  // 所以「今天」也必須用 UTC 午夜來算，否則台灣時間(UTC+8)會差 8 小時。
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((new Date(dateStr).getTime() - todayUTC) / 86400000);
}
// Find the cancel guide slug for a subscription name (fuzzy match), null if no guide exists
function cancelSlugFor(name: string): string | null {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const guide = cancelGuides.find((g) => {
    const gkey = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return gkey === key || key.includes(gkey) || gkey.includes(key);
  });
  return guide ? guide.slug : null;
}
// Advance a date by one billing cycle (used when keeping an expired trial)
function advanceDate(dateStr: string, cycle: string): string {
  const d = new Date(dateStr);
  if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else if (cycle === "quarterly") d.setMonth(d.getMonth() + 3);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/* ── Gmail helpers ── */
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

function getStoredToken(): string | null { return localStorage.getItem(TOKEN_KEY); }

async function gapiInit(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).gapiInited) { resolve(); return; }
    // gapi script 是頁面掛載後才動態載入的——首次掃描時可能還沒就緒，
    // 若立即放棄會導致「第一次掃描必失敗」。輪詢等待最多 15 秒。
    const started = Date.now();
    const check = () => {
      const gapi = (window as any).gapi;
      if (gapi) { (window as any).gapiInited = true; gapi.load("client", { callback: resolve }); return; }
      if (Date.now() - started > 15000) { reject(new Error("Google API load timed out. Try again.")); return; }
      setTimeout(check, 200);
    };
    check();
  });
}

async function gisInit(): Promise<any> {
  return new Promise((resolve) => {
    if ((window as any).gisInited) { resolve((window as any).google?.accounts?.oauth2); return; }
    (window as any).gisInited = true;
    const check = () => {
      const g = (window as any).google?.accounts?.oauth2;
      if (g) resolve(g);
      else setTimeout(check, 100);
    };
    check();
  });
}

async function initGapiClient(token: string) {
  // gapi.client 在 App WebView 環境不可靠（gapi.load 的 client 庫載入行為異常），
  // 但實際掃描全走 fetch + Bearer token，根本不依賴 gapi——這裡只保留 token。
  // （網站版「首次掃描必失敗」的競態問題也隨之根除：不必再等 gapi script。）
  try { (window as any).gapi?.client?.setToken?.({ access_token: token }); } catch { /* noop */ }
}

/* ── Step 1: Subject-first precision search + broad supplementary ── */
const SUB_SEARCH_QUERIES = [
  // Primary: subject line only — high precision, low noise
  'subject:(receipt OR invoice OR subscription OR membership OR renewal OR billed OR payment OR "your plan" OR "monthly charge" OR "annual fee") newer_than:2y',
  // Free trials in subject
  'subject:("free trial" OR "trial ends" OR "welcome to" OR "your subscription") newer_than:2y',
  // Billing senders
  'from:(noreply@ OR billing@ OR payments@ OR accounts@ OR no-reply@) newer_than:2y',
  // Multi-language (body search — supplementary, lower priority)
  '("订阅" OR "续费" OR "自動更新" OR "구독" OR "suscripción" OR "abonnement" OR "Abonnement") newer_than:2y',
];

async function searchSubscriptionEmails(token: string): Promise<any[]> {
  const allMessages: any[] = [];
  const seen = new Set<string>();
  let errors = 0;
  for (const query of SUB_SEARCH_QUERIES) {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) { errors++; continue; }
      const data = await res.json();
      for (const msg of data.messages || []) {
        if (!seen.has(msg.id)) { seen.add(msg.id); allMessages.push(msg); }
      }
    } catch { errors++; }
  }
  // If ALL queries failed, likely a token/permission issue
  if (errors === SUB_SEARCH_QUERIES.length && allMessages.length === 0) {
    localStorage.removeItem(TOKEN_KEY); // Force re-auth
    throw new Error("Gmail access failed. Please re-connect your account.");
  }
  return allMessages;
}

/* ── Step 2: Better email body extraction — try plain text first, fallback to HTML ── */
function decodeBase64Url(data: string): string {
  try { return atob(data.replace(/-/g, "+").replace(/_/g, "/")); }
  catch { return ""; }
}

function stripHtml(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getEmailBody(token: string, msgId: string): Promise<{ text: string; trialEnd: string }> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const headers = data.payload?.headers || [];
  const sender = headers.find((h: any) => h.name === "From")?.value || "";
  const subject = headers.find((h: any) => h.name === "Subject")?.value || "";

  const parts = data.payload?.parts || [data.payload];
  let plainText = "";
  let htmlBody = "";

  for (const p of parts) {
    const bodyData = p.body?.data;
    if (!bodyData) continue;
    if (p.mimeType === "text/plain") plainText += decodeBase64Url(bodyData);
    else if (p.mimeType === "text/html") htmlBody += decodeBase64Url(bodyData);
    // Recurse into nested multipart
    if (p.parts) {
      for (const np of p.parts) {
        const nd = np.body?.data;
        if (!nd) continue;
        if (np.mimeType === "text/plain") plainText += decodeBase64Url(nd);
        else if (np.mimeType === "text/html") htmlBody += decodeBase64Url(nd);
      }
    }
  }

  const textBody = plainText || stripHtml(htmlBody);
  // Detect trial period
  const trialMatch = textBody.match(/free\s*(?:trial|period).*?(\d+).*?(day|week|month)s?/i)
    || textBody.match(/trial\s*(?:ends?|expires?|until)\s*([A-Z][a-z]+ \d{1,2},? \d{4}|\d{1,2}\/[A-Z][a-z]+\/\d{4})/i);
  let trialEnd = "";
  if (trialMatch) {
    try {
      const d = new Date(trialMatch[1]);
      if (!isNaN(d.getTime())) trialEnd = d.toISOString().slice(0, 10);
    } catch {}
  }

  const clean = textBody.replace(/\s+/g, " ").trim().slice(0, 2500);
  return { text: `From: ${sender}\nSubject: ${subject}\nBody: ${clean}`, trialEnd };
}

/* ── Step 3: Simple regex fallback for common patterns ── */
const KNOWN_SERVICES: [RegExp, string, "monthly"|"yearly"][] = [
  [/netflix/i, "Netflix", "monthly"],
  [/spotify/i, "Spotify", "monthly"],
  [/disney\+|disneyplus/i, "Disney+", "monthly"],
  [/hulu/i, "Hulu", "monthly"],
  [/hbo\s*max|max\.com/i, "Max", "monthly"],
  [/youtube\s*premium|youtube\s*music/i, "YouTube Premium", "monthly"],
  [/apple\s*music/i, "Apple Music", "monthly"],
  [/apple\s*(?:one|tv\+|arcade|fitness|news\+)/i, "Apple Services", "monthly"],
  [/amazon\s*prime/i, "Amazon Prime", "yearly"],
  [/amazon\s*audible|audible/i, "Audible", "monthly"],
  [/adobe\s*(?:cc|creative|photoshop|lightroom|illustrator|premiere)/i, "Adobe CC", "monthly"],
  [/dropbox/i, "Dropbox", "monthly"],
  [/notion/i, "Notion", "monthly"],
  [/github\s*(?:pro|copilot|team)/i, "GitHub", "monthly"],
  [/linkedin\s*premium/i, "LinkedIn Premium", "monthly"],
  [/tinder|bumble|hinge|match\.com/i, "Dating App", "monthly"],
  [/onlyfans|patreon|substack/i, "Content Creator", "monthly"],
  [/doordash\s*dashpass|uber\s*one|grubhub\+/i, "Delivery Pass", "monthly"],
  [/planet\s*fitness|peloton|classpass|calm|headspace/i, "Health & Fitness", "monthly"],
  [/nytimes|wsj|washington\s*post|the\s*atlantic|bloomberg/i, "News", "monthly"],
  [/xbox|playstation|nintendo|xgp|ps\s*plus/i, "Gaming", "monthly"],
  [/icloud|google\s*one|microsoft\s*365|office\s*365/i, "Cloud Storage", "monthly"],
  [/nordvpn|expressvpn|surfshark|protonvpn/i, "VPN", "monthly"],
];

/* ── V2: Sender domain matching against known services ── */
function matchSenderDomain(fromHeader: string): string | null {
  // Extract domain: either "name@domain.com" format, or just "domain.com"
  let domain = fromHeader.match(/@([a-z0-9-]+)\.(?:com|co|io|net|org|app|dev)/i)?.[1]?.toLowerCase();
  if (!domain) {
    domain = fromHeader.match(/([a-z0-9-]+)\.(?:com|co|io|net|org|app|dev)/i)?.[1]?.toLowerCase();
  }
  if (!domain) return null;
  // Direct lookup in cancel guides
  for (const g of cancelGuides) {
    const slugKey = g.slug.replace(/-plus|-premium|-cc|-pass|-tv|-app|-online|-sub/g, '');
    if (domain.includes(slugKey) || slugKey.includes(domain)) return g.name;
  }
  // Known sender domains
  const knownSenders: Record<string, string> = {
    'netflix': 'Netflix', 'spotify': 'Spotify', 'hulu': 'Hulu', 'disneyplus': 'Disney+',
    'youtube': 'YouTube Premium', 'amazon': 'Amazon', 'adobe': 'Adobe',
    'apple': 'Apple', 'linkedin': 'LinkedIn', 'microsoft': 'Microsoft',
    'dropbox': 'Dropbox', 'notion': 'Notion', 'evernote': 'Evernote',
    'nytimes': 'NYT', 'wsj': 'WSJ', 'washingtonpost': 'Washington Post',
    'tinder': 'Tinder', 'bumble': 'Bumble', 'hinge': 'Hinge',
    'doordash': 'DoorDash', 'ubereats': 'Uber', 'instacart': 'Instacart',
    'peloton': 'Peloton', 'calm': 'Calm', 'headspace': 'Headspace',
    'hellofresh': 'HelloFresh', 'blueapron': 'Blue Apron', 'chegg': 'Chegg',
    'coursera': 'Coursera', 'skillshare': 'Skillshare', 'duolingo': 'Duolingo',
    'discord': 'Discord', 'patreon': 'Patreon', 'substack': 'Substack',
    'xbox': 'Xbox', 'playstation': 'PlayStation', 'nintendo': 'Nintendo',
    'siriusxm': 'SiriusXM', 'pandora': 'Pandora', 'tidal': 'Tidal',
    'norton': 'Norton', 'mcafee': 'McAfee', 'expressvpn': 'ExpressVPN',
    'nordvpn': 'NordVPN', 'surfshark': 'Surfshark',
    'canva': 'Canva', 'grammarly': 'Grammarly', 'lastpass': 'LastPass',
    '1password': '1Password', 'walmart': 'Walmart+', 'barkbox': 'BarkBox',
    'masterclass': 'MasterClass', 'babbel': 'Babbel',
    'medium': 'Medium', 'reddit': 'Reddit', 'twitch': 'Twitch',
    'ea.com': 'EA Play', 'fubo': 'FuboTV', 'sling': 'Sling TV',
    'starz': 'Starz', 'crunchyroll': 'Crunchyroll', 'peacock': 'Peacock',
    'paramount': 'Paramount+', 'max.com': 'Max', 'onlyfans': 'OnlyFans',
    'planetfitness': 'Planet Fitness', 'classpass': 'ClassPass',
    'myfitnesspal': 'MyFitnessPal', 'strava': 'Strava', 'fitbit': 'Fitbit',
    'audible': 'Audible', 'kindle': 'Kindle Unlimited',
  };
  for (const [key, name] of Object.entries(knownSenders)) {
    if (domain.includes(key) || key.includes(domain)) return name;
  }
  return null;
}

function quickRegexExtract(text: string): ScannedSub | null {
  // Try known service patterns
  for (const [pattern, name, cycle] of KNOWN_SERVICES) {
    if (pattern.test(text)) {
      // Find dollar amount near the service name
      const amtMatch = text.match(/\$?\s*(\d+\.?\d{0,2})\s*(?:\/|per\s+)?\s*(?:month|mo|year|yr|\$)/i);
      if (amtMatch) {
        const amt = parseFloat(amtMatch[1]);
        if (amt >= 0.99 && amt <= 999) {
          return { name, amount: amt, cycle, confidence: "high" };
        }
      }
      // Found service name but no clear amount
      const anyAmt = text.match(/\$?\s?(\d{1,4}\.?\d{0,2})/);
      if (anyAmt) {
        const amt = parseFloat(anyAmt[1]);
        if (amt >= 0.99 && amt <= 999) {
          return { name, amount: amt, cycle, confidence: "medium" };
        }
      }
      return { name, amount: 0, cycle, confidence: "low" };
    }
  }
  // Generic: "$XX.XX" anywhere in a billing email
  const billing = text.match(/(?:total|amount|charged|paid|fee|price|cost).*?\$?\s*(\d+\.?\d{0,2})/i);
  if (billing) {
    const amt = parseFloat(billing[1]);
    if (amt >= 0.99 && amt <= 999) {
      return { name: "Subscription", amount: amt, cycle: "monthly", confidence: "low" };
    }
  }
  return null;
}

/* ── Step 4: AI extraction (improved prompt) ── */
async function extractSubsWithAI(bodies: { text: string; trialEnd: string }[]): Promise<ScannedSub[]> {
  // Quick regex pre-scan — catch obvious ones instantly
  const quickResults: ScannedSub[] = [];
  const remaining: { text: string; trialEnd: string }[] = [];
  for (const body of bodies) {
    // Layer 1: Try sender domain matching (most reliable)
    const fromHeader = body.text.match(/From:\s*.*?@([^\s\n<>"]+)/i)?.[1] || body.text.match(/From:\s*(.+)/m)?.[1] || '';
    const senderMatch = matchSenderDomain(fromHeader);
    const priceMatch = body.text.match(/\$\s*(\d+\.?\d{0,2})\s*(?:\/|per\s+)?\s*(?:month|mo|year|yr|annual)/i);
    const anyAmt = body.text.match(/(?:amount|total|charged|paid|fee|price|cost)\D*\$?\s*(\d+\.?\d{0,2})/i)
      || body.text.match(/\$\s?(\d+\.?\d{0,2})/);

    if (senderMatch) {
      const amt = priceMatch ? parseFloat(priceMatch[1]) : (anyAmt ? parseFloat(anyAmt[1]) : 0);
      const cycle = body.text.match(/year|annual/i) ? 'yearly' as const : 'monthly' as const;
      quickResults.push({
        name: senderMatch, amount: amt, cycle,
        confidence: amt > 0 ? 'high' : 'medium',
        isTrial: /trial|try it free/i.test(body.text),
        trialEnd: body.trialEnd || '',
        source: fromHeader,
      });
      continue;
    }

    // Layer 2: Regex pattern matching
    const q = quickRegexExtract(body.text);
    if (q) {
      if (body.trialEnd) { q.isTrial = true; q.trialEnd = body.trialEnd; q.confidence = "medium"; }
      const from = body.text.match(/From:\s*(.+)/m);
      if (from) q.source = from[1].trim();
      quickResults.push(q);
    } else {
      remaining.push(body);
    }
  }
  if (remaining.length === 0) {
    return quickResults;
  }

  const prompt = `You are analyzing emails in multiple languages to find subscriptions the user needs to manage.

CRITICAL: Never return a name of "Subscription". Always determine the actual service name from:
- The "From:" address (e.g., "noreply@netflix.com" → Netflix)
- The "Subject:" line (look for brand names)
- The email body content (logo text, app name, service branding)
- Branded greeting lines like "Your Netflix payment" or "Spotify からのお知らせ"

If you truly cannot determine the service name, use the sender's company name extracted from the From address (e.g., "noreply@zoom.us" → "Zoom"). The name "Subscription" is NEVER acceptable.

Include BOTH:
1. Active paid subscriptions (user is currently being charged)
2. Free trials that will auto-renew and charge later — these are critical, the user needs to cancel before being charged

Skip ONLY: one-time purchases (no auto-renewal), shipping confirmations, password resets, account verification emails.

For each subscription found, return:
- name: clean service name (e.g. "Netflix" not "Netflix, Inc.")
- amount: number in USD. For trials, use the amount they'll be charged AFTER the trial ends (e.g. $15.99). If trial amount is unknown, use 0.
- cycle: "monthly" or "yearly"
- confidence: "high" if exact amount and service clearly stated, "low" if unclear
- isTrial: true ONLY if this is currently a free trial (has not been charged yet). false if already paying.
- trialEnd: if isTrial, the date the trial ends in YYYY-MM-DD format. Empty string if unknown or not a trial.

IMPORTANT:
- FREE TRIALS ARE CRITICAL — include them. Mark isTrial=true. These are subscriptions the user will forget about
- If the same service appears in multiple emails, return it ONCE with the most recent information
- Annual charges like "$139.00/year" → cycle="yearly", amount=139
- Bundled charges (e.g., "Apple services $32.95") → ONE subscription with the bundle name
- Look for: "subscription", "renewal", "monthly charge", "membership", "auto-payment", "we charged", "thank you for your payment", "billing statement", "free trial", "trial ends", "trial period", "start your free", "cancel before"

Respond with ONLY valid JSON:
[{"name":"Netflix","amount":15.99,"cycle":"monthly","confidence":"high","isTrial":false,"trialEnd":""},{"name":"Hulu","amount":7.99,"cycle":"monthly","confidence":"high","isTrial":true,"trialEnd":"2026-07-30"}]

Emails:
${remaining.map((r: any) => r.text || r).join("\n\n===NEXT EMAIL===\n\n")}`;

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_KEY}` },
      body: JSON.stringify({ model: "deepseek-v4-flash", messages: [{ role: "user", content: prompt }], temperature: 0, max_tokens: 3000 }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "[]";
    const cleaned = text.replace(/```(?:json)?\s*|\s*```/g, "").trim();
    let aiResults: ScannedSub[] = JSON.parse(cleaned);
    // Post-process: fix generic names and missing amounts from email data
    aiResults = aiResults.map((s: ScannedSub) => {
      const isGeneric = /subscription|unknown/i.test(s.name);
      if (isGeneric || s.amount === 0) {
        const allText = [...remaining.map((r: any) => r.text || r), ...bodies.map((b: any) => b.text || b)].join("\n");
        // Try known service patterns first
        if (isGeneric) {
          for (const [pattern, svcName] of KNOWN_SERVICES) {
            if (pattern.test(allText)) { s.name = svcName; s.confidence = "medium"; break; }
          }
        }
        // If still generic, try From: header
        if (/subscription|unknown/i.test(s.name)) {
          const fromName = allText.match(/From:\s*["']?([A-Z][A-Za-z0-9&.\s]{2,30}?)(?:\s*<|$)/m);
          if (fromName && !/noreply|billing|payments|accounts|support|hello|info/i.test(fromName[1])) {
            s.name = fromName[1].trim(); s.confidence = "low";
          } else {
            const fromDomain = allText.match(/From:.*?@([a-z0-9-]+)\.(?:com|co|io|net|org|app|dev)/i);
            if (fromDomain && !/noreply|mail|email|billing|payments/i.test(fromDomain[1])) {
              const dn = fromDomain[1].charAt(0).toUpperCase() + fromDomain[1].slice(1);
              if (dn.length > 2) { s.name = dn; s.confidence = "low"; }
            }
          }
        }
        // Always capture source for generic entries
        if (!s.source) {
          const fromLine = allText.match(/From:\s*(.+)/m);
          if (fromLine) s.source = fromLine[1].trim();
        }
        // If amount missing, search for it
        if (s.amount === 0) {
          const amtMatch = allText.match(/\$\s?(\d+\.?\d{0,2})/);
          if (amtMatch) { s.amount = parseFloat(amtMatch[1]); }
        }
      }
      return s;
    });
    return [...quickResults, ...aiResults];
  } catch {
    return quickResults;
  }
}

/* ── Step 4.5: Deduplicate by sender domain before AI, keep max 2 per sender ── */
function dedupeBodiesBySender(bodies: { text: string; trialEnd: string }[]): { text: string; trialEnd: string }[] {
  const byDomain = new Map<string, { text: string; trialEnd: string }[]>();
  const unknowns: { text: string; trialEnd: string }[] = [];
  for (const b of bodies) {
    const match = b.text.match(/From:\s*.*?@([^\s\n<>"]+)/i);
    const domain = match ? match[1].toLowerCase() : "";
    if (!domain) { unknowns.push(b); continue; } // Don't group unknowns
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    if (byDomain.get(domain)!.length < 3) byDomain.get(domain)!.push(b);
  }
  const result: { text: string; trialEnd: string }[] = [];
  byDomain.forEach((items) => result.push(...items));
  result.push(...unknowns.slice(0, 10)); // Keep up to 10 unknown-sender emails
  return result;
}

/* ── Step 5: Deduplicate final results ── */
function dedupeSubs(items: ScannedSub[]): ScannedSub[] {
  const map = new Map<string, ScannedSub>();
  for (const item of items) {
    const key = item.name.toLowerCase().replace(/\s+/g, "");
    const existing = map.get(key);
    if (!existing || (item.confidence === "high" && existing.confidence !== "high")) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

/* ── Calendar ICS generator ── */
function generateICS(sub: Subscription): string {
  const d = new Date(sub.nextDate + "T10:00:00");
  const end = new Date(d.getTime() + 3600000);
  const fmt = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `${sub.id}@oopssubs.com`;
  const summary = `Cancel ${sub.name}? (${fmtCurrency(sub.amount)}/${sub.cycle === "monthly" ? "mo" : "yr"})`;

  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OopsSubs//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(d)}`, `DTEND:${fmt(end)}`, `UID:${uid}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${sub.name} renews today. Open OopsSubs to cancel or manage.\\n\\nAmount: ${fmtCurrency(sub.amount)}/${sub.cycle}`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY",
    `DESCRIPTION:${sub.name} renews tomorrow — ${fmtCurrency(sub.amount)}`,
    "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-P3D", "ACTION:DISPLAY",
    `DESCRIPTION:${sub.name} renews in 3 days`,
    "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

// Everywhere (app, mobile web, desktop web): Google Calendar API only — no .ics file downloads.
function calendarGoogleOnly(): boolean {
  return true;
}

async function addToCalendar(sub: Subscription): Promise<string | null> {
  const token = getStoredToken();
  if (token) {
    // Try direct Google Calendar API first —
    const d = new Date(sub.nextDate + "T10:00:00");
    const end = new Date(d.getTime() + 3600000);
    try {
      // 3s timeout — if the Calendar API is slow/unreachable, fail fast on mobile
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          summary: `Cancel ${sub.name}?`,
          description: `${sub.name} · ${fmtCurrency(sub.amount)}/${sub.cycle}\n\nAdded by OopsSubs`,
          start: { dateTime: d.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          reminders: {
            useDefault: false,
            overrides: [{ method: "popup", minutes: 3 * 24 * 60 }, { method: "popup", minutes: 24 * 60 }],
          },
        }),
      });
      clearTimeout(timer);
      if (res.ok) {
        return null; // Success — event created directly, no download
      }
    } catch {}
    if (calendarGoogleOnly()) {
      return "Couldn't write to your calendar — tap again to retry";
    }
  } else if (calendarGoogleOnly()) {
    return "Connect Gmail first, then tap the calendar icon";
  }
  // Desktop fallback: download ICS file
  const ics = generateICS(sub);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oopssubs-${sub.name.toLowerCase().replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return null;
}

/* ── Subscription Row ── */
function SubscriptionRow({ sub, onDelete, onCalError }: { sub: Subscription; onDelete: () => void; onCalError: (msg: string) => void }) {
  const [addedToCal, setAddedToCal] = useState(false);
  const [calBusy, setCalBusy] = useState(false);
  const handleAddToCalendar = async () => {
    setCalBusy(true);
    const err = await addToCalendar(sub);
    setCalBusy(false);
    if (err) { onCalError(err); return; }
    setAddedToCal(true);
    setTimeout(() => setAddedToCal(false), 2000);
  };
  const days = daysUntil(sub.nextDate);
  const urgency = sub.isTrial
    ? (days <= 3 ? "text-[var(--red)] bg-[var(--red-dim)]" : "text-[var(--amber)] bg-[var(--amber-dim)]")
    : days <= 3 ? "text-[var(--red)] bg-[var(--red-dim)]" : days <= 7 ? "text-[var(--amber)] bg-[var(--amber-dim)]" : "text-[var(--text-secondary)] bg-[var(--bg-elevated)]";
  return (
    <div className="flex items-center justify-between py-3.5 px-5 hover:bg-[var(--bg-elevated)]/50 transition-colors duration-150 group -mx-5 rounded-2xl">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-11 h-11 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center text-[15px] font-semibold text-[var(--text)] flex-shrink-0 shadow-sm">
          {sub.name[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-[15px] font-medium truncate">{sub.name}</div>
            {sub.isTrial && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--amber-dim)] text-[var(--amber)] flex-shrink-0">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Free trial
              </span>
            )}
          </div>
          <div className="text-[13px] text-[var(--text-secondary)]">{fmtCurrency(sub.amount)}/{sub.cycle === 'monthly' ? 'mo' : sub.cycle === 'yearly' ? 'yr' : 'qtr'}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span key={days} className={`text-[12px] font-medium px-2.5 py-1 rounded-full badge-pop ${urgency}`}>
          {days <= 0 ? (sub.isTrial ? "Trial ended" : "Due") : sub.isTrial ? `${days}d left` : days === 1 ? "Tmrw" : `${days}d`}
        </span>
        <button
          onClick={handleAddToCalendar}
          disabled={calBusy}
          className="text-[var(--text-tertiary)] hover:text-[var(--text)] transition-all duration-200 text-xs w-6 h-6 rounded-full hover:bg-[var(--bg-hover)] flex items-center justify-center disabled:opacity-50"
          title="Add to calendar"
        >
          {calBusy ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
          ) : addedToCal ? (
            <svg className="w-4 h-4 text-[var(--green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── 可左滑行：左滑露出 Cancel，滑過一半卡住，點 Cancel 才執行；首次顯示教學動畫 ── */
const SWIPE_HINT_KEY = "oopssubs_swipe_hint";

function SwipeableRow({ index, last, hint, leaving, onHintShown, onCancel, children }: {
  index: number;
  last: boolean;
  hint: boolean;
  leaving: boolean;
  onHintShown: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [teaching, setTeaching] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  // 首次進入視口 → 播放教學動畫 + 標籤(只一次)
  useEffect(() => {
    if (!hint || teaching) return;
    const el = rowRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      setTeaching(true);
      onHintShown();
      try { localStorage.setItem(SWIPE_HINT_KEY, "1"); } catch { /* noop */ }
      try { navigator.vibrate?.(10); } catch { /* noop */ }
      io.disconnect();
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [hint, teaching]);
  // teaching 變 true 時啟動隱藏計時(獨立 effect,避免 cleanup 干擾)
  useEffect(() => {
    if (!teaching) return;
    const t = setTimeout(() => setTeaching(false), 4200);
    return () => clearTimeout(t);
  }, [teaching]);
  return (
    <div className={`relative overflow-hidden ${last ? '' : 'border-b border-[var(--divider)]'}`}>
      {/* 首次使用教學提示(進入視口才出現) */}
      {teaching && (
        <div className="absolute top-2 right-4 z-10 bg-[var(--bg)] text-[var(--text)] text-[11px] font-medium px-2.5 py-1 rounded-full shadow-lg animate-fade-in">
          Swipe left to cancel
        </div>
      )}
      {/* 左滑露出的取消底層（點擊才執行） */}
      <div className="absolute inset-y-0 right-0 w-24 z-0 bg-[var(--red)] flex items-center justify-center">
        <button
          onClick={onCancel}
          className="text-[var(--bg)] text-[13px] font-semibold tracking-wide active:scale-95 transition-transform"
        >
          Cancel
        </button>
      </div>
      <motion.div
        ref={rowRef}
        initial={{ opacity: 0, x: -20 }}
        animate={{
          opacity: 1,
          x: teaching ? [0, -44, 0, -44, 0] : open ? -88 : 0,
        }}
        transition={
          teaching
            ? { duration: 1.6, times: [0, 0.2, 0.5, 0.7, 1], ease: "easeInOut" }
            : { type: "spring", stiffness: 400, damping: 30 }
        }
        className={`relative z-[1] bg-[var(--bg-elevated)] ${leaving ? 'row-leaving' : ''}`}
        layout
        drag={teaching ? false : "x"}
        dragConstraints={{ left: -88, right: 0 }}
        dragElastic={0.1}
        whileDrag={{ scale: 0.98, opacity: 0.95 }}
        onDragEnd={(e, info) => {
          if (open) { setOpen(false); return; }
          if (info.offset.x < -44 || info.velocity.x < -400) {
            setOpen(true);
            try { navigator.vibrate?.(15); } catch { /* noop */ }
          } else {
            setOpen(false);
          }
        }}
        onClick={() => { if (open) setOpen(false); }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ── Main App Page ── */
export default function AppPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [scannedItems, setScannedItems] = useState<ScannedSub[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", amount: "", cycle: "monthly" as const, nextDate: "", isTrial: false, trialEnd: "" });
  const [mounted, setMounted] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [followUpCancel, setFollowUpCancel] = useState<PendingCancel | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [detective, setDetective] = useState<DetectiveState>(() => getDetective());
  const [showWeekly, setShowWeekly] = useState(false);
  const [trialAlert, setTrialAlert] = useState<(Subscription & { slug: string | null }) | null>(null);
  const [pro, setPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showTrustModal, setShowTrustModal] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [shareImg, setShareImg] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareSaved, setShareSaved] = useState<string | null>(null);
  // 首次看到列表時,第一行自動演示一次左滑教學
  // 全局錯誤捕獲:崩潰時把具體錯誤顯示在畫面上(用戶可原文回報,協助遠端排查)
  const [fatalError, setFatalError] = useState<string | null>(null);
  // App(WebView)不需要 Service Worker——殘留的 SW 會快取舊 chunk 導致載入崩潰,主動卸載
  useEffect(() => {
    if (isNativeApp() && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    }
  }, []);
  useEffect(() => {
    const isNoise = (m: string) =>
      m.includes("Not implemented on web") ||  // RevenueCat 在 web 環境的已知噪音
      m.includes("unimplemented");
    const onErr = (e: ErrorEvent) => {
      const msg = e.message || String(e.error);
      if (isNoise(msg)) return;
      setFatalError(msg);
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const msg = String(e.reason?.message || e.reason);
      if (isNoise(msg)) return;
      setFatalError(msg);
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);

  // 首次看到列表時,第一行進入視口才演示左滑(標記在視口觸發時寫入)
  const [swipeHint, setSwipeHint] = useState(false);
  // 退場動效:正在滑出的訂閱行
  const [leaving, setLeaving] = useState<string | null>(null);
  useEffect(() => {
    if (subs.length > 0 && typeof window !== "undefined" && !localStorage.getItem(SWIPE_HINT_KEY)) {
      setSwipeHint(true);
    }
  }, [subs.length]);

  // 取消證據流程（取消證明制：沒交截圖證明，取消提醒會一直持續）
  const [proof, setProof] = useState<{
    sub: Subscription;
    stage: "select" | "audio" | "reviewing" | "result" | "confirm" | "done";
    image: string | null;
    audio: string | null;
    isAudio: boolean;
    verdict: { aiAvailable: boolean; passed: boolean; confidence: string; reason: string; transcript?: string } | null;
    aiError: boolean;
    line: string; // 偵探台詞（隨機抽）
    verified: "ai" | null;
    checks: [boolean, boolean, boolean];
    hold: number; // 長按 3 秒進度 0–1
  } | null>(null);
  const [pendingProofs, setPendingProofs] = useState<PendingProof[]>([]);
  const [proofViewer, setProofViewer] = useState<{ name: string; dataUrl: string } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 回看取消證據：從 IndexedDB 撈截圖（key = 訂閱 id）
  const viewProof = useCallback(async (c: CancelledSub) => {
    const dataUrl = await proofGet(c.subId || "");
    if (dataUrl) setProofViewer({ name: c.name, dataUrl });
  }, []);

  // 拿到 Gmail token 後啟動掃描——網站版（hash 回跳）與 App 版（deep link 回跳）共用
  const startScan = useCallback(async (token: string) => {
    try {
      await initGapiClient(token);
      setScanning(true); setScanStatus("Searching for clues…");
      const messages = await searchSubscriptionEmails(token);
      if (messages.length === 0) { setScannedItems([]); setError("No clues found — your inbox is clean. Try adding manually."); setScanning(false); return; }
      setScanStatus(`Examining ${Math.min(messages.length, 35)} pieces of evidence…`);
      const bodies: { text: string; trialEnd: string }[] = [];
      for (const msg of messages.slice(0, 35)) { const body = await getEmailBody(token, msg.id); if (body.text) bodies.push(body); }
      const dedupedBodies = dedupeBodiesBySender(bodies);
      setScanStatus(`The inspector is analyzing ${dedupedBodies.length} clues…`);
      const extracted = dedupeSubs(await extractSubsWithAI(dedupedBodies));
      if (extracted.length === 0) setError(`AI analyzed ${bodies.length} emails but found no subscriptions.`);
      setScannedItems(extracted); setScanning(false); setScanStatus("");
    } catch (e: any) {
      // 診斷版：顯示具體錯誤（v14 後改回友善提示）
      setScanning(false); setError("Scan failed: " + String(e?.message || e));
    }
  }, []);

  useEffect(() => {
    setSubs(loadSubs());
    setPendingProofs(getPendingProofs());
    // Check PRO status: native = RevenueCat in-app purchase; web = Stripe purchase (restored on return)
    initPurchases().then(async () => {
      const fromStripe = await handleStripeReturn();
      setPro(fromStripe || (await checkPro()));
    });
    // Handle OAuth redirect callback (token in URL hash) — 網站版流程
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      const params = new URLSearchParams(hash.slice(1));
      const token = params.get("access_token");
      const state = params.get("state");
      if (token && state === "scan") {
        localStorage.setItem(TOKEN_KEY, token);
        window.location.hash = "";
        // Trigger scan with the new token
        setTimeout(() => startScan(token), 500);
      }
    }
    // Handle OAuth deep-link return — App 版流程：
    // 系統瀏覽器 → oopssubs.com/oauth-app → com.oopssubs.app://oauth#access_token=...
    if (isNativeApp()) {
      CapApp.addListener("appUrlOpen", (data: any) => {
        const url: string = data?.url || "";
        const params = new URLSearchParams((url.split("#")[1] || ""));
        const token = params.get("access_token");
        const state = params.get("state");
        if (token && state === "scan") {
          localStorage.setItem(TOKEN_KEY, token);
          startScan(token);
        }
      });
    }
    // Check for pending cancel follow-ups
    const pending = getPendingCancels();
    const subs = loadSubs();
    for (const pc of pending) {
      if (Date.now() - pc.timestamp > 3600000 && subs.some(s => s.id === pc.subId)) {
        setFollowUpCancel(pc);
        break;
      }
    }
    setMounted(true);
  }, []);

  // Weekly checkup
  useEffect(() => {
    if (!mounted || subs.length < 2) return;
    const lastWeekly = localStorage.getItem("oopssubs_weekly_check");
    if (!lastWeekly || Date.now() - parseInt(lastWeekly) > 604800000) {
      setShowWeekly(true);
    }
  }, [mounted, subs.length]);

  // Wait for Google API scripts to fully load
  useEffect(() => {
    const check = setInterval(() => {
      if ((window as any).gapi) { setGoogleReady(true); clearInterval(check); }
    }, 200);
    return () => clearInterval(check);
  }, []);

  // Auto-trigger action from URL hash (#action=manual / #action=scan)
  // Hash is used instead of query params — Capacitor's local server can't resolve
  // query-string URLs for static exports, which made the app bounce back to home.
  useEffect(() => {
    if (!mounted) return;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const action = hashParams.get("action");
    if (action === 'scan') {
      if (isNativeApp()) {
        // Native app: no gapi — scan flow skips GIS itself
        handleGmailScan();
      } else {
        // Wait for gapi to be available before triggering scan
        const waitForGapi = () => {
          if ((window as any).gapi) {
            handleGmailScan();
          } else {
            setTimeout(waitForGapi, 200);
          }
        };
        waitForGapi();
      }
    } else if (action === 'manual') {
      // Free limit reached → paywall straight away, no empty form filling
      if (!pro && subs.length >= FREE_LIMIT) openPaywallIfNeeded();
      else setShowAdd(true);
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── V2: Auto background scan on app open ──
  useEffect(() => {
    if (!mounted) return;
    const lastScanKey = "oopssubs_last_autoscan";
    const lastScan = localStorage.getItem(lastScanKey);
    const now = Date.now();
    // Only auto-scan if last scan was > 2 hours ago
    if (lastScan && now - parseInt(lastScan) < 7200000) return;
    const token = getStoredToken();
    if (!token) return;

    const doBackgroundScan = async () => {
      try {
        await initGapiClient(token);
        const query = '("free trial" OR "trial ends" OR "welcome to" OR "subscription confirmed" OR "you\'re subscribed") newer_than:14d';
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        const messages = data.messages || [];
        if (messages.length === 0) return;

        const newBodies: { text: string; trialEnd: string }[] = [];
        for (const msg of messages.slice(0, 5)) {
          const body = await getEmailBody(token, msg.id);
          if (body.text) newBodies.push(body);
        }
        if (newBodies.length === 0) return;

        const extracted = dedupeSubs(await extractSubsWithAI(newBodies));
        // Filter: only show subscriptions not already tracked
        const knownNames = new Set(subs.map(s => s.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
        const trulyNew = extracted.filter(e => {
          const key = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return !knownNames.has(key) && e.name.length > 2 && !/subscription|unknown/i.test(e.name);
        });

        if (trulyNew.length > 0) {
          setScannedItems(dedupeSubs(trulyNew));
        }
      } catch {}
      localStorage.setItem(lastScanKey, String(now));
    };

    doBackgroundScan();
  }, [mounted, subs.length]);

  // Send a notification: native app → Capacitor Local Notifications (system notification),
  // web/PWA → Web Notification API. slug = cancel-guide slug for the "Cancel it" action.
  const notify = useCallback(async (title: string, body: string, slug?: string | null) => {
    try {
      if (isNativeApp()) {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== "granted") await LocalNotifications.requestPermissions();
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now() + Math.floor(Math.random() * 1000), title, body,
            extra: slug ? { slug } : {},
            actionTypeId: slug ? "cancel_action" : undefined,
            schedule: { at: new Date(Date.now() + 1000) },
          }],
        });
      } else if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const n = new Notification(title, { body, icon: "/icon-192.png" });
        n.onclick = () => window.focus();
      }
    } catch {}
  }, []);

  // Native app: tapping the "Cancel it" action on a notification jumps to the cancel guide
  useEffect(() => {
    if (!isNativeApp()) return;
    let alive = true;
    (async () => {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      if (!alive) return;
      await LocalNotifications.registerActionTypes({
        types: [{ id: "cancel_action", actions: [{ id: "cancel", title: "Cancel it" }] }],
      });
      await LocalNotifications.addListener("localNotificationActionPerformed", (e) => {
        if (e.actionId === "cancel" && (e.notification.extra as any)?.slug) {
          window.location.href = `/cancel/${(e.notification.extra as any).slug}`;
        }
      });
    })();
    return () => { alive = false; };
  }, []);

  // Reminders: trials (3d/1d before auto-charge) and renewals — each fires once per due date
  useEffect(() => {
    if (!mounted || subs.length === 0) return;
    subs.forEach((sub) => {
      const days = daysUntil(sub.nextDate);
      if (days !== 3 && days !== 1) return;
      if (sub.isTrial) {
        const key = `oopssubs_trial_notif_${sub.id}_${days}_${sub.nextDate}`;
        if (localStorage.getItem(key)) return;
        notify(
          `${sub.name} free trial ends ${days === 1 ? "tomorrow" : `in ${days} days`}`,
          `It will auto-charge ${fmtCurrency(sub.amount)}. Cancel before ${new Date(sub.nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
          cancelSlugFor(sub.name)
        );
        localStorage.setItem(key, "1");
      } else {
        const key = `oopssubs_notif_${sub.id}_${days}_${sub.nextDate}`;
        if (localStorage.getItem(key)) return;
        notify("OopsSubs", `${sub.name} renews in ${days} day${days > 1 ? "s" : ""} — ${fmtCurrency(sub.amount)}`, cancelSlugFor(sub.name));
        localStorage.setItem(key, "1");
      }
    });
  }, [subs, mounted, notify]);

  // Trial expiring today or already expired → top banner with a Cancel shortcut
  useEffect(() => {
    if (!mounted) return;
    const list = subs
      .filter((s) => s.isTrial && daysUntil(s.nextDate) <= 0)
      .sort((a, b) => daysUntil(a.nextDate) - daysUntil(b.nextDate));
    const t = list.find((s) => !localStorage.getItem(`oopssubs_trial_dismissed_${s.id}_${s.nextDate}`));
    setTrialAlert(t ? { ...t, slug: cancelSlugFor(t.name) } : null);
  }, [subs, mounted]);

  const dismissTrialAlert = useCallback(() => {
    if (!trialAlert) return;
    localStorage.setItem(`oopssubs_trial_dismissed_${trialAlert.id}_${trialAlert.nextDate}`, "1");
    setTrialAlert(null);
  }, [trialAlert]);

  // Keep an expired trial → becomes a regular subscription, next charge pushed one cycle ahead
  const keepTrial = useCallback(() => {
    if (!trialAlert) return;
    const updated = subs.map((s) =>
      s.id === trialAlert.id
        ? { ...s, isTrial: undefined, trialEnd: undefined, nextDate: advanceDate(s.nextDate, s.cycle) }
        : s
    );
    setSubs(updated); saveSubs(updated);
    setTrialAlert(null);
  }, [subs, trialAlert]);

  // 付費牆前重查購買狀態:已買過就解鎖不彈窗(防止 pro 狀態過期誤彈)
  const openPaywallIfNeeded = useCallback(async (): Promise<boolean> => {
    if (subs.length < FREE_LIMIT) return false;
    if (pro) return false;
    const isPro = await checkPro();
    if (isPro) { setPro(true); return false; }
    setShowPaywall(true);
    return true;
  }, [subs, pro]);

  const addSub = useCallback(async () => {
    if (!form.name || !form.amount) return;
    if (hasDuplicate(subs, form.name)) {
      setError(`"${form.name.trim()}" is already on your list.`);
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (await openPaywallIfNeeded()) return;
    const sub: Subscription = {
      id: uuid(), name: form.name.trim(), amount: parseFloat(form.amount),
      cycle: form.cycle,
      nextDate: form.isTrial && form.trialEnd ? form.trialEnd : (form.nextDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)),
      createdAt: new Date().toISOString(),
      ...(form.isTrial ? { isTrial: true, trialEnd: form.trialEnd || undefined } : {}),
    };
    const updated = [...subs, sub];
    setSubs(updated); saveSubs(updated);
    setForm({ name: "", amount: "", cycle: "monthly", nextDate: "", isTrial: false, trialEnd: "" }); setShowAdd(false);
  }, [form, subs, pro]);

  const handleRestore = useCallback(async () => {
    setRestoring(true); setBuyError("");
    const res = await restorePro();
    setRestoring(false);
    if (res.ok) { setPro(true); setShowPaywall(false); }
    else setBuyError(res.error === "no-entitlement" ? "No previous purchase found on this account." : "Restore failed. Please try again.");
  }, []);

  const handleBuyPro = useCallback(async () => {
    setBuying(true); setBuyError("");
    const res = await buyPro();
    setBuying(false);
    if (res.ok) { setPro(true); setShowPaywall(false); }
    else if (!res.cancelled) { setBuyError("Purchase failed. Please try again."); }
  }, []);

  const deleteSub = useCallback((id: string, proofRec?: ProofRecord) => {
    const deleted = subs.find(s => s.id === id);
    // 先播退場動畫(卡片滑出),280ms 後才真正刪除
    setLeaving(id);
    setTimeout(() => {
      if (deleted) addCancelled(deleted, proofRec);
      const updated = subs.filter((s) => s.id !== id);
      setSubs(updated); saveSubs(updated);
      setLeaving(null);
      if (deleted) {
        // 偵探系統:破案紀錄 + 等級比較
        const det = recordCase();
        setDetective(det);
        const rankBefore = detectiveRank(det.cases - 1);
        const rankAfter = detectiveRank(det.cases);
        setCelebration({
          name: deleted.name, amount: deleted.amount, cycle: deleted.cycle, date: new Date().toISOString(),
          caseNo: det.cases, rankTitle: rankAfter.title, rankUp: rankBefore.title !== rankAfter.title,
        });
        setTimeout(() => setCelebration(null), 6000);
      }
    }, 280);
  }, [subs]);

  /* ── 取消證據流程 ── */
  const openProofFlow = useCallback((sub: Subscription) => {
    setProof({ sub, stage: "select", image: null, audio: null, isAudio: false, verdict: null, aiError: false, line: "", verified: null, checks: [false, false, false], hold: 0 });
  }, []);

  // 關閉證據流程：沒完成 = 列入追債清單（保留首次開始時間，天數才不會被重開重置）
  const closeProofFlow = useCallback(() => {
    if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
    if (!proof) return;
    if (proof.stage !== "done") {
      const existing = getPendingProofs().find(x => x.subId === proof.sub.id);
      savePendingProof({ subId: proof.sub.id, name: proof.sub.name, startedAt: existing?.startedAt || Date.now() });
      setPendingProofs(getPendingProofs());
    }
    setProof(null);
  }, [proof]);

  // 證據完成 → 真正刪除 + 記錄帶證據 + 清掉所有相關提醒
  const finishProof = useCallback(() => {
    if (!proof) return;
    const { sub } = proof;
    const verified = proof.verified === "ai" ? "ai" : "ai"; // 必須 AI 審核通過才可取消
    const rec: ProofRecord = {
      verified,
      ...(proof.verdict?.reason ? { reason: proof.verdict.reason } : {}),
      at: Date.now(),
    };
    if (proof.image) proofPut(sub.id, proof.image);
    deleteSub(sub.id, rec);
    clearPendingCancel(sub.id);
    clearPendingProof(sub.id);
    setPendingProofs(getPendingProofs());
    setFollowUpCancel(null);
    setProof(p => (p ? { ...p, stage: "done" } : p));
    setTimeout(() => setProof(null), 2200);
  }, [proof, deleteSub]);

  // 選圖 → 壓縮 → 送後台給 AI 審核；AI 故障自動降級（不卡死用戶）
  const handleProofFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !proof) return;
    try {
      const dataUrl = await compressImage(file);
      setProof(p => (p ? { ...p, image: dataUrl, stage: "reviewing", verdict: null, aiError: false } : p));
      try {
        const verdict = await callVerifyProof(proof.sub, dataUrl);
        setProof(p => (p ? { ...p, verdict, aiError: false, line: pickDetectiveLine(verdict.passed, p.sub.name), stage: "result" } : p));
      } catch {
        setProof(p => (p ? { ...p, aiError: true, line: "", stage: "result" } : p));
      }
    } catch {
      setError("Could not read that image. Try another screenshot.");
      setTimeout(() => setError(""), 4000);
    }
  }, [proof]);

  // ── 語音作證:錄音 ──
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioUrl(reader.result as string);
          setProof(p => (p ? { ...p, audio: reader.result as string, isAudio: true } : p));
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone unavailable. Try the screenshot option instead.");
      setTimeout(() => setError(""), 4000);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  // 提交語音證詞 → 審核
  const submitAudio = useCallback(async () => {
    if (!proof?.audio) return;
    setProof(p => (p ? { ...p, stage: "reviewing", verdict: null, aiError: false } : p));
    try {
      const verdict = await callVerifyProof(proof.sub, proof.audio, true);
      setProof(p => (p ? { ...p, verdict, aiError: false, line: pickDetectiveLine(verdict.passed, p.sub.name), stage: "result" } : p));
    } catch {
      setProof(p => (p ? { ...p, aiError: true, line: "", stage: "result" } : p));
    }
  }, [proof]);

  // AI 故障重試:用同一張截圖重新送審
  const retryProof = useCallback(async () => {
    if (!proof?.image) return;
    setProof(p => (p ? { ...p, stage: "reviewing", verdict: null, aiError: false } : p));
    try {
      const verdict = await callVerifyProof(proof.sub, proof.image);
      setProof(p => (p ? { ...p, verdict, aiError: false, line: pickDetectiveLine(verdict.passed, p.sub.name), stage: "result" } : p));
    } catch {
      setProof(p => (p ? { ...p, aiError: true, line: "", stage: "result" } : p));
    }
  }, [proof]);

  // 長按 3 秒：滿了才放行（鬆手或滑出去都會重置）
  const startHold = useCallback(() => {
    if (!proof || !proof.checks.every(Boolean)) return;
    const startAt = Date.now();
    holdTimerRef.current = setInterval(() => {
      const el = Date.now() - startAt;
      setProof(p => (p ? { ...p, hold: Math.min(1, el / 3000) } : p));
      if (el >= 3000) {
        if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
        try { navigator.vibrate?.(60); } catch { /* noop */ }
        finishProof();
      }
    }, 50);
  }, [proof, finishProof]);

  const endHold = useCallback(() => {
    if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
    setProof(p => (p ? { ...p, hold: 0 } : p));
  }, []);

  const handleAppStoreScan = useCallback(async () => {
    const subs = await getAppStoreSubscriptions();
    if (!subs.length) { setError("No active App Store subscriptions found."); return; }
    setScannedItems(subs.map((s) => ({
      name: s.name, amount: s.amount || 0, cycle: s.cycle || "monthly",
      confidence: "high" as const, isTrial: false,
    })));
  }, []);

  const scanningRef = useRef(false);
  const handleGmailScan = useCallback(async () => {
    if (scanningRef.current) return; // Prevent duplicate scans
    // 未授權 Gmail:先彈信任窗(不顯示掃描畫面),用戶確認後才開始掃描
    if (!getStoredToken()) {
      setShowTrustModal(true);
      return;
    }
    scanningRef.current = true;
    setScanning(true); setError(""); setScanStatus(""); setScannedItems([]);
    // Safety timeout: if scan takes >45s, show error
    const timeout = setTimeout(() => { setError("Scan is taking longer than expected. Results may still appear."); setScanning(false); }, 90000);
    try {
      // Native app: skip GIS (Google blocks its popup login inside WebViews) — go straight to the direct redirect
      if (!isNativeApp()) {
        await gapiInit(); const oauth2 = await gisInit();
      }
      const doScan = async (token: string) => {
        localStorage.setItem(TOKEN_KEY, token); await initGapiClient(token);
        setScanStatus("Searching for clues…");
        const messages = await searchSubscriptionEmails(token);
        if (messages.length === 0) { setScannedItems([]); setError(`No subscription-related emails found in the last 2 years. Try adding manually.`); clearTimeout(timeout); scanningRef.current = false; setScanning(false); setScanStatus(""); return; }
        setScanStatus(`Examining ${Math.min(messages.length, 35)} pieces of evidence…`);
        const bodies: { text: string; trialEnd: string }[] = [];
        for (const msg of messages.slice(0, 35)) { const body = await getEmailBody(token, msg.id); if (body.text) bodies.push(body); }
        const dedupedBodies = dedupeBodiesBySender(bodies);
        setScanStatus(`The inspector is analyzing ${dedupedBodies.length} clues…`);
        const extracted = dedupeSubs(await extractSubsWithAI(dedupedBodies));
        if (extracted.length === 0) {
          setError(`AI analyzed ${bodies.length} emails but found no subscriptions. Checked ${messages.length} inbox matches total. Try adding manually or check if your subscription emails are in a different folder.`);
        }
        scanningRef.current = false; clearTimeout(timeout); setScannedItems(extracted); setScanning(false); setScanStatus("");
      };

      const stored = getStoredToken();
      if (stored) {
        try {
          await initGapiClient(stored);
          setScanStatus("Searching for clues…");
          const messages = await searchSubscriptionEmails(stored);
          if (messages.length === 0) {
            setScannedItems([]);
            setError("No clues found — your inbox is clean. Try adding manually.");
            clearTimeout(timeout); setScanning(false); setScanStatus("");
            return;
          }
          setScanStatus(`Examining ${Math.min(messages.length, 35)} pieces of evidence…`);
          const bodies: { text: string; trialEnd: string }[] = [];
          for (const msg of messages.slice(0, 35)) { const body = await getEmailBody(stored, msg.id); if (body.text) bodies.push(body); }
          const dedupedBodies = dedupeBodiesBySender(bodies);
          setScanStatus(`The inspector is analyzing ${dedupedBodies.length} clues…`);
          const extracted = dedupeSubs(await extractSubsWithAI(dedupedBodies));
          if (extracted.length === 0) {
            setError(`AI analyzed ${bodies.length} emails but found no subscriptions. Checked ${messages.length} inbox matches total. Try adding manually.`);
          }
          scanningRef.current = false; clearTimeout(timeout); setScannedItems(extracted); setScanning(false); setScanStatus("");
          return;
        } catch {
          scanningRef.current = false;
          clearTimeout(timeout);
          setError("Session expired. Please re-authorize Gmail access.");
          setScanning(false);
          setScanStatus("");
        }
      }
      // Show trust modal first, then redirect
      setShowTrustModal(true);
    } catch (e: any) { scanningRef.current = false; clearTimeout(timeout); setError(e.message || "Connection failed."); setScanning(false); }
  }, []);

  const confirmScanned = useCallback(async (item: ScannedSub, idx: number) => {
    if (hasDuplicate(subs, item.name)) {
      setError(`"${item.name}" is already on your list.`);
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (await openPaywallIfNeeded()) return;
    const nextDate = item.trialEnd
      ? item.trialEnd
      : new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const sub: Subscription = {
      id: uuid(), name: item.name, amount: item.amount, cycle: item.cycle,
      nextDate,
      createdAt: new Date().toISOString(),
      ...(item.isTrial ? { isTrial: true, trialEnd: item.trialEnd || undefined } : {}),
    };
    const updated = [...subs, sub]; setSubs(updated); saveSubs(updated);
    setScannedItems((prev) => prev.filter((_, i) => i !== idx));
  }, [subs]);

  const dismissScanned = useCallback((idx: number) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const monthTotal = totalMonthly(subs);
  const [dismissedUrgent, setDismissedUrgent] = useState<string[]>([]);
  // 到期提醒:明天續費 或 今天/已過期(試用除外——試用有專屬卡)
  const urgentSubs = subs.filter(s => !s.isTrial && daysUntil(s.nextDate) <= 1);
  // 橫幅排隊:一次只顯示最急的一塊(trial 明天扣錢 > urgent 明天扣錢 > 追債 > 週檢)
  const bannerPriority = trialAlert ? 'trial'
    : urgentSubs.filter(s => !dismissedUrgent.includes(s.id)).length > 0 ? 'urgent'
    : pendingProofs.length > 0 ? 'proof'
    : showWeekly ? 'weekly'
    : null;


  if (!mounted) return null;

  return (
    <>
      <Script src="https://apis.google.com/js/api.js" />
      <Script src="https://accounts.google.com/gsi/client" />

      {/* Renewal alert banner(僅當它是最高優先級) */}
      {bannerPriority === 'urgent' && urgentSubs.filter(s => !dismissedUrgent.includes(s.id)).map(s => (
        <motion.div
          key={s.id}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-[var(--text)] text-[var(--bg)] px-6 py-5 animate-slide-down"
        >
          <div className="max-w-md mx-auto px-1 py-1">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--text-on-card-strong)] mb-0.5">
                {daysUntil(s.nextDate) === 1 ? 'Renews tomorrow' : 'Due today'}
              </p>
                <p className="text-[17px] font-semibold truncate">{s.name}</p>
              </div>
              <span className="text-[15px] font-bold text-[var(--text-on-card-strong)] flex-shrink-0">{fmtCurrency(s.amount)}</span>
            </div>
            <button
              onClick={() => {
                savePendingCancel({ subId: s.id, name: s.name, timestamp: Date.now() });
                const cancelSlug = cancelSlugFor(s.name);
                if (cancelSlug) {
                  // 有教學頁 → 跳對應教學頁
                  if (isNativeApp()) {
                    // App 內部伺服器對「乾淨目錄路徑」會回傳首頁 HTML——必須帶 index.html 顯式
                    window.location.href = `/cancel/${cancelSlug}/index.html`;
                  } else {
                    window.open(`/cancel/${cancelSlug}`, '_blank');
                  }
                } else {
                  // 無教學頁 → 直接進取消證明流程(上傳截圖)
                  openProofFlow(s);
                }
              }}
              className="w-full bg-[var(--red)] text-[var(--bg)] text-[14px] font-semibold py-2.5 rounded-full active:scale-95 transition-transform cursor-pointer"
            >
              Cancel now
            </button>
            <button onClick={() => setDismissedUrgent(p => [...p, s.id])} className="text-[var(--text-tertiary)] hover:text-[var(--text)] text-lg">&times;</button>
          </div>
        </motion.div>
      ))}

      {/* Cancel confirmation follow-up */}
      {followUpCancel && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-[var(--amber-dim)] px-6 py-5"
        >
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <p className="text-[14px] font-medium text-[var(--amber)]">
              Did you cancel {followUpCancel.name}?
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  // 「已取消」不再是隨口一說：先開證據流程，交完截圖證明才算數
                  const sub = subs.find(s => s.id === followUpCancel.subId);
                  if (sub) { setFollowUpCancel(null); openProofFlow(sub); }
                  else { deleteSub(followUpCancel.subId); clearPendingCancel(followUpCancel.subId); setFollowUpCancel(null); }
                }}
                className="bg-[var(--amber)] text-[var(--bg)] text-[13px] font-semibold px-3 py-1.5 rounded-full active:scale-95"
              >
                Yes, done
              </button>
              <button
                onClick={() => {
                  clearPendingCancel(followUpCancel.subId);
                  setFollowUpCancel(null);
                }}
                className="text-[var(--amber)] text-[13px] px-3 py-1.5 rounded-full active:scale-95"
              >
                Not yet
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <main className="min-h-screen max-w-md mx-auto px-6 py-8 animate-fade-in">
        {/* 偵探等級:一行小徽章,點進檔案頁 */}
        {detective.cases > 0 && (
          <Link
            href="/report"
            className="flex items-center justify-center gap-1.5 mb-6 animate-slide-down group"
          >
            <svg className="w-3.5 h-3.5 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z" />
            </svg>
            <span className="text-[12px] font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text)] transition-colors">
              {detectiveRank(detective.cases).title} · {detective.cases} case{detective.cases > 1 ? 's' : ''} · {detective.streak} streak
            </span>
            <svg className="w-3 h-3 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
          </Link>
        )}
        {/* Lifetime savings */}
        {lifetimeSavings() > 0 && (
          <div className="text-center mb-8">
            <p className="text-[12px] text-[var(--text-secondary)] uppercase tracking-[0.05em]">Lifetime saved</p>
            <AnimatedNumber value={lifetimeSavings()} className="text-[28px] font-extrabold tracking-[-0.02em] text-[var(--green)]" />
            <button
              onClick={async () => {
                if (shareBusy) return;
                setShareBusy(true);
                const url = await drawShareCard({
                  cases: detective.cases,
                  streak: detective.streak,
                  recovered: lifetimeSavings(),
                  closed: getCancelled().map(c => ({ name: c.name, amount: c.amount, cycle: c.cycle })),
                });
                setShareBusy(false);
                if (url) setShareImg(url);
              }}
              className="text-[12px] text-[var(--text-secondary)] underline hover:text-[var(--text)] mt-1"
            >
              {shareBusy ? "Generating…" : "Share your savings"}
            </button>
          </div>
        )}

        {/* Celebration toast */}
        <AnimatePresence>
          {celebration && (
            <motion.div
              initial={{ y: -50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-[var(--text)] text-[var(--bg)] rounded-3xl px-6 py-5 shadow-2xl"
            >
              <div className="flex items-center gap-4">
                <motion.span
                  className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/15 flex-shrink-0"
                  initial={{ rotate: -20, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                >
                  {/* 徽章:圓形 + 星形 */}
                  <svg className="w-6 h-6 text-[var(--brand-strong)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z" />
                  </svg>
                </motion.span>
                <div className="flex-1">
                  <p className="text-[12px] font-black tracking-[0.14em] text-[var(--brand-strong)]">
                    CASE #{celebration.caseNo} CLOSED
                  </p>
                  <p className="text-[16px] font-semibold mt-0.5">
                    {celebration.name} — saved {fmtCurrency(celebration.cycle === 'yearly' ? celebration.amount : celebration.amount * 12)}/year
                  </p>
                  {celebration.rankUp && (
                    <p className="text-[12px] font-bold text-[var(--brand-strong)] mt-1 animate-pop-in">
                      ★ PROMOTED TO {celebration.rankTitle.toUpperCase()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/" className="nav-link inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            Home
          </Link>
          <div className="flex items-center gap-2">
            {!pro && (
              <span className="text-[12px] text-[var(--text-secondary)]">{subs.length}/{FREE_LIMIT} free</span>
            )}
            {!pro && <Link href="/pricing" className="text-[12px] font-semibold text-[var(--bg)] bg-[var(--brand)] hover:bg-[var(--brand-strong)] px-3 py-1.5 rounded-full transition-colors">Get Pro</Link>}
            {pro && <span className="text-[12px] font-semibold text-[var(--green)]">PRO</span>}
            <button onClick={async () => { if (await openPaywallIfNeeded()) return; setShowAdd(true); }} className="bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] active:scale-95 transition-all duration-200 text-[15px] font-medium px-4 py-2 rounded-full">
              + Add
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="text-center mb-10">
          <p className="text-[13px] font-medium text-[var(--text-secondary)] uppercase tracking-[0.05em] mb-2">Monthly spend</p>
          <motion.p
            className="text-[48px] font-extrabold tracking-[-0.03em] text-transparent bg-clip-text bg-gradient-to-b from-[var(--brand)] to-[var(--brand-strong)]"
            key={monthTotal.toFixed(2)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {fmtCurrency(monthTotal)}
          </motion.p>
          {subs.length > 0 && (
            <p className="text-[14px] text-[var(--text-secondary)] mt-1 animate-slide-down">{subs.length} subscription{subs.length > 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Gmail scan — empty state */}
        {subs.length === 0 && scannedItems.length === 0 && !scanning && (
          <button onClick={() => { buzz(30); handleGmailScan(); }} disabled={!googleReady} className="btn-primary w-full text-[17px] font-semibold py-4 mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            {googleReady ? "Connect Gmail to find subscriptions" : "Loading…"}
          </button>
        )}

        {/* Scanning */}
        {scanning && (
          <div className="text-center py-12 animate-scale-in">
            {/* Animated envelope icon */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              {/* Outer ring pulsing */}
              <div className="absolute inset-0 rounded-full border-2 border-[var(--divider)] animate-pulse" />
              {/* Envelope */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-10 h-10">
                  <svg className="w-10 h-10 text-[var(--text)] envelope-float" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {/* Scanning line */}
                  <div className="scan-line" />
                </div>
              </div>
            </div>
            <p className="text-[17px] font-semibold mb-2">{scanStatus || "Investigating your inbox"}</p>
            {/* Animated dots */}
            <div className="flex items-center justify-center gap-1.5 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--text)] dot-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--text)] dot-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--text)] dot-pulse" />
            </div>
            <p className="text-[14px] text-[var(--text-secondary)]">We never store your emails. This stays on your device.</p>
          </div>
        )}

        {/* Error */}
        {error && !scanning && (
          <div className="card bg-[var(--red-dim)] border-[var(--red)] mb-6 text-[14px] text-[var(--red)]">
            <p className="mb-2">{error}</p>
            <div className="flex gap-2">
              {/re-authorize|Session expired/i.test(error) && (
                <button onClick={handleGmailScan} className="bg-[var(--red)] text-[var(--bg)] text-[13px] font-medium px-4 py-2 rounded-full active:scale-95 transition-transform">Reconnect Gmail</button>
              )}
              <button onClick={() => setError("")} className="text-[13px] font-medium underline">Dismiss</button>
            </div>
          </div>
        )}

        {/* Scanned items — 線索板 */}
        {scannedItems.length > 0 && (
          <div className="mb-8 animate-slide-down">
            <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.05em] mb-3">New clues found</h2>
            <div className="evidence-board stagger-item">
              {scannedItems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20, scale: 0.9, rotate: i % 2 === 0 ? -6 : 6 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: i % 2 === 0 ? -1.5 : 1.5 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 350, damping: 20 }}
                  className={`relative card flex items-center justify-between gap-3 py-4 px-5 mb-2.5 ${item.isTrial ? 'border-[var(--amber)] bg-[var(--amber-dim)]' : ''}`}
                >
                  {/* 圖釘 */}
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[var(--text-secondary)] to-[var(--text-tertiary)] shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                  {/* NEW CLUE 標籤 */}
                  <span className="absolute top-2 right-3 text-[9px] font-black tracking-[0.12em] text-[var(--brand)]">NEW CLUE</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-[15px] font-semibold">{item.name}</div>
                      {item.isTrial && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--amber-dim)] text-[var(--amber)]">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Free trial
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-[var(--text-secondary)]">
                      {item.isTrial ? (
                        <>
                          {item.amount > 0 ? `${fmtCurrency(item.amount)}/${item.cycle} after trial` : 'Amount unknown'}
                          {item.trialEnd && <span className="ml-1">· Ends {new Date(item.trialEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        </>
                      ) : (
                        <>{item.amount > 0 ? fmtCurrency(item.amount) + '/' + item.cycle : 'Amount unknown'}</>
                      )}
                      {item.confidence === 'low' && !item.isTrial && (
                        <span className="inline-flex items-center gap-1 ml-2 text-[var(--amber)]">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                          Low confidence
                        </span>
                      )}
                    </div>
                    {item.source && (
                      <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate max-w-[200px]">{item.source}</div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => dismissScanned(i)} className="bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] active:scale-95 transition-all duration-150 text-[14px] font-medium px-4 py-2 rounded-full">Skip</button>
                    <button onClick={() => confirmScanned(item, i)} className={`active:scale-95 transition-all duration-150 text-[var(--bg)] text-[14px] font-medium px-4 py-2 rounded-full ${item.isTrial ? 'bg-[var(--amber)] hover:bg-[#e68f00]' : 'bg-[var(--text)] hover:bg-[var(--bg-hover)]'}`}>Add</button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        {subs.length > 0 && (
          <div className="animate-slide-down">
            {/* Trial expiring banner */}
            <AnimatePresence>
              {bannerPriority === 'trial' && trialAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="card bg-[var(--amber-dim)] border border-[var(--amber)] mb-6"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-[15px] font-semibold text-[var(--text)]">
                      {daysUntil(trialAlert.nextDate) === 0
                        ? `Today: ${trialAlert.name} free trial ends`
                        : `${trialAlert.name} trial ended — you may have been charged`}
                    </p>
                    <button
                      onClick={() => { buzz(10); dismissTrialAlert(); }}
                      className="text-[var(--text-secondary)] hover:text-[var(--text)] text-lg w-7 h-7 rounded-full hover:bg-[var(--amber-dim)] flex items-center justify-center flex-shrink-0"
                    >&times;</button>
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
                    {daysUntil(trialAlert.nextDate) === 0
                      ? `It will auto-charge ${fmtCurrency(trialAlert.amount)} today.`
                      : `You may have been charged ${fmtCurrency(trialAlert.amount)}. Keep it or cancel?`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { buzz(15); keepTrial(); }}
                      className="flex-1 bg-[var(--amber-dim)] hover:bg-[var(--amber-dim)] active:scale-95 transition-all duration-150 text-[var(--amber)] text-[13px] font-medium py-2.5 rounded-full"
                    >
                      Keep it
                    </button>
                    <Link
                      href={isNativeApp() ? (trialAlert.slug ? `/cancel/${trialAlert.slug}/index.html` : "/cancel/index.html") : (trialAlert.slug ? `/cancel/${trialAlert.slug}` : "/cancel")}
                      className="flex-1 bg-[var(--amber)] hover:bg-[#e68f00] active:scale-95 transition-all duration-150 text-[var(--bg)] text-[13px] font-medium py-2.5 rounded-full text-center"
                    >
                      Cancel it
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Weekly checkup banner */}
            <AnimatePresence>
              {bannerPriority === 'weekly' && showWeekly && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="card bg-[var(--green-dim)] mb-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold text-[var(--text)] mb-1">Weekly subscription checkup</p>
                      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                        You have {subs.length} active subscriptions totaling {fmtCurrency(monthTotal)}/mo. Still need all of them?
                      </p>
                    </div>
                    <button
                      onClick={() => { setShowWeekly(false); localStorage.setItem("oopssubs_weekly_check", String(Date.now())); }}
                      className="flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--text)] text-lg"
                    >&times;</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 未交取消證據的追債提醒：天數越高動效越煩人，直到交證據 */}
            {bannerPriority === 'proof' && pendingProofs.map((p) => {
              const sub = subs.find(s => s.id === p.subId);
              if (!sub) return null;
              return <DebtCard key={p.subId} p={p} onOpen={() => openProofFlow(sub)} />;
            })}

            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.05em]">Your subscriptions</h2>
              <button onClick={() => { buzz(15); handleGmailScan(); }} disabled={scanning} className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] font-medium transition-colors">Scan again</button>
            </div>
            <div className="card p-0 overflow-hidden">
              {subs.sort((a, b) => daysUntil(a.nextDate) - daysUntil(b.nextDate)).map((sub, i) => (
                <SwipeableRow
                  key={sub.id}
                  index={i}
                  last={i === subs.length - 1}
                  hint={swipeHint && i === 0}
                  leaving={leaving === sub.id}
                  onHintShown={() => setSwipeHint(false)}
                  onCancel={() => { buzz(15); openProofFlow(sub); }}
                >
                  <SubscriptionRow
                    sub={sub}
                    onDelete={() => openProofFlow(sub)}
                    onCalError={(m) => { setError(m); setTimeout(() => setError(""), 4000); }}
                  />
                </SwipeableRow>
              ))}
            </div>
            {/* Subtle Gmail prompt — only when user has subs but no Gmail */}
            {!getStoredToken() && subs.length >= 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card mt-6 text-center py-6"
              >
                <p className="text-[14px] text-[var(--text-secondary)] mb-3">Got more subscriptions? Let Gmail find them automatically.</p>
                <button onClick={() => { buzz(15); handleGmailScan(); }} className="btn-secondary text-[15px] py-3 px-6">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                  Connect Gmail
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* 已取消清單（有證據的顯示迴紋針圖示，點開可回看截圖） */}
        {getCancelled().length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.05em]">Cancelled</h2>
              <span className="text-[12px] text-[var(--text-tertiary)] inline-flex items-center gap-1">
                with proof
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </span>
            </div>
            <div className="card p-0 overflow-hidden">
              {getCancelled().slice().reverse().map((c, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-5 py-3.5 ${i !== getCancelled().length - 1 ? 'border-b border-[var(--divider)]' : ''}`}
                >
                  <div>
                    <p className="text-[15px] font-medium text-[var(--text)]">{c.name}</p>
                    <p className="text-[12px] text-[var(--text-secondary)]">{fmtCurrency(c.cycle === 'yearly' ? c.amount : c.amount * 12)}/yr</p>
                  </div>
                  {c.proof ? (
                    <button
                      onClick={() => viewProof(c)}
                      className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)] transition-colors active:scale-95"
                      title="View cancellation proof"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                      </svg>
                    </button>
                  ) : (
                    <svg className="w-5 h-5 text-[var(--text-tertiary)] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 取消證據流程（Cancel proof）— 全屏 */}
        <AnimatePresence>
          {proof && (
            <div className="fixed inset-0 z-[60] bg-[var(--bg)] flex flex-col animate-fade-in">
              <div className="flex items-center justify-between px-6 pt-6 pb-2 flex-shrink-0">
                <button onClick={closeProofFlow} className="text-[var(--text-secondary)] text-[26px] leading-none px-2 hover:text-[var(--text)] transition-colors" disabled={proof.stage === "done"}>&times;</button>
                <h2 className="text-[15px] font-semibold text-[var(--text)]">Cancel proof</h2>
                <div className="w-9" />
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-10">
                {proof.stage === "select" && (
                  <div className="text-center pt-6">
                    <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--amber-dim)] flex items-center justify-center">
                      <svg className="w-8 h-8 text-[var(--amber)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    </div>
                    <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)] mb-2">Prove it</h3>
                    <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-7 max-w-[280px] mx-auto">
                      {proof.sub.name} — {fmtCurrency(proof.sub.amount)}{proof.sub.cycle === 'monthly' ? '/mo' : proof.sub.cycle === 'yearly' ? '/yr' : '/qtr'}. Upload a screenshot showing it was cancelled.
                    </p>
                    {proof.image ? (
                      <div className="card p-3 mb-6">
                        <img src={proof.image} alt="Screenshot preview" className="w-full max-h-80 object-contain rounded-xl bg-[var(--bg-elevated)]" />
                      </div>
                    ) : (
                      <div className="h-44 rounded-2xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center mb-6 bg-[var(--bg-elevated)]">
                        <svg className="w-8 h-8 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <p className="text-[13px] mt-2">No screenshot yet</p>
                      </div>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} className="btn-primary text-[16px] font-semibold py-4 w-full mb-3">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Choose screenshot
                    </button>
                    <button
                      onClick={() => setProof(p => (p ? { ...p, stage: "audio" } : p))}
                      className="btn-secondary text-[16px] py-4 w-full"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                      Record testimony
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProofFile} />
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-5 leading-relaxed max-w-xs mx-auto">
                      Screenshots are checked by AI and stored only on this device. The cancellation reminder stays until proof is submitted.
                    </p>
                  </div>
                )}

                {proof.stage === "audio" && (
                  <div className="text-center pt-6">
                    <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--amber-dim)] flex items-center justify-center">
                      <svg className="w-8 h-8 text-[var(--amber)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)] mb-2">Give your testimony</h3>
                    <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-6 max-w-[300px] mx-auto">
                      Tell the court, in your own words, that you have cancelled <strong className="text-[var(--text)]">{proof.sub.name}</strong>. Speak clearly. The AI will judge your words.
                    </p>
                    {audioUrl ? (
                      <div className="card p-4 mb-6">
                        <p className="text-[12px] text-[var(--green)] font-semibold mb-2">✓ Testimony recorded</p>
                        <audio src={audioUrl} controls className="w-full" />
                      </div>
                    ) : (
                      <div className={`h-32 rounded-2xl border-2 border-dashed ${recording ? 'border-[var(--red)]' : 'border-[var(--border)]'} flex flex-col items-center justify-center mb-6 bg-[var(--bg-elevated)]`}>
                        {recording ? (
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1.5 mb-3">
                              <div className="w-2 h-2 rounded-full bg-[var(--red)] dot-pulse" />
                              <div className="w-2 h-2 rounded-full bg-[var(--red)] dot-pulse" />
                              <div className="w-2 h-2 rounded-full bg-[var(--red)] dot-pulse" />
                            </div>
                            <p className="text-[13px] text-[var(--red)] font-semibold">Recording… speak now</p>
                          </div>
                        ) : (
                          <p className="text-[13px] text-[var(--text-tertiary)]">No testimony recorded yet</p>
                        )}
                      </div>
                    )}
                    {!recording ? (
                      audioUrl ? (
                        <button onClick={submitAudio} className="btn-primary text-[16px] font-semibold py-4 w-full mb-3">
                          Submit testimony
                        </button>
                      ) : (
                        <button onClick={startRecording} className="btn-primary text-[16px] font-semibold py-4 w-full mb-3">
                          <span className="w-3 h-3 rounded-full bg-[var(--red)] inline-block mr-2" />
                          Start recording
                        </button>
                      )
                    ) : (
                      <button onClick={stopRecording} className="btn-secondary text-[16px] py-4 w-full mb-3">
                        Stop recording
                      </button>
                    )}
                    <button onClick={() => setProof(p => (p ? { ...p, stage: "select" } : p))} className="text-[13px] text-[var(--text-secondary)] underline">
                      Back to options
                    </button>
                  </div>
                )}

                {proof.stage === "reviewing" && (
                  <div className="pt-8">
                    {/* 偵探放大鏡掃描截圖 / 法庭聆聽 */}
                    <div className="relative mx-auto mb-8 w-full max-w-[280px] aspect-[4/3] rounded-2xl bg-[var(--bg-elevated)] overflow-hidden">
                      {proof.isAudio ? (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          <svg className="w-14 h-14 text-[var(--amber)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                          </svg>
                          <p className="text-[15px] font-semibold text-[var(--text)]">The court is listening…</p>
                          <div className="flex items-center justify-center gap-1.5 mt-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] dot-pulse" />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] dot-pulse" />
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--amber)] dot-pulse" />
                          </div>
                        </div>
                      ) : (
                        <>
                      {proof.image && <img src={proof.image} alt="Evidence" className="w-full h-full object-contain" />}
                      <motion.div
                        className="absolute"
                        style={{ left: "15%", top: "30%" }}
                        animate={{ x: [0, 110, 0], y: [10, -15, 10] }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {/* 鏡片：外圈陰影把畫面其他部分變暗，像真拿放大鏡在照 */}
                        <div
                          className="w-16 h-16 rounded-full border-[5px] border-[var(--text)] bg-white/10"
                          style={{ boxShadow: "0 0 0 9999px rgba(29,29,31,0.35)", marginLeft: -32, marginTop: -32 }}
                        />
                        {/* 鏡柄 */}
                        <div className="w-1.5 h-10 bg-[var(--text)] rounded-full" style={{ transform: "rotate(45deg)", transformOrigin: "top left" }} />
                      </motion.div>
                    </>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-[16px] font-semibold text-[var(--text)] mb-1">Inspector is examining your evidence…</p>
                      <p className="text-[13px] text-[var(--text-secondary)]">Looking for the {proof.sub.name} cancellation confirmation.</p>
                    </div>
                  </div>
                )}

                {proof.stage === "result" && (
                  proof.aiError || !proof.verdict?.aiAvailable ? (
                    <div className="text-center pt-10">
                      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center">
                        <svg className="w-8 h-8 text-[var(--amber)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                      </div>
                      <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)] mb-2">AI check unavailable</h3>
                      <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-7 max-w-[280px] mx-auto">
                        The inspector couldn&apos;t review your evidence right now. Cancellation requires AI verification — please try again in a moment.
                      </p>
                      <button onClick={retryProof} className="btn-primary text-[16px] font-semibold py-4 w-full mb-3">Retry with this screenshot</button>
                      <button onClick={() => setProof(p => (p ? { ...p, stage: "select", verdict: null, aiError: false, line: "", image: null } : p))} className="btn-secondary text-[16px] py-4 w-full">Choose another screenshot</button>
                    </div>
                  ) : proof.verdict.passed ? (
                    <div className="pt-6">
                      {/* 截圖 + APPROVED 印章歪蓋，蓋下瞬間畫面震一下 */}
                      <motion.div
                        className="relative card p-3 mb-6 overflow-hidden"
                        initial={{ x: 0 }}
                        animate={{ x: [0, -6, 6, -4, 4, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        {proof.image && <img src={proof.image} alt="Evidence" className="w-full max-h-80 object-contain rounded-xl bg-[var(--bg-elevated)]" />}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <motion.div
                            className="border-[5px] border-[var(--green)] text-[var(--green)] rounded-xl px-8 py-3 text-[24px] font-black tracking-[0.2em] rotate-[-12deg] bg-[var(--green-dim)]/50"
                            initial={{ scale: 2.5, opacity: 0, rotate: -18 }}
                            animate={{ scale: 1, opacity: 1, rotate: -12 }}
                            transition={{ type: "spring", stiffness: 400, damping: 14 }}
                          >
                            APPROVED
                          </motion.div>
                        </div>
                      </motion.div>
                      <div className="text-center">
                        <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)] mb-2">Case closed</h3>
                        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-2 max-w-[280px] mx-auto">{proof.line}</p>
                        {proof.isAudio && proof.verdict.transcript && (
                          <div className="card p-3 mb-3 text-left">
                            <p className="text-[10px] font-black tracking-[0.12em] text-[var(--text-tertiary)] uppercase mb-1">Transcript</p>
                            <p className="text-[13px] text-[var(--text)] italic">"{proof.verdict.transcript}"</p>
                          </div>
                        )}
                        {proof.verdict.reason && (
                          <p className="text-[12px] text-[var(--text-tertiary)] italic mb-7 max-w-[280px] mx-auto">— {proof.verdict.reason}</p>
                        )}
                      </div>
                      <button onClick={() => setProof(p => (p ? { ...p, verified: "ai", stage: "confirm" } : p))} className="btn-primary text-[16px] font-semibold py-4 w-full">Continue</button>
                    </div>
                  ) : (
                    <div className="pt-6">
                      {/* 截圖 + REJECTED 印章退回 */}
                      <motion.div
                        className="relative card p-3 mb-6 overflow-hidden"
                        initial={{ x: 0 }}
                        animate={{ x: [0, -6, 6, -4, 4, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        {proof.image && <img src={proof.image} alt="Evidence" className="w-full max-h-80 object-contain rounded-xl bg-[var(--bg-elevated)]" />}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <motion.div
                            className="border-[4px] border-[var(--red)] text-[var(--red)] rounded-xl px-8 py-3 text-[18px] font-black tracking-[0.08em] rotate-[8deg] bg-[var(--red-dim)]/50"
                            initial={{ scale: 2.5, opacity: 0, rotate: 14 }}
                            animate={{ scale: 1, opacity: 1, rotate: 8 }}
                            transition={{ type: "spring", stiffness: 400, damping: 14 }}
                          >
                            REJECTED
                          </motion.div>
                        </div>
                      </motion.div>
                      <div className="text-center">
                        <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)] mb-2">Evidence rejected</h3>
                        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed mb-2 max-w-[280px] mx-auto">{proof.line}</p>
                        {proof.verdict.reason && (
                          <p className="text-[12px] text-[var(--text-tertiary)] italic mb-7 max-w-[280px] mx-auto">— {proof.verdict.reason}</p>
                        )}
                      </div>
                      <button onClick={() => setProof(p => (p ? { ...p, stage: p.isAudio ? "audio" : "select", verdict: null, aiError: false, line: "", image: null, audio: null } : p))} className="btn-secondary text-[16px] py-4 w-full mb-3">
                        {proof.isAudio ? "Record again" : "Choose another screenshot"}
                      </button>
                      <p className="text-[12px] text-[var(--text-tertiary)] text-center">
                        {proof.isAudio ? "Speak more clearly and mention the service name. Or switch to a screenshot below." : "Cancellation requires approved evidence. Take a clearer screenshot of the cancellation page."}
                      </p>
                    </div>
                  )
                )}

                {proof.stage === "confirm" && (
                  <div className="pt-6">
                    <h3 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)] mb-1">Last step</h3>
                    <p className="text-[13px] text-[var(--text-secondary)] mb-6">Confirm all three before the hold button activates.</p>
                    <div className="card p-0 overflow-hidden mb-7">
                      {[
                        `This screenshot is from ${proof.sub.name}`,
                        "It shows the cancellation",
                        `I have cancelled ${proof.sub.name}`,
                      ].map((label, i) => (
                        <button
                          key={i}
                          onClick={() => setProof(p => (p ? { ...p, checks: p.checks.map((v, j) => (j === i ? !v : v)) as [boolean, boolean, boolean] } : p))}
                          className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left ${i !== 2 ? 'border-b border-[var(--divider)]' : ''}`}
                        >
                          <span className="text-[14px] text-[var(--text)]">{label}</span>
                          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[var(--bg)] text-[12px] flex-shrink-0 ${proof.checks[i] ? 'bg-[var(--green)] border-[var(--green)]' : 'border-[var(--border)]'}`}>
                            {proof.checks[i] ? '✓' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      disabled={!proof.checks.every(Boolean)}
                      onPointerDown={startHold}
                      onPointerUp={endHold}
                      onPointerLeave={endHold}
                      onPointerCancel={endHold}
                      className={`relative w-full py-5 rounded-2xl text-[var(--bg)] text-[16px] font-semibold overflow-hidden select-none active:scale-[0.99] transition-colors ${proof.checks.every(Boolean) ? 'bg-[var(--red)]' : 'bg-[var(--bg-active)]'}`}
                    >
                      <span className="relative z-10">
                        {!proof.checks.every(Boolean)
                          ? "Check all three to continue"
                          : proof.hold > 0
                            ? `Keep holding — ${Math.ceil((1 - proof.hold) * 3)}s`
                            : "Hold 3s to confirm cancellation"}
                      </span>
                      <span
                        className="absolute inset-y-0 left-0 bg-white/25"
                        style={{ width: `${proof.hold * 100}%` }}
                      />
                    </button>
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-4 text-center">
                      "This is a binding confirmation of your cancellation."
                    </p>
                  </div>
                )}

                {proof.stage === "done" && (
                  <div className="flex flex-col items-center pt-24">
                    <motion.div
                      initial={{ scale: 3, opacity: 0, rotate: -30 }}
                      animate={{ scale: 1, opacity: 1, rotate: -10 }}
                      transition={{ type: "spring", stiffness: 250, damping: 14 }}
                    >
                      <div className="border-4 border-[var(--red)] text-[var(--red)] rounded-xl px-10 py-4 text-[26px] font-black tracking-[0.2em] shadow-lg">
                        CANCELLED
                      </div>
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-[14px] text-[var(--text-secondary)] mt-6"
                    >
                      {proof.sub.name} is cancelled. Proof saved.
                    </motion.p>
                  </div>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* 證據檢視器：全屏回看取消截圖 */}
        <AnimatePresence>
          {proofViewer && (
            <motion.div
              className="fixed inset-0 z-[70] bg-black/95 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between px-6 pt-6 pb-3">
                <p className="text-[14px] font-semibold text-[var(--bg)]">Proof — {proofViewer.name}</p>
                <button onClick={() => setProofViewer(null)} className="text-[var(--text-secondary)] text-[26px] leading-none px-2 hover:text-[var(--text)] transition-colors">&times;</button>
              </div>
              <div className="flex-1 flex items-center justify-center px-4 pb-10 overflow-hidden">
                <img src={proofViewer.dataUrl} alt={`Cancellation proof for ${proofViewer.name}`} className="max-w-full max-h-full object-contain rounded-lg" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 分享卡預覽 */}
        <AnimatePresence>
          {shareImg && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
              <motion.div
                className="w-full max-w-sm"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
              >
                <img src={shareImg} alt="Your detective case report" className="w-full rounded-2xl shadow-2xl" />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={async () => {
                      if (!shareImg) return;
                      if (isNativeApp()) {
                        const res = await saveShareToPhotos(shareImg);
                        setShareSaved(res.ok ? "Saved to Photos ✓" : `Save failed: ${res.error || "unknown"}`);
                        setTimeout(() => setShareSaved(null), 3500);
                      } else {
                        // 網站版:觸發下載
                        const a = document.createElement("a");
                        a.href = shareImg;
                        a.download = "oopssubs-case-report.png";
                        a.click();
                        setShareSaved("Download started ✓");
                        setTimeout(() => setShareSaved(null), 2500);
                      }
                    }}
                    className="btn-gold flex-1 text-[13px] font-semibold py-3"
                  >
                    Save to Photos
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (isNativeApp()) {
                          // App 內:原生分享面板(先寫暫存檔)
                          await shareCardNative(shareImg);
                        } else {
                          // 網站版:Web Share API(帶圖片檔案)
                          const blob = await (await fetch(shareImg)).blob();
                          const file = new File([blob], "oopssubs-case-report.png", { type: "image/png" });
                          if (navigator.share) {
                            await navigator.share({ files: [file], title: "OopsSubs case report" });
                          }
                        }
                      } catch { /* 用戶取消 */ }
                    }}
                    className="btn-secondary flex-1 text-[13px] font-semibold py-3"
                  >
                    Share
                  </button>
                  <button
                    onClick={() => setShareImg(null)}
                    className="btn-secondary flex-1 text-[13px] font-semibold py-3"
                  >
                    Close
                  </button>
                </div>
                {shareSaved && (
                  <p className="text-[12px] text-[var(--green)] text-center mt-3">{shareSaved}</p>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add modal */}
        <AnimatePresence>
          {showAdd && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <motion.div
                className="sheet-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAdd(false)}
              />
              <motion.div
                className="sheet-content"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => { if (info.velocity.y > 500 || info.offset.y > 150) setShowAdd(false); }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-8 h-1 rounded-full bg-[var(--bg-active)] mx-auto mb-5" />
                <h3 className="text-[20px] font-extrabold tracking-[-0.02em] mb-1">File a report</h3>
                <p className="text-[13px] text-[var(--text-secondary)] mb-5">Report a service that's charging you</p>
                <div className="space-y-3">
                  <input className="input-apple" placeholder="Name of the suspect" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-[14px] text-[15px] text-[var(--text-tertiary)] font-medium">$</span>
                      <input className="input-apple pl-8" type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <select className="select-apple w-auto" value={form.cycle} onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value as any }))}>
                      <option value="monthly">/mo</option>
                      <option value="yearly">/yr</option>
                      <option value="quarterly">/qtr</option>
                    </select>
                  </div>
                  <input className="input-apple" type="date" value={form.nextDate} onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))} />
                  <label className="flex items-center gap-2.5 py-1 cursor-pointer select-none">
                    <input type="checkbox" checked={form.isTrial} onChange={(e) => setForm((f) => ({ ...f, isTrial: e.target.checked }))} className="w-4 h-4 accent-[var(--amber)]" />
                    <span className="text-[14px] text-[var(--text)] font-medium">This is a free trial</span>
                  </label>
                  {form.isTrial && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="text-[12px] text-[var(--text-secondary)] mb-1 block">Trial ends</label>
                        <input className="input-apple" type="date" value={form.trialEnd} onChange={(e) => setForm((f) => ({ ...f, trialEnd: e.target.value }))} />
                      </div>
                      <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">Amount above is charged after the trial ends.</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={addSub} className="btn-primary flex-1" disabled={!form.name || !form.amount || (form.isTrial && !form.trialEnd)}>File report</button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Trust modal — shown before Google OAuth redirect */}
        <AnimatePresence>
          {showTrustModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center">
              <motion.div className="sheet-backdrop" onClick={() => { setShowTrustModal(false); scanningRef.current = false; setScanning(false); setScanStatus(""); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              <motion.div
                className="sheet-content"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-8 h-1 rounded-full bg-[var(--bg-active)] mx-auto mb-5" />
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-[var(--text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                  </div>
                  <h3 className="text-[20px] font-extrabold tracking-[-0.02em] mb-2">One quick thing</h3>
                  <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                    Google will show a warning: <strong className="text-[var(--text)]">"Google hasn&apos;t verified this app"</strong>. This is standard for all new apps — our verification is in progress.
                  </p>
                </div>
                <div className="bg-[var(--bg-elevated)] rounded-2xl p-4 mb-6 space-y-3 text-[13px] text-[var(--text-secondary)]">
                  <div className="flex gap-3">
                    <span className="text-[var(--green)] flex-shrink-0">✓</span>
                    <span>OopsSubs only looks for subscription receipts. We <strong className="text-[var(--text)]">cannot modify, delete, or send</strong> emails.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[var(--green)] flex-shrink-0">✓</span>
                    <span>Your email content is processed <strong className="text-[var(--text)]">locally in your browser</strong>. Nothing is uploaded to any server.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[var(--green)] flex-shrink-0">✓</span>
                    <span>You can revoke access anytime at <strong className="text-[var(--text)]">myaccount.google.com/permissions</strong>.</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTrustModal(false);
                    // Now do the actual redirect
                    // Google 只認可已登記的網域（oopssubs.com），localhost 無法登記。
                    // App 內（localhost）透過 oopssubs.com/oauth-app 中轉，該頁會把
                    // token 透過 App 專屬通道（com.oopssubs.app://）跳回 App。
                    const redirectUri = isNativeApp()
                      ? "https://oopssubs.com/oauth-app"
                      : window.location.origin + "/app";
                    const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
                      "client_id=" + encodeURIComponent(CLIENT_ID) +
                      "&redirect_uri=" + encodeURIComponent(redirectUri) +
                      "&response_type=token" +
                      "&scope=" + encodeURIComponent(GMAIL_SCOPES) +
                      "&state=scan&prompt=consent";
                    if (isNativeApp()) {
                      // Google 封鎖 App 內嵌瀏覽器登入（安全政策）——App 必須跳出到
                      // 系統瀏覽器（Custom Tab）完成授權，再經 deep link 跳回。
                      Browser.open({ url: authUrl });
                    } else {
                      window.location.href = authUrl;
                    }
                  }}
                  className="btn-primary w-full text-[17px] font-semibold py-4"
                >
                  I understand — continue
                </button>
                <button
                  onClick={() => { setShowTrustModal(false); scanningRef.current = false; setScanning(false); setScanStatus(""); }}
                  className="text-[13px] text-[var(--text-secondary)] w-full text-center mt-3 py-2"
                >
                  Cancel
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Paywall modal */}
        <AnimatePresence>
          {showPaywall && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div className="sheet-backdrop" onClick={() => setShowPaywall(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              <motion.div
                className="relative bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[32px] p-8 w-full max-w-sm shadow-2xl"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <h3 className="text-[22px] font-extrabold tracking-[-0.02em] mb-2">You found {subs.length} subscriptions</h3>
                <p className="text-[15px] text-[var(--text-secondary)] mb-6">
                  The free version tracks up to {FREE_LIMIT}. Unlock unlimited tracking and all Pro features.
                </p>
                <div className="text-center mb-6">
                  <p className="text-[14px] text-[var(--text-secondary)] line-through">$19.99</p>
                  <p className="text-[36px] font-extrabold tracking-[-0.02em]">$9.99</p>
                  <p className="text-[13px] text-[var(--text-secondary)]">one-time · no subscription</p>
                </div>
                <button onClick={handleBuyPro} disabled={buying} className="btn-primary w-full mb-3 disabled:opacity-50">
                  {buying ? "Processing…" : "Get OopsSubs Pro — $9.99"}
                </button>
                {buyError && <p className="text-[13px] text-red-600 mb-3 text-center">{buyError}</p>}
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text)] w-full text-center mt-1 disabled:opacity-50"
                >
                  {restoring ? "Restoring…" : "Restore purchases"}
                </button>
                <button onClick={() => setShowPaywall(false)} className="text-[13px] text-[var(--text-secondary)] w-full text-center mt-2">Maybe later</button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      {/* 全局錯誤顯示:崩潰原因直接印出來 */}
      {fatalError && (
        <div className="fixed inset-0 z-[90] bg-[var(--bg)] flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <p className="text-[13px] text-[var(--red)] font-semibold mb-2">Something went wrong</p>
            <p className="text-[14px] text-[var(--text)] leading-relaxed break-all">{fatalError}</p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setFatalError(null)}
                className="btn-secondary flex-1"
              >
                Dismiss
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary flex-1"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </>
  );
}
