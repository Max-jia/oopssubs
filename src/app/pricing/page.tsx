"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { buyPro, isNativeApp } from "@/lib/purchases";
import { cancelGuides } from "@/data/cancel-guides";

export default function PricingPage() {
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [purchased, setPurchased] = useState(false);

  const handleBuy = async () => {
    setBuying(true); setBuyError("");
    const res = await buyPro();
    setBuying(false);
    if (res.ok) setPurchased(true);
    else if (!res.cancelled) setBuyError("Purchase failed. Please try again.");
  };

  return (
    <main className="min-h-screen max-w-md mx-auto px-6 py-12 animate-fade-in">
      <Link href="/" className="nav-link inline-flex items-center gap-1 mb-8">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Back
      </Link>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] mb-2">OopsSubs Pro</h1>
        <p className="text-[15px] text-[var(--text-secondary)] mb-8">One payment. Unlimited subscriptions. Forever.</p>

        {/* Price card */}
        <div className="card-elevated text-center mb-6">
          <p className="text-[14px] text-[var(--text-secondary)] line-through mb-1">$19.99</p>
          <p className="text-[48px] font-extrabold tracking-[-0.03em] mb-1 text-transparent bg-clip-text bg-gradient-to-b from-[var(--brand)] to-[var(--brand-strong)]">
            $9.99
          </p>
          <p className="text-[14px] text-[var(--text-secondary)] mb-6">one-time payment</p>

          <ul className="text-left space-y-3 mb-6 text-[15px]">
            {[
              "Unlimited subscription tracking",
              "Gmail auto-scan & detection",
              "Auto background scan for new subs",
              "Android Play Store subscription scanner",
              `Cancel guide for ${cancelGuides.length}+ services`,
              "Pre-filled cancel email templates",
              "Renewal alerts & calendar sync",
              "Lifetime savings tracker",
              "Free updates forever",
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg className="w-5 h-5 text-[var(--green)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                <span className="text-[var(--text)]">{f}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => { try { navigator.vibrate?.(30); } catch { /* noop */ } handleBuy(); }}
            disabled={buying}
            className="btn-primary w-full text-[17px] font-semibold py-4 disabled:opacity-50"
          >
            {buying ? "Processing…" : "Get OopsSubs Pro — $9.99"}
          </button>
          <p className="text-[12px] text-[var(--text-tertiary)] mt-3">Pay once. No subscription. No recurring fees.</p>
          {purchased && <p className="text-[13px] text-[var(--green)] mt-2">✓ Pro unlocked — enjoy unlimited subscriptions!</p>}
          {buyError && <p className="text-[13px] text-red-600 mt-2">{buyError}</p>}
        </div>

        {/* Trust */}
        <div className="card text-center text-[13px] text-[var(--text-secondary)] space-y-2">
          <p className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Secure payment via {isNativeApp() ? "Google Play" : "Stripe"}
          </p>
          <p className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            Your data stays on your device, always
          </p>
        </div>
      </motion.div>
    </main>
  );
}
