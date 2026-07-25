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
  try {
    const result = await cap.Plugins.AppStoreSubs.getSubscriptions();
    return result?.subscriptions || [];
  } catch { return []; }
}

export function isNativeIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (window as any).Capacitor?.getPlatform() === "ios";
}
