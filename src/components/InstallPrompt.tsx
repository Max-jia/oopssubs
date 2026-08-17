"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 在 App（Capacitor）裡不顯示——App 本身就是安裝好的，不用再加到主畫面
    if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) return;
    // Don't show if already in standalone (installed) mode
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Don't show on desktop
    if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return;
    // Show after 5 seconds on site
    const t = setTimeout(() => {
      const dismissed = localStorage.getItem("oopssubs_install_dismissed");
      if (!dismissed) setShow(true);
    }, 5000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("oopssubs_install_dismissed", "1");
  };

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-50"
        >
          <div className="bg-[#1d1d1f] text-white rounded-3xl px-5 py-4 shadow-2xl flex items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <img src="/icon-192.png" alt="" className="w-7 h-7 rounded-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold">Add OopsSubs to Home Screen</p>
              <p className="text-[12px] text-white/60">
                {isIOS ? "Tap Share → Add to Home Screen" : "Tap menu → Install app"}
              </p>
            </div>
            <button onClick={dismiss} className="text-white/60 hover:text-white text-[24px] leading-none flex-shrink-0">&times;</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
