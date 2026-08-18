"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { isNativeApp } from "@/lib/purchases";
import { enableRipple } from "@/lib/ripple";

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

export default function HomePage() {
  // App 偵測要等 Capacitor bridge 注入才可靠，先預設網頁版，載入後立即重算
  const [isNative, setIsNative] = useState(false);
  useEffect(() => { enableRipple();
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
        <motion.h1
          className="text-[32px] font-extrabold tracking-[-0.02em] text-[var(--text)] mb-10 leading-[1.15]"
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Stop bleeding<br /><span className="text-transparent bg-clip-text bg-gradient-to-b from-[var(--brand)] to-[var(--brand-strong)]">on subscriptions</span>
        </motion.h1>
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
