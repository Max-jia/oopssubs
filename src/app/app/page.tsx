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
const GMAIL_SCOPES = "https://www.googleapis.com/auth/gmail.readonly";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

function getStoredToken(): string | null { return localStorage.getItem(TOKEN_KEY); }

async function gapiInit(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).gapiInited) { resolve(); return; }
    (window as any).gapiInited = true;
    (window as any).gapi.load("client", { callback: resolve });
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

async function searchSubscriptionEmails(token: string): Promise<any[]> {
  const query = "subject:(receipt OR invoice OR subscription OR \"your plan\" OR renewed OR billing) newer_than:2y";
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=30`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.messages || [];
}

async function getEmailBody(token: string, msgId: string): Promise<string> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const parts = data.payload?.parts || [data.payload];
  let body = "";
  for (const p of parts) {
    if (p.mimeType === "text/plain" && p.body?.data) {
      body += atob(p.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    }
  }
  return body.slice(0, 3000);
}

async function extractSubsWithAI(bodies: string[]): Promise<ScannedSub[]> {
  const prompt = `You're a subscription detector. From the email bodies below, extract all subscription services the user is paying for. For each, return: service name, amount (number), cycle (monthly/yearly), confidence (high/low).

Rules:
- Look for recurring charges, not one-time purchases
- Ignore shipping confirmations, password resets, welcome emails without billing info
- If you see "free trial", the user is likely NOT paying yet — skip unless there's a charge amount
- Prefer exact dollar amounts from the email. If no amount found, mark confidence as "low"
- Common subscriptions: streaming (Netflix, Spotify, Hulu, Disney+, HBO, YouTube Premium, Apple Music, Peacock, Paramount+), software (Adobe, Notion, Dropbox, Google One, iCloud, Microsoft 365), memberships (Amazon Prime, Walmart+, Instacart, DoorDash), dating (Tinder, Bumble, Hinge), news (NYT, WSJ, WaPo, Substack), fitness (Planet Fitness, Peloton, ClassPass), gaming (Xbox, PlayStation Plus, Nintendo Online)

Respond with ONLY valid JSON:
[{"name":"Netflix","amount":15.99,"cycle":"monthly","confidence":"high"},...]

Email bodies:
${bodies.join("\n---EMAIL---\n")}`;

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({ model: "deepseek-v4-flash", messages: [{ role: "user", content: prompt }], temperature: 0, max_tokens: 2000 }),
  });
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "[]";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return []; }
}

/* ── Subscription Row ── */
function SubscriptionRow({ sub, onDelete }: { sub: Subscription; onDelete: () => void }) {
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
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-[#aeaeb2] hover:text-[#c62828] transition-all duration-200 text-lg leading-none w-6 h-6 rounded-full hover:bg-[#ffebee] flex items-center justify-center">&times;</button>
      </div>
    </div>
  );
}

/* ── Main App Page ── */
export default function AppPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedSub[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", amount: "", cycle: "monthly" as const, nextDate: "" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setSubs(loadSubs()); setMounted(true); }, []);

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
    setScanning(true); setError("");
    try {
      await gapiInit(); const oauth2 = await gisInit();
      const tokenClient = oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: GMAIL_SCOPES,
        callback: async (resp: any) => {
          if (resp.error) { setError("Gmail access denied."); setScanning(false); return; }
          const token = resp.access_token;
          localStorage.setItem(TOKEN_KEY, token); await initGapiClient(token);
          const messages = await searchSubscriptionEmails(token);
          if (messages.length === 0) { setScannedItems([]); setError("No subscription emails found. Try adding manually."); setScanning(false); return; }
          const bodies: string[] = [];
          for (const msg of messages.slice(0, 15)) { const body = await getEmailBody(token, msg.id); if (body) bodies.push(body); }
          const extracted = await extractSubsWithAI(bodies);
          setScannedItems(extracted); setScanning(false);
        },
      });
      const stored = getStoredToken();
      if (stored) {
        try {
          await initGapiClient(stored);
          const messages = await searchSubscriptionEmails(stored);
          if (messages.length > 0) {
            const bodies: string[] = [];
            for (const msg of messages.slice(0, 15)) { const body = await getEmailBody(stored, msg.id); if (body) bodies.push(body); }
            setScannedItems(await extractSubsWithAI(bodies)); setScanning(false);
            return;
          }
        } catch {}
      }
      tokenClient.requestAccessToken();
    } catch (e: any) { setError(e.message || "Connection failed."); setScanning(false); }
  }, []);

  const confirmScanned = useCallback((item: ScannedSub, idx: number) => {
    const sub: Subscription = {
      id: uuid(), name: item.name, amount: item.amount, cycle: item.cycle,
      nextDate: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
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
          <button onClick={handleGmailScan} className="btn-primary w-full text-[17px] font-semibold py-4 mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Connect Gmail to find subscriptions
          </button>
        )}

        {/* Scanning */}
        {scanning && (
          <div className="text-center py-16 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-[#86868b] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
            </div>
            <p className="text-[17px] font-semibold mb-1">Scanning your inbox</p>
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
                <div key={i} className="card flex items-center justify-between py-4 px-5">
                  <div>
                    <div className="text-[15px] font-semibold">{item.name}</div>
                    <div className="text-[13px] text-[#86868b]">
                      {item.amount > 0 ? fmtCurrency(item.amount) + '/' + item.cycle : 'Amount unknown'}
                      {item.confidence === 'low' && (
                        <span className="inline-flex items-center gap-1 ml-2 text-[#e65100]">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                          Low confidence
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => dismissScanned(i)} className="bg-[#f5f5f7] hover:bg-[#e8e8ed] active:scale-95 transition-all duration-150 text-[14px] font-medium px-4 py-2 rounded-full">Skip</button>
                    <button onClick={() => confirmScanned(item, i)} className="bg-[#1d1d1f] hover:bg-[#3a3a3c] active:scale-95 transition-all duration-150 text-white text-[14px] font-medium px-4 py-2 rounded-full">Add</button>
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
