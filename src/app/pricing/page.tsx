"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function PricingPage() {
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
        <p className="text-[15px] text-[#86868b] mb-8">One payment. Unlimited subscriptions. Forever.</p>

        {/* Price card */}
        <div className="card-elevated text-center mb-6">
          <p className="text-[14px] text-[#86868b] line-through mb-1">$19.99</p>
          <p className="text-[48px] font-extrabold tracking-[-0.03em] mb-1">
            $9.99
          </p>
          <p className="text-[14px] text-[#86868b] mb-6">one-time payment</p>

          <ul className="text-left space-y-3 mb-6 text-[15px]">
            {[
              "Unlimited subscription tracking",
              "Gmail auto-scan & detection",
              "Auto background scan for new subs",
              "iOS App Store subscription scanner",
              "Android Play Store subscription scanner",
              "Cancel guide for 79+ services",
              "Pre-filled cancel email templates",
              "Renewal alerts & calendar sync",
              "Lifetime savings tracker",
              "Free updates forever",
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <svg className="w-5 h-5 text-[#2e7d32] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                <span className="text-[#1d1d1f]">{f}</span>
              </li>
            ))}
          </ul>

          <a
            href="https://buy.stripe.com/28EbJ0fOzaNDaZy6He3sI05"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full text-[17px] font-semibold py-4"
          >
            Get OopsSubs Pro — $9.99
          </a>
          <p className="text-[12px] text-[#aeaeb2] mt-3">Pay once. No subscription. No recurring fees.</p>
        </div>

        {/* Trust */}
        <div className="card text-center text-[13px] text-[#86868b] space-y-2">
          <p>🔒 Secure payment via Stripe</p>
          <p>💾 Your data stays on your device, always</p>
          <p>↩️ 7-day refund if it doesn&apos;t work for you. Email jiayongchun001@gmail.com</p>
        </div>
      </motion.div>
    </main>
  );
}
