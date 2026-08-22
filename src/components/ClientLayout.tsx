"use client";

import { useEffect } from "react";
import InstallPrompt from "./InstallPrompt";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  // App(WebView)不需要 service worker——資源打包在本地,SW 只會緩存舊版拖慢更新。
  // 舊版本曾把 sw.js 打進 App,這裡主動解除殘留的 SW。
  useEffect(() => {
    const isApp = typeof window !== "undefined" && !!window.Capacitor;
    if (isApp && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
  }, []);

  return (
    <>
      {children}
      <InstallPrompt />
    </>
  );
}
