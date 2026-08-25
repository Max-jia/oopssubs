// Purchase wrapper — native app uses RevenueCat (Google Play Billing);
// web uses a small Stripe checkout backend (checkout-api/).
import { Purchases } from "@revenuecat/purchases-capacitor";

export const ENTITLEMENT_ID = "pro";
// New product ID — oopssubs_pro got its type cached as "subscription" in RevenueCat's
// catalog and can't be fixed in place; fresh ID escapes the bad cache.
export const PRODUCT_ID = "oopssubs_pro_lifetime";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oopssubs.app";

// Web (Stripe) state
const WEB_PRO_KEY = "oopssubs_web_pro";
const CHECKOUT_API = process.env.NEXT_PUBLIC_CHECKOUT_API_URL || "";

function capPlatform(): string | null {
  if (typeof window === "undefined") return null;
  const cap = (window as any).Capacitor;
  return cap?.getPlatform ? cap.getPlatform() : null;
}

export function isNativeApp(): boolean {
  // App（Capacitor）的內部伺服器 host 固定是 localhost——這比 window.Capacitor 更可靠：
  // Capacitor bridge 在頁面載入後才注入，首頁首次渲染時可能還沒就緒，會誤判成網頁版。
  if (typeof window !== "undefined" && window.location.hostname === "localhost") return true;
  const p = capPlatform();
  return p === "android" || p === "ios";
}

function checkWebPro(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(WEB_PRO_KEY) === "true";
}

function setWebPro() {
  localStorage.setItem(WEB_PRO_KEY, "true");
}

export async function initPurchases(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await Purchases.configure({
      apiKey: process.env.NEXT_PUBLIC_REVENUECAT_API_KEY || "",
    });
  } catch {
    // Native purchase unavailable — app keeps working in free tier
  }
}

export async function checkPro(): Promise<boolean> {
  if (!isNativeApp()) return checkWebPro();
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

export async function buyPro(): Promise<{ ok: boolean; cancelled?: boolean; error?: string; redirecting?: boolean }> {
  if (!isNativeApp()) {
    // Web: redirect to Stripe Checkout via the checkout backend
    if (!CHECKOUT_API) return { ok: false, error: "checkout-unavailable" };
    try {
      const res = await fetch(`${CHECKOUT_API}/api/checkout`, { method: "POST" });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        // 跳轉後由伺服器驗證付款才解鎖 — 不能在此回 ok，否則按鈕會先假解鎖（按返回後 Pro 假性解鎖）
        return { ok: false, redirecting: true };
      }
      return { ok: false, error: "checkout-failed" };
    } catch {
      return { ok: false, error: "checkout-unavailable" };
    }
  }
  try {
    const { products } = await Purchases.getProducts({
      productIdentifiers: [PRODUCT_ID],
      // Critical: the plugin defaults to SUBSCRIPTION queries — our product is one-time (non-subscription)
      type: "NON_SUBSCRIPTION" as any,
    });
    const product = products[0];
    if (!product) return { ok: false, error: "product-not-found" };
    const result = await Purchases.purchaseStoreProduct({ product });
    return { ok: !!result.customerInfo.entitlements.active[ENTITLEMENT_ID] };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: String(e?.message || e) };
  }
}

// Called after Stripe redirects back with ?session_id= — server-verifies the payment
// and unlocks Pro on this device. Retries a few times to survive flaky networks.
export async function handleStripeReturn(): Promise<boolean> {
  if (isNativeApp()) return false;
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  if (!sessionId) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${CHECKOUT_API}/api/verify?session_id=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (data?.ok) {
        setWebPro();
        window.history.replaceState({}, "", "/app");
        return true;
      }
      return false; // Server responded — payment not verified
    } catch {
      // Network hiccup — wait and retry
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return false;
}

// 還原購買:買過 Pro 但 App 沒認出(身份漂移/重裝)時,用戶點「Restore purchases」恢復
export async function restorePro(): Promise<{ ok: boolean; error?: string }> {
  if (!isNativeApp()) {
    // 網站版:回到 checkWebPro(Stripe 已驗證的本地狀態)
    return { ok: checkWebPro() };
  }
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    if (customerInfo.entitlements.active[ENTITLEMENT_ID]) return { ok: true };
    return { ok: false, error: "no-entitlement" };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
