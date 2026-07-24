"use client";

import Link from "next/link";
import { motion } from "framer-motion";

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
            src="/icon-512.png"
            alt="OopsSubs"
            className="w-20 h-20 mx-auto"
            animate={{ scale: [1, 1.04, 1], y: [0, -4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ scale: 1.12, rotate: [0, -3, 3, 0], transition: { duration: 0.6 } }}
            whileTap={{ scale: 0.9 }}
          />
        </motion.div>
        <motion.h1
          className="text-[32px] font-extrabold tracking-[-0.02em] text-[#1d1d1f] mb-3 leading-[1.15]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          Stop bleeding<br />on subscriptions
        </motion.h1>
        <motion.p
          className="text-[17px] text-[#86868b] leading-relaxed mb-10 max-w-xs mx-auto"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
        >
          Connect your email. See everything you&apos;re paying for. Cancel what you don&apos;t need. Nothing stored on a server.
        </motion.p>
        <div className="flex flex-col gap-3 max-w-[280px] mx-auto">
          <motion.a
            href="/app?action=scan"
            className="btn-primary text-[17px] font-semibold py-4 w-full"
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
          <motion.a
            href="/app?action=manual"
            className="btn-secondary text-[17px] py-4 w-full"
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
        </div>
      </div>

      {/* Cancel guides section */}
      <div className="max-w-md mx-auto px-6 pb-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[#86868b] uppercase tracking-[0.05em]">Cancel guides</h2>
        </div>
        <div className="card overflow-hidden p-0">
          {guides.map((g, i) => (
            <Link
              key={g.slug}
              href={`/cancel/${g.slug}`}
              className={`flex items-center justify-between px-5 py-3.5 hover:bg-[#f5f5f7] transition-colors duration-150 ${
                i !== guides.length - 1 ? 'border-b border-[#e5e5ea]' : ''
              }`}
            >
              <span className="text-[15px] font-medium text-[#1d1d1f]">{g.name}</span>
              <span className={g.difficulty === 'easy' ? 'badge-easy' : g.difficulty === 'medium' ? 'badge-medium' : 'badge-hard'}>
                {g.difficulty === 'easy' ? 'Easy' : g.difficulty === 'medium' ? 'Medium' : 'Hard'}
              </span>
            </Link>
          ))}
        </div>
        <Link href="/cancel" className="block text-center text-[13px] text-[#86868b] mt-5 hover:text-[#1d1d1f] transition-colors">
          View all 79 services →
        </Link>
      </div>

      {/* Privacy trust block */}
      <div className="max-w-md mx-auto px-6 pb-14">
        <div className="card text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#e8f5e9] mb-3">
            <svg className="w-5 h-5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-1">No server. No database. No tracking.</h3>
          <p className="text-[13px] text-[#86868b] leading-relaxed">
            Your subscription list and Gmail token live on your device. We can&apos;t see your data because we never store it.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto px-6 pb-10 text-center space-x-4">
        <Link href="/privacy" className="nav-link">Privacy</Link>
        <Link href="/cancel" className="nav-link">All guides</Link>
      </div>
    </main>
  );
}
