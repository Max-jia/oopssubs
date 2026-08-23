"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { isNativeApp } from "@/lib/purchases";
import { enableRipple } from "@/lib/ripple";
import { Typewriter } from "@/lib/typewriter";

// Native app shell needs the file URL (its local server can't resolve clean routes);
// the website uses the clean route.
// SSR 期間偵測不到 App（伺服器端沒有 window），網址會先烘培成網頁版，
// 元件內會在 hydrate 後用 isNative 重算。
function appHref(action: string, isNative: boolean): string {
  return isNative ? `/app/index.html#action=${action}` : `/app/#action=${action}`;
}

const iconPaths = {
  mail: <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />,
  plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />,
  sparkles: <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />,
};

const CANCELLED_KEY = "oopssubs_cancelled";
const DETECTIVE_KEY = "oopssubs_detective";
function getClosedCases(): { name: string; amount: number; cycle: string; date: string }[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CANCELLED_KEY) || "[]"); }
  catch { return []; }
}
function getDetectiveCases(): number {
  if (typeof window === "undefined") return 0;
  try { return JSON.parse(localStorage.getItem(DETECTIVE_KEY) || "{}").cases || 0; }
  catch { return 0; }
}

export default function HomePage() {
  // App 偵測要等 Capacitor bridge 注入才可靠，先預設網頁版，載入後立即重算
  const [isNative, setIsNative] = useState(false);
  const [closedCases, setClosedCases] = useState<{ name: string; amount: number; cycle: string; date: string }[]>([]);
  const [detectiveCases, setDetectiveCases] = useState(0);
  const [taglineDone, setTaglineDone] = useState(false);
  const [subtitleDone, setSubtitleDone] = useState(false);
  useEffect(() => { enableRipple();
    setIsNative(isNativeApp());
    setClosedCases(getClosedCases().slice(-5).reverse());
    setDetectiveCases(getDetectiveCases());
  }, []);

  return (
    <main className="min-h-screen notebook-grid animate-fade-in overflow-x-hidden">
      {/* 結尾:有破案紀錄的用戶,CONFIDENTIAL 章蓋下落款;新用戶沒有案子,不蓋 */}
      {subtitleDone && detectiveCases > 0 && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 2.6, duration: 0.5 }}
        >
          <span className="stamp-in text-[34px] font-black tracking-[0.2em] text-[var(--red)] border-4 border-[var(--red)] rounded-xl px-6 py-3">
            CONFIDENTIAL
          </span>
        </motion.div>
      )}

      {/* Hero */}
      <div className="max-w-md mx-auto px-6 pt-20 pb-14 text-center">
        <motion.div
          className="mb-8 relative"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.25 }}
        >
          <motion.img
            src="/logo-gold.png"
            alt="OopsSubs logo"
            className="w-20 h-20 mx-auto"
            animate={{ scale: [1, 1.04, 1], y: [0, -4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ scale: 1.12, rotate: [0, -3, 3, 0], transition: { duration: 0.6 } }}
            whileTap={{ scale: 0.9 }}
          />
        </motion.div>
        <div className="relative mb-3 h-[72px]">
        <motion.div
          className="relative block w-full"
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h1 className="text-[30px] font-extrabold tracking-[-0.02em] text-[var(--text)] leading-[1.2] text-center">
            {taglineDone ? (
              <>
                Some subscriptions are<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-[var(--brand)] to-[var(--brand-strong)]">hiding from you.</span>
                <span className="sweep-light" />
              </>
            ) : (
              <Typewriter
                words={["Some", "subscriptions", "are", "hiding", "from", "you."]}
                wordSpeed={190}
                startDelay={400}
                onComplete={() => setTaglineDone(true)}
                className="text-[var(--text)]"
              />
            )}
          </h1>
        </motion.div>
        </div>
        {/* 副標題:大標題打完後,手電筒逐字照亮 → 停頓 → 金色命令式落款 */}
        <div className="h-[76px]">
        {taglineDone && (
          <motion.p
            className="text-[15px] text-[var(--text-secondary)] leading-relaxed mb-8 max-w-xs mx-auto"
            initial="hidden"
            animate="show"
            onAnimationComplete={() => setSubtitleDone(true)}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03, delayChildren: 0.5 } } }}
          >
            {"Your money is going somewhere… ".split("").map((ch, i) => (
              <motion.span
                key={i}
                variants={{ hidden: { opacity: 0.16 }, show: { opacity: 1 } }}
                className="inline-block"
              >
                {ch === " " ? " " : ch}
              </motion.span>
            ))}
            <motion.span
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { delay: 1.1, duration: 0.4 } },
              }}
              className="text-transparent bg-clip-text bg-gradient-to-b from-[var(--brand)] to-[var(--brand-strong)] font-semibold"
            >
              Find out.
            </motion.span>
          </motion.p>
        )}
        </div>

        {/* 證據牆:已破案案例(橫向滑動) */}
        <div className="h-[240px] flex flex-col justify-center">
        {subtitleDone && (
        <motion.div
          className="mb-8 text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[11px] font-black tracking-[0.14em] text-[var(--text-tertiary)] uppercase mb-3 px-1 text-center">Closed cases</p>
          <div className="relative">
            <span className="evidence-sweep" />
            <div className={closedCases.length <= 2 ? "flex gap-3 pb-2 px-1 snap-x justify-center" : "flex gap-3 overflow-x-auto pb-2 px-1 -mx-6 px-6 snap-x"}>
            {closedCases.length > 0 ? closedCases.map((c, i) => {
              const annual = c.cycle === 'yearly' ? c.amount : c.amount * 12;
              const caseNo = detectiveCases - i;
              return (
              <motion.div
                key={caseNo}
                initial={{ opacity: 0, y: 16, rotate: i % 2 === 0 ? -5 : 5 }}
                animate={{ opacity: 1, y: 0, rotate: i % 2 === 0 ? -1.5 : 1.5 }}
                transition={{ delay: 0.75 + i * 0.1, type: "spring", stiffness: 350, damping: 20 }}
                className="relative card w-[150px] flex-shrink-0 snap-start py-4"
              >
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-b from-[var(--text-secondary)] to-[var(--text-tertiary)] shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                <p className="text-[9px] font-black tracking-[0.12em] text-[var(--text-tertiary)] mb-1">CASE #{caseNo}</p>
                <p className="text-[14px] font-semibold truncate">{c.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-[var(--green)] font-semibold">${Math.round(annual)} recovered</span>
                  <span className="stamp-pulse text-[9px] font-black tracking-[0.1em] text-[var(--green)] border border-[var(--green)] rounded px-1.5 py-0.5 rotate-[-8deg]">
                    CLOSED
                  </span>
                </div>
              </motion.div>
              );
            }) : (
              /* 新用戶:空檔案牆 */
              <div className="card text-center py-6 px-6 mx-auto max-w-[290px]">
                <svg className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <p className="text-[13px] font-black tracking-[0.16em] text-[var(--text-tertiary)] uppercase mb-1.5">Case file: empty</p>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-3 max-w-[240px] mx-auto">
                  Your first case is waiting. Find a forgotten subscription and close it.
                </p>
                <Link
                  href={appHref("manual", isNative)}
                  className="inline-flex items-center min-h-[44px] text-[13px] font-semibold text-[var(--brand)] hover:text-[var(--brand-strong)] transition-colors"
                >
                  Open your first case →
                </Link>
              </div>
            )}
            </div>
          </div>
        </motion.div>
        )}
        </div>
        <div className="flex flex-col gap-3 max-w-[280px] mx-auto">
          <motion.a
            href={appHref("manual", isNative)}
            className="btn-gold text-[17px] font-semibold py-4 w-full"
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <motion.svg
              className="w-5 h-5"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              animate={{ rotate: [0, 90, 90, 0] }}
              transition={{ duration: 4, repeat: Infinity, times: [0, 0.1, 0.2, 0.3] }}
            >
              {iconPaths.plus}
            </motion.svg>
            File a report manually
          </motion.a>
          <motion.a
            href={appHref("scan", isNative)}
            className="btn-primary text-[17px] py-4 w-full"
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <motion.svg
              className="w-5 h-5"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {iconPaths.mail}
            </motion.svg>
            Search your inbox for clues
          </motion.a>
        </div>
        <motion.a
          href={appHref("list", isNative)}
          className="flex items-center justify-center min-h-[44px] text-center text-[13px] text-[var(--text-secondary)] mt-5 hover:text-[var(--text)] transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          View my subscriptions →
        </motion.a>
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto px-6 pb-10 text-center">
        <p className="text-[13px] text-[var(--text-secondary)] mb-2">OopsSubs — Find &amp; cancel forgotten subscriptions</p>
        <div className="space-x-4">
          <Link href="/pricing" className="nav-link">Pro</Link>
          <Link href="/privacy" className="nav-link">Privacy</Link>
          <Link href="/terms" className="nav-link">Terms</Link>
          <Link href="/cancel" className="nav-link">All guides</Link>
        </div>
      </div>
    </main>
  );
}
