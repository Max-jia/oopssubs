"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// 偵探數據(與 app 頁共用邏輯)
const DETECTIVE_KEY = "oopssubs_detective";
const CANCELLED_KEY = "oopssubs_cancelled";

function getDetective() {
  try { return JSON.parse(localStorage.getItem(DETECTIVE_KEY) || '{"cases":0,"streak":0,"lastCaseAt":""}'); }
  catch { return { cases: 0, streak: 0, lastCaseAt: "" }; }
}
function rank(cases: number): { title: string; next: string | null; need: number; progress: number } {
  if (cases >= 30) return { title: "Chief Inspector", next: null, need: 30, progress: 1 };
  if (cases >= 15) return { title: "Inspector", next: "Chief Inspector", need: 30, progress: (cases - 15) / 15 };
  if (cases >= 5) return { title: "Detective", next: "Inspector", need: 15, progress: (cases - 5) / 10 };
  if (cases >= 1) return { title: "Junior Detective", next: "Detective", need: 5, progress: cases / 5 };
  return { title: "Cadet", next: "Junior Detective", need: 1, progress: 0 };
}
function getCancelled(): { name: string; amount: number; cycle: string; date: string }[] {
  try { return JSON.parse(localStorage.getItem(CANCELLED_KEY) || "[]"); }
  catch { return []; }
}
const fmt = (n: number) => "$" + n.toFixed(2);

export default function ReportPage() {
  const [det, setDet] = useState({ cases: 0, streak: 0 });
  const [cases, setCases] = useState<{ name: string; amount: number; cycle: string; date: string }[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDet(getDetective());
    setCases(getCancelled());
  }, []);

  const rankInfo = rank(det.cases);
  const totalRecovered = cases.reduce((sum, c) => sum + (c.cycle === "yearly" ? c.amount : c.amount * 12), 0);
  const mostExpensive = cases.length ? cases.reduce((a, b) => (b.cycle === "yearly" ? b.amount : b.amount * 12) > (a.cycle === "yearly" ? a.amount : a.amount * 12) ? b : a) : null;
  const recent = [...cases].reverse().slice(0, 5);

  const shareText = `My 2026 subscription case report\n` +
    `${rankInfo.title} · ${det.cases} case${det.cases !== 1 ? "s" : ""} closed · ${det.streak} streak\n` +
    `Recovered ${fmt(totalRecovered)}/year from forgotten subscriptions\n` +
    (mostExpensive ? `Toughest case: ${mostExpensive.name} (${fmt(mostExpensive.cycle === "yearly" ? mostExpensive.amount : mostExpensive.amount * 12)}/yr)\n` : "") +
    `Check yours → oopssubs.com`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <main className="min-h-screen max-w-md mx-auto px-6 py-8 animate-fade-in">
      <Link href="/app" className="nav-link inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Back
      </Link>

      {/* 報告標題 */}
      <div className="text-center mb-8">
        <p className="text-[11px] font-black tracking-[0.16em] text-[var(--brand)] uppercase mb-2">Case Report</p>
        <h1 className="text-[24px] font-extrabold tracking-[-0.02em] mb-1">Your subscription cases</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">{rankInfo.title}{rankInfo.next ? ` · next: ${rankInfo.next}` : " · top rank"}</p>
        {rankInfo.next && (
          <div className="mt-3 max-w-[240px] mx-auto">
            <div className="h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] transition-all duration-700"
                style={{ width: `${Math.round(rankInfo.progress * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
              {Math.max(0, rankInfo.need - det.cases)} more case{rankInfo.need - det.cases !== 1 ? 's' : ''} to {rankInfo.next}
            </p>
          </div>
        )}
      </div>

      {/* 統計卡 */}
      <div className="card mb-6">
        <div className="grid grid-cols-3 divide-x divide-[var(--divider)] text-center">
          <div className="px-2">
            <p className="text-[24px] font-extrabold text-[var(--text)]">{det.cases}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Cases closed</p>
          </div>
          <div className="px-2">
            <p className="text-[24px] font-extrabold text-[var(--text)]">{det.streak}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Streak</p>
          </div>
          <div className="px-2">
            <p className="text-[20px] font-extrabold text-[var(--green)]">{fmt(totalRecovered)}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Recovered/yr</p>
          </div>
        </div>
      </div>

      {/* 最貴的案子 */}
      {mostExpensive && (
        <div className="card mb-6">
          <p className="text-[11px] font-black tracking-[0.12em] text-[var(--amber)] uppercase mb-2">Toughest case</p>
          <p className="text-[16px] font-semibold">{mostExpensive.name}</p>
          <p className="text-[13px] text-[var(--text-secondary)]">{fmt(mostExpensive.cycle === "yearly" ? mostExpensive.amount : mostExpensive.amount * 12)}/year</p>
        </div>
      )}

      {/* 最近結案 */}
      <div className="card p-0 overflow-hidden mb-6">
        <p className="text-[11px] font-black tracking-[0.12em] text-[var(--text-secondary)] uppercase px-5 pt-4 pb-2">Recent cases</p>
        {recent.length === 0 && <p className="text-[13px] text-[var(--text-tertiary)] px-5 pb-4">No cases closed yet. Cancel a subscription to open your file.</p>}
        {recent.map((c, i) => (
          <div key={i} className={`flex items-center justify-between px-5 py-3 ${i !== recent.length - 1 ? 'border-b border-[var(--divider)]' : ''}`}>
            <div>
              <p className="text-[14px] font-medium">{c.name}</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">{new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </div>
            <span className="text-[11px] font-bold text-[var(--green)] px-2.5 py-1 rounded-full bg-[var(--green-dim)]">CLOSED</span>
          </div>
        ))}
      </div>

      {/* 分享 */}
      <button
        onClick={handleShare}
        className="btn-primary w-full mb-3"
      >
        {copied ? "Copied! Share anywhere ✓" : "Share case report"}
      </button>
      <p className="text-[12px] text-[var(--text-tertiary)] text-center">Share your report — friends will check their own subscriptions</p>
    </main>
  );
}
