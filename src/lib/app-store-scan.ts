// Safe wrapper — no Capacitor import, pure runtime detection
export interface AppStoreSub {
  name: string;
  amount: number;
  cycle: "monthly" | "yearly";
  renewalDate: string;
}

export async function getAppStoreSubscriptions(): Promise<AppStoreSub[]> {
  if (typeof window === "undefined") return [];
  const cap = (window as any).Capacitor;
  if (!cap) return [];
  // iOS: StoreKit
  if (cap.getPlatform() === "ios") {
    try {
      const result = await cap.Plugins.AppStoreSubs.getSubscriptions();
      return result?.subscriptions || [];
    } catch { /* fall through */ }
  }
  // Android: Play Store Billing
  if (cap.getPlatform() === "android") {
    try {
      const result = await cap.Plugins.PlayStoreSubs.getSubscriptions();
      return result?.subscriptions || [];
    } catch { /* fall through */ }
  }
  return [];
}

export function isNativeIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (window as any).Capacitor?.getPlatform() === "ios";
}

export function isMobileWeb(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
