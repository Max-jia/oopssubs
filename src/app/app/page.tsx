"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Script from "next/script";

/* ── Types ── */
interface Subscription {
  id: string;
  name: string;
  amount: number;
  cycle: "monthly" | "yearly" | "quarterly";
  nextDate: string;
  createdAt: string;
}

interface ScannedSub {
  name: string;
  amount: number;
  cycle: "monthly" | "yearly";
  confidence: "high" | "low";
  isTrial?: boolean;
  trialEnd?: string; // YYYY-MM-DD
}

/* ── Helpers ── */
const STORAGE_KEY = "oopssubs_subs";
const TOKEN_KEY = "oopssubs_gmail_token";
const DEEPSEEK_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_KEY || "";

function uuid() { return crypto.randomUUID(); }
function loadSubs(): Subscription[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function saveSubs(subs: Subscription[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(subs)); }
function monthlyEquivalent(sub: Subscription): number {
  if (sub.cycle === "yearly") return sub.amount / 12;
  if (sub.cycle === "quarterly") return sub.amount / 3;
  return sub.amount;
}
function totalMonthly(subs: Subscription[]): number {
  return subs.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
}
function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - now.getTime()) / 86400000);
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
    const gapi = (window as any).gapi;
    if (!gapi) { reject(new Error("Google API not loaded yet. Try again.")); return; }
    (window as any).gapiInited = true;
    gapi.load("client", { callback: resolve });
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
  await (window as any).gapi.client.init({});
  (window as any).gapi.client.setToken({ access_token: token });
}

/* ── Step 1: Multi-angle search for maximum coverage ── */
const SUB_SEARCH_QUERIES = [
  // 1. Direct subscription keywords (title + body, Gmail q= searches both)
  '"subscription" OR "membership" OR "auto-renew" OR "recurring payment" newer_than:2y',
  // 2. Billing/receipt language — catches most subscription charge emails
  '("receipt" OR "invoice" OR "we charged" OR "has been charged" OR "payment confirmed" OR "thank you for your" OR "billing statement") newer_than:2y',
  // 3. Renewal/plan language
  '("your plan" OR "renewal" OR "renews on" OR "will renew" OR "monthly charge" OR "annual fee" OR "your next bill") newer_than:2y',
  // 4. Free trial language — critical! These are future charges
  '("free trial" OR "trial ends" OR "start your free" OR "cancel before" OR "trial period" OR "try it free") newer_than:2y',
  // 5. Common billing sender patterns
  'from:(noreply@ OR billing@ OR payments@ OR accounts@ OR no-reply@ OR donotreply@) newer_than:2y',
];

async function searchSubscriptionEmails(token: string): Promise<any[]> {
  const allMessages: any[] = [];
  const seen = new Set<string>();
  for (const query of SUB_SEARCH_QUERIES) {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      for (const msg of data.messages || []) {
        if (!seen.has(msg.id)) { seen.add(msg.id); allMessages.push(msg); }
      }
    } catch {}
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
function quickRegexExtract(text: string): ScannedSub | null {
  // Netflix
  const netflix = text.match(/Netflix.*?\$?(\d+\.?\d*)/i);
  if (netflix) return { name: "Netflix", amount: parseFloat(netflix[1]), cycle: "monthly", confidence: "high" };
  // Spotify
  const spotify = text.match(/Spotify.*?\$?(\d+\.?\d*)/i);
  if (spotify) return { name: "Spotify", amount: parseFloat(spotify[1]), cycle: "monthly", confidence: "high" };
  // Hulu
  const hulu = text.match(/Hulu.*?\$?(\d+\.?\d*) or (\d+\.?\d*)\/mo/i);
  if (hulu) {
    const amt = parseFloat(hulu[1] || hulu[2]);
    if (amt > 0) return { name: "Hulu", amount: amt, cycle: "monthly", confidence: "high" };
  }
  // Amazon Prime - detect membership fee
  const prime = text.match(/Prime.*?membership.*?\$?(\d+\.?\d*)/i);
  if (prime) return { name: "Amazon Prime", amount: parseFloat(prime[1]), cycle: "yearly", confidence: "medium" };
  // Generic: look for "$XX.XX/month" pattern
  const generic = text.match(/(\d+\.?\d*)\s*\/\s*(month|mo|year|yr)/i);
  if (generic) {
    const amt = parseFloat(generic[1]);
    const cycle = generic[2].startsWith("y") ? "yearly" : "monthly";
    if (amt >= 0.99 && amt <= 999) return { name: "Subscription", amount: amt, cycle: cycle as "monthly"|"yearly", confidence: "low" };
  }
  return null;
}

/* ── Step 4: AI extraction (improved prompt) ── */
async function extractSubsWithAI(bodies: { text: string; trialEnd: string }[]): Promise<ScannedSub[]> {
  // Quick regex pre-scan — catch obvious ones instantly
  const quickResults: ScannedSub[] = [];
  const remaining: { text: string; trialEnd: string }[] = [];
  for (const body of bodies) {
    const q = quickRegexExtract(body.text);
    if (q) {
      if (body.trialEnd) { q.isTrial = true; q.trialEnd = body.trialEnd; q.confidence = "medium"; }
      quickResults.push(q);
    } else {
      remaining.push(body);
    }
  }
  if (remaining.length === 0) {
    return quickResults;
  }

  const prompt = `You are analyzing emails to find subscriptions the user needs to manage.

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
    const aiResults: ScannedSub[] = JSON.parse(cleaned);
    return [...quickResults, ...aiResults];
  } catch {
    return quickResults;
  }
}

/* ── Step 4.5: Deduplicate by sender domain before AI, keep max 2 per sender ── */
function dedupeBodiesBySender(bodies: { text: string; trialEnd: string }[]): { text: string; trialEnd: string }[] {
  const byDomain = new Map<string, { text: string; trialEnd: string }[]>();
  for (const b of bodies) {
    const match = b.text.match(/From:\s*.*?@([^\s\n>]+)/i);
    const domain = match ? match[1].toLowerCase() : "unknown";
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    if (byDomain.get(domain)!.length < 2) byDomain.get(domain)!.push(b);
  }
  const result: { text: string; trialEnd: string }[] = [];
  for (const items of byDomain.values()) result.push(...items);
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
  return [...map.values()];
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

async function addToCalendar(sub: Subscription) {
  const token = getStoredToken();
  if (token) {
    // Try direct Google Calendar API first —
    const d = new Date(sub.nextDate + "T10:00:00");
    const end = new Date(d.getTime() + 3600000);
    try {
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
      if (res.ok) {
        return; // Success — event created directly, no download
      }
    } catch {}
  }
  // Fallback: download ICS file
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
}

/* ── Subscription Row ── */
function SubscriptionRow({ sub, onDelete }: { sub: Subscription; onDelete: () => void }) {
  const [addedToCal, setAddedToCal] = useState(false);
  const days = daysUntil(sub.nextDate);
  const urgency = days <= 3 ? "text-[#c62828] bg-[#ffebee]" : days <= 7 ? "text-[#e65100] bg-[#fff3e0]" : "text-[#86868b] bg-[#f5f5f7]";
  return (
    <div className="flex items-center justify-between py-3.5 px-5 hover:bg-[#f5f5f7]/50 transition-colors duration-150 group -mx-5 rounded-2xl">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-11 h-11 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-[15px] font-semibold text-[#1d1d1f] flex-shrink-0 shadow-sm">
          {sub.name[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-medium truncate">{sub.name}</div>
          <div className="text-[13px] text-[#86868b]">{fmtCurrency(sub.amount)}/{sub.cycle === 'monthly' ? 'mo' : sub.cycle === 'yearly' ? 'yr' : 'qtr'}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${urgency}`}>
          {days <= 0 ? "Due" : days === 1 ? "Tmrw" : `${days}d`}
        </span>
        <button
          onClick={() => { addToCalendar(sub); setAddedToCal(true); setTimeout(() => setAddedToCal(false), 2000); }}
          className="opacity-0 group-hover:opacity-100 text-[#aeaeb2] hover:text-[#1d1d1f] transition-all duration-200 text-xs w-6 h-6 rounded-full hover:bg-[#e8e8ed] flex items-center justify-center"
          title="Add to calendar"
        >
          {addedToCal ? (
            <svg className="w-4 h-4 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" /></svg>
          )}
        </button>
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-[#aeaeb2] hover:text-[#c62828] transition-all duration-200 text-lg leading-none w-6 h-6 rounded-full hover:bg-[#ffebee] flex items-center justify-center">&times;</button>
      </div>
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
  const [form, setForm] = useState({ name: "", amount: "", cycle: "monthly" as const, nextDate: "" });
  const [mounted, setMounted] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => { setSubs(loadSubs()); setMounted(true); }, []);

  // Wait for Google API scripts to fully load
  useEffect(() => {
    const check = setInterval(() => {
      if ((window as any).gapi) { setGoogleReady(true); clearInterval(check); }
    }, 200);
    return () => clearInterval(check);
  }, []);

  // Auto-trigger action from URL params (wait for GAPI to load first)
  useEffect(() => {
    if (!mounted) return;
    const url = new URL(window.location.href);
    const action = url.searchParams.get('action');
    if (action === 'scan') {
      // Wait for gapi to be available before triggering scan
      const waitForGapi = () => {
        if ((window as any).gapi) {
          handleGmailScan();
        } else {
          setTimeout(waitForGapi, 200);
        }
      };
      waitForGapi();
    } else if (action === 'manual') {
      setShowAdd(true);
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!mounted || subs.length === 0) return;
    subs.forEach((sub) => {
      const days = daysUntil(sub.nextDate);
      if (days === 3 || days === 1) {
        try { new Notification("OopsSubs", { body: `${sub.name} renews in ${days} day${days > 1 ? "s" : ""} — ${fmtCurrency(sub.amount)}`, icon: "/icon-192.png" }); } catch {}
      }
    });
  }, [subs, mounted]);

  const addSub = useCallback(() => {
    if (!form.name || !form.amount) return;
    const sub: Subscription = {
      id: uuid(), name: form.name.trim(), amount: parseFloat(form.amount),
      cycle: form.cycle, nextDate: form.nextDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    const updated = [...subs, sub];
    setSubs(updated); saveSubs(updated);
    setForm({ name: "", amount: "", cycle: "monthly", nextDate: "" }); setShowAdd(false);
  }, [form, subs]);

  const deleteSub = useCallback((id: string) => {
    const updated = subs.filter((s) => s.id !== id);
    setSubs(updated); saveSubs(updated);
  }, [subs]);

  const handleGmailScan = useCallback(async () => {
    setScanning(true); setError(""); setScanStatus(""); setScannedItems([]);
    try {
      await gapiInit(); const oauth2 = await gisInit();
      const tokenClient = oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: GMAIL_SCOPES,
        callback: async (resp: any) => {
          if (resp.error) { setError("Gmail access denied."); setScanning(false); setScanStatus(""); return; }
          const token = resp.access_token;
          localStorage.setItem(TOKEN_KEY, token); await initGapiClient(token);
          setScanStatus("Searching inbox...");
          const messages = await searchSubscriptionEmails(token);
          if (messages.length === 0) { setScannedItems([]); setError(`No subscription-related emails found in the last 2 years. Try adding manually.`); setScanning(false); setScanStatus(""); return; }
          setScanStatus(`Reading ${Math.min(messages.length, 25)} emails...`);
          const bodies: { text: string; trialEnd: string }[] = [];
          for (const msg of messages.slice(0, 25)) { const body = await getEmailBody(token, msg.id); if (body.text) bodies.push(body); }
          const dedupedBodies = dedupeBodiesBySender(bodies);
          setScanStatus(`AI analyzing ${dedupedBodies.length} emails...`);
          const extracted = dedupeSubs(await extractSubsWithAI(dedupedBodies));
          if (extracted.length === 0) {
            setError(`Scanned ${messages.length} emails but couldn't detect subscriptions. Try adding manually or check if your subscription emails are in a different folder.`);
          }
          setScannedItems(extracted); setScanning(false); setScanStatus("");
        },
      });
      const stored = getStoredToken();
      if (stored) {
        try {
          await initGapiClient(stored);
          setScanStatus("Searching inbox...");
          const messages = await searchSubscriptionEmails(stored);
          if (messages.length === 0) {
            setScannedItems([]);
            setError("No subscription-related emails found in the last 2 years. Try adding manually.");
            setScanning(false);
            return;
          }
          setScanStatus(`Reading ${Math.min(messages.length, 25)} emails...`);
          const bodies: { text: string; trialEnd: string }[] = [];
          for (const msg of messages.slice(0, 25)) { const body = await getEmailBody(stored, msg.id); if (body.text) bodies.push(body); }
          const dedupedBodies = dedupeBodiesBySender(bodies);
          setScanStatus(`AI analyzing ${dedupedBodies.length} emails...`);
          const extracted = dedupeSubs(await extractSubsWithAI(dedupedBodies));
          if (extracted.length === 0) {
            setError(`Scanned ${messages.length} emails but couldn't detect subscriptions. Try adding manually.`);
          }
          setScannedItems(extracted); setScanning(false); setScanStatus("");
          return;
        } catch {}
      }
      tokenClient.requestAccessToken();
    } catch (e: any) { setError(e.message || "Connection failed."); setScanning(false); }
  }, []);

  const confirmScanned = useCallback((item: ScannedSub, idx: number) => {
    const nextDate = item.trialEnd
      ? item.trialEnd
      : new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const sub: Subscription = {
      id: uuid(), name: item.name, amount: item.amount, cycle: item.cycle,
      nextDate,
      createdAt: new Date().toISOString(),
    };
    const updated = [...subs, sub]; setSubs(updated); saveSubs(updated);
    setScannedItems((prev) => prev.filter((_, i) => i !== idx));
  }, [subs]);

  const dismissScanned = useCallback((idx: number) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const monthTotal = totalMonthly(subs);

  if (!mounted) return null;

  return (
    <>
      <Script src="https://apis.google.com/js/api.js" />
      <Script src="https://accounts.google.com/gsi/client" />

      <main className="min-h-screen max-w-md mx-auto px-6 py-8 animate-fade-in">
        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/" className="nav-link inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            Home
          </Link>
          <button onClick={() => setShowAdd(true)} className="bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-95 transition-all duration-200 text-[15px] font-medium px-4 py-2 rounded-full">
            + Add
          </button>
        </div>

        {/* Total */}
        <div className="text-center mb-10">
          <p className="text-[13px] font-medium text-[#86868b] uppercase tracking-[0.05em] mb-2">Monthly spend</p>
          <p className="text-[48px] font-extrabold tracking-[-0.03em] counter animate-scale-in">
            {fmtCurrency(monthTotal)}
          </p>
          {subs.length > 0 && (
            <p className="text-[14px] text-[#86868b] mt-1 animate-slide-down">{subs.length} subscription{subs.length > 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Gmail scan — empty state */}
        {subs.length === 0 && scannedItems.length === 0 && !scanning && (
          <button onClick={handleGmailScan} disabled={!googleReady} className="btn-primary w-full text-[17px] font-semibold py-4 mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            {googleReady ? "Connect Gmail to find subscriptions" : "Loading…"}
          </button>
        )}

        {/* Scanning */}
        {scanning && (
          <div className="text-center py-16 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-[#86868b] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
            </div>
            <p className="text-[17px] font-semibold mb-1">{scanStatus || "Scanning your inbox"}</p>
            <p className="text-[14px] text-[#86868b]">We never store your emails. This stays on your device.</p>
          </div>
        )}

        {/* Error */}
        {error && !scanning && (
          <div className="card bg-[#ffebee] border-[#ffcdd2] mb-6 text-[14px] text-[#c62828] flex items-start gap-3">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="text-[13px] font-medium underline flex-shrink-0">Dismiss</button>
          </div>
        )}

        {/* Scanned items */}
        {scannedItems.length > 0 && (
          <div className="mb-8 animate-slide-down">
            <h2 className="text-[13px] font-semibold text-[#86868b] uppercase tracking-[0.05em] mb-3">Found in your inbox</h2>
            <div className="space-y-2 stagger-item">
              {scannedItems.map((item, i) => (
                <div key={i} className={`card flex items-center justify-between py-4 px-5 ${item.isTrial ? 'border-[#fff3e0] bg-[#fff8f0]' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-[15px] font-semibold">{item.name}</div>
                      {item.isTrial && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fff3e0] text-[#e65100]">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Free trial
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-[#86868b]">
                      {item.isTrial ? (
                        <>
                          {item.amount > 0 ? `${fmtCurrency(item.amount)}/${item.cycle} after trial` : 'Amount unknown'}
                          {item.trialEnd && <span className="ml-1">· Ends {new Date(item.trialEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        </>
                      ) : (
                        <>{item.amount > 0 ? fmtCurrency(item.amount) + '/' + item.cycle : 'Amount unknown'}</>
                      )}
                      {item.confidence === 'low' && !item.isTrial && (
                        <span className="inline-flex items-center gap-1 ml-2 text-[#e65100]">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                          Low confidence
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => dismissScanned(i)} className="bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-95 transition-all duration-150 text-[14px] font-medium px-4 py-2 rounded-full">Skip</button>
                    <button onClick={() => confirmScanned(item, i)} className={`active:scale-95 transition-all duration-150 text-white text-[14px] font-medium px-4 py-2 rounded-full ${item.isTrial ? 'bg-[#e65100] hover:bg-[#bf360c]' : 'bg-[#1d1d1f] hover:bg-[#3a3a3c]'}`}>Add</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List */}
        {subs.length > 0 && (
          <div className="animate-slide-down">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[13px] font-semibold text-[#86868b] uppercase tracking-[0.05em]">Your subscriptions</h2>
              <button onClick={handleGmailScan} disabled={scanning} className="text-[13px] text-[#86868b] hover:text-[#1d1d1f] font-medium transition-colors">Scan again</button>
            </div>
            <div className="card p-0 overflow-hidden">
              {subs.sort((a, b) => daysUntil(a.nextDate) - daysUntil(b.nextDate)).map((sub, i) => (
                <div key={sub.id} className={i !== subs.length - 1 ? 'border-b border-[#e5e5ea]' : ''}>
                  <SubscriptionRow sub={sub} onDelete={() => deleteSub(sub.id)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add modal */}
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="sheet-backdrop" onClick={() => setShowAdd(false)} />
            <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
              <div className="w-8 h-1 rounded-full bg-[#d2d2d7] mx-auto mb-5" />
              <h3 className="text-[20px] font-extrabold tracking-[-0.02em] mb-5">New subscription</h3>
              <div className="space-y-3">
                <input className="input-apple" placeholder="Service name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-[14px] text-[15px] text-[#aeaeb2] font-medium">$</span>
                    <input className="input-apple pl-8" type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <select className="select-apple w-auto" value={form.cycle} onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value as any }))}>
                    <option value="monthly">/mo</option>
                    <option value="yearly">/yr</option>
                    <option value="quarterly">/qtr</option>
                  </select>
                </div>
                <input className="input-apple" type="date" value={form.nextDate} onChange={(e) => setForm((f) => ({ ...f, nextDate: e.target.value }))} />
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={addSub} className="btn-primary flex-1" disabled={!form.name || !form.amount}>Add</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
