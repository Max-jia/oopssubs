import { registerPlugin } from "@capacitor/core";

export interface AppStoreSub {
  name: string;
  amount: number;
  cycle: "monthly" | "yearly";
  renewalDate: string;
}

export interface AppStoreSubsPlugin {
  getSubscriptions(): Promise<{ subscriptions: AppStoreSub[] }>;
}

export const AppStoreSubsPlugin = registerPlugin<AppStoreSubsPlugin>("AppStoreSubs");
