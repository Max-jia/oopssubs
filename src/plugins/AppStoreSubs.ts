export interface AppStoreSubscription {
  name: string;
  amount: number;
  cycle: "monthly" | "yearly";
  renewalDate: string;
}

export async function getAppStoreSubscriptions(): Promise<AppStoreSubscription[]> {
  // Falls back to empty if not on native iOS
  if (typeof (window as any).Capacitor === "undefined") return [];
  const { AppStoreSubsPlugin } = await import("@/plugins/native");
  return AppStoreSubsPlugin.getSubscriptions();
}
