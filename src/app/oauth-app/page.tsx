"use client";

import { useEffect } from "react";

// Google OAuth 中轉頁（僅 App 用）：
// Google 只認可已登記的網域，App 內部（https://localhost）無法直接接收回調，
// 所以 App 的 redirect_uri 指向這裡（oopssubs.com/oauth-app）；
// 此頁把 hash（含 access_token）透過 App 專屬通道（com.oopssubs.app://）
// 跳回 App，App 監聽 deep link 接手掃描。
// 網站用戶不會經過此頁（網站版 redirect_uri 仍是 /app）；若誤訪且無 token，導回首頁。
export default function OAuthAppRedirect() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      window.location.replace("com.oopssubs.app://oauth" + hash);
    } else {
      window.location.replace("/app");
    }
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center text-[14px] text-[var(--text-secondary)]">
      Redirecting back to OopsSubs…
    </main>
  );
}
