"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { isNativeApp } from "@/lib/purchases";
import { cancelGuides } from "@/data/cancel-guides";

// Native app shell needs the file URL (its local server can't resolve clean routes);
// the website uses the clean route.
// SSR 期間偵測不到 App（伺服器端沒有 window），網址會先烘培成網頁版，
// 元件內會在 hydrate 後用 isNative 重算。
function appHref(action: string, isNative: boolean): string {
  return isNative ? `/app/index.html#action=${action}` : `/app/#action=${action}`;
}

const guides = [
  { slug: 'netflix', name: 'Netflix', difficulty: 'easy' as const },
  { slug: 'spotify', name: 'Spotify Premium', difficulty: 'easy' as const },
  { slug: 'amazon-prime', name: 'Amazon Prime', difficulty: 'medium' as const },
  { slug: 'hulu', name: 'Hulu', difficulty: 'easy' as const },
  { slug: 'disney-plus', name: 'Disney+', difficulty: 'easy' as const },
  { slug: 'youtube-premium', name: 'YouTube Premium', difficulty: 'easy' as const },
  { slug: 'hbo-max', name: 'Max (HBO)', difficulty: 'easy' as const },
  { slug: 'apple-music', name: 'Apple Music', difficulty: 'easy' as const },
  { slug: 'adobe-cc', name: 'Adobe CC', difficulty: 'hard' as const },
  { slug: 'nytimes', name: 'New York Times', difficulty: 'hard' as const },
  { slug: 'planet-fitness', name: 'Planet Fitness', difficulty: 'hard' as const },
  { slug: 'tinder-plus', name: 'Tinder', difficulty: 'medium' as const },
];

const iconPaths = {
  mail: <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />,
  plus: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />,
  sparkles: <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />,
};

export default function HomePage() {
  // App 偵測要等 Capacitor bridge 注入才可靠，先預設網頁版，載入後立即重算
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    setIsNative(isNativeApp());
  }, []);
  return (
    <main className="min-h-screen animate-fade-in">
      {/* Hero */}
      <div className="max-w-md mx-auto px-6 pt-20 pb-14 text-center">
        <motion.div
          className="mb-8"
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
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
        <h1 className="text-[14px] font-semibold text-[var(--text-secondary)] tracking-[0.02em] mb-4">
          OopsSubs
        </h1>
        <motion.h1
          className="text-[32px] font-extrabold tracking-[-0.02em] text-[var(--text)] mb-3 leading-[1.15]"
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Stop bleeding<br /><span className="text-transparent bg-clip-text bg-gradient-to-b from-[var(--brand)] to-[var(--brand-strong)]">on subscriptions</span>
        </motion.h1>
        <p className="text-[17px] text-[var(--text-secondary)] leading-relaxed mb-4 max-w-xs mx-auto">
          Find and cancel forgotten subscriptions<br />from your email inbox.
        </p>
        <motion.p
          className="text-[13px] text-[var(--text-tertiary)] mb-10 max-w-xs mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            No server. No database. Your data stays on your device.
          </span>
        </motion.p>
        <div className="flex flex-col gap-3 max-w-[280px] mx-auto">
          <motion.a
            href={appHref("manual", isNative)}
            className="btn-primary text-[17px] font-semibold py-4 w-full"
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
            Add subscriptions manually
          </motion.a>
          <motion.a
            href={appHref("scan", isNative)}
            className="btn-secondary text-[17px] py-4 w-full"
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
            Connect Gmail to scan
          </motion.a>
        </div>
        <motion.a
          href={appHref("list", isNative)}
          className="block text-center text-[13px] text-[var(--text-secondary)] mt-5 hover:text-[var(--text)] transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          View my subscriptions →
        </motion.a>
      </div>

      {/* Cancel guides section */}
      <div className="max-w-md mx-auto px-6 pb-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.05em]">Cancel guides</h2>
        </div>
        <div className="card overflow-hidden p-0">
          {guides.map((g, i) => (
            <Link
              key={g.slug}
              href={`/cancel/${g.slug}`}
              className={`flex items-center justify-between px-5 py-3.5 hover:bg-[var(--bg-elevated)] transition-colors duration-150 ${
                i !== guides.length - 1 ? 'border-b border-[var(--divider)]' : ''
              }`}
            >
              <span className="text-[15px] font-medium text-[var(--text)]">{g.name}</span>
              <span className={g.difficulty === 'easy' ? 'badge-easy' : g.difficulty === 'medium' ? 'badge-medium' : 'badge-hard'}>
                {g.difficulty === 'easy' ? 'Easy' : g.difficulty === 'medium' ? 'Medium' : 'Hard'}
              </span>
            </Link>
          ))}
        </div>
        <Link href="/cancel" className="block text-center text-[13px] text-[var(--text-secondary)] mt-5 hover:text-[var(--text)] transition-colors">
          View all {cancelGuides.length} services →
        </Link>
      </div>

      {/* Privacy trust block */}
      <div className="max-w-md mx-auto px-6 pb-14">
        <div className="card text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--green-dim)] mb-3">
            <svg className="w-5 h-5 text-[var(--green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--text)] mb-1">Private by design</h3>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            Your subscriptions and Gmail token live only on your phone. Nothing is stored, tracked, or uploaded.
          </p>
        </div>
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
