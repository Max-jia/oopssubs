package com.oopssubs.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PlayStoreSubs")
public class PlayStoreSubsPlugin extends Plugin {

    @PluginMethod
    public void getSubscriptions(PluginCall call) {
        com.android.billingclient.api.BillingClient billingClient =
            com.android.billingclient.api.BillingClient.newBuilder(getContext())
                .enablePendingPurchases(
                    com.android.billingclient.api.PendingPurchasesParams.newBuilder()
                        .enableOneTimeProducts()
                        .build())
                .build();

        billingClient.startConnection(new com.android.billingclient.api.BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(com.android.billingclient.api.BillingResult result) {
                if (result.getResponseCode() != com.android.billingclient.api.BillingClient.BillingResponseCode.OK) {
                    call.reject("Billing unavailable");
                    return;
                }
                billingClient.queryPurchasesAsync(
                    com.android.billingclient.api.QueryPurchasesParams.newBuilder()
                        .setProductType(com.android.billingclient.api.BillingClient.ProductType.SUBS)
                        .build(),
                    (billingResult, purchases) -> {
                        JSObject ret = new JSObject();
                        com.getcapacitor.JSArray subs = new com.getcapacitor.JSArray();
                        if (purchases != null) {
                            for (com.android.billingclient.api.Purchase p : purchases) {
                                if (p.isAcknowledged() && !p.isAutoRenewing()) continue;
                                JSObject sub = new JSObject();
                                String id = p.getProducts().get(0);
                                sub.put("name", id.replace("com.", "").replace(".subscription", "")
                                    .replace(".monthly", "").replace(".yearly", "")
                                    .replace(".premium", "").replace(".sub", ""));
                                sub.put("amount", 0);
                                sub.put("cycle", id.contains("yearly") || id.contains("annual") ? "yearly" : "monthly");
                                sub.put("renewalDate", "");
                                subs.put(sub);
                            }
                        }
                        ret.put("subscriptions", subs);
                        call.resolve(ret);
                    }
                );
            }

            @Override
            public void onBillingServiceDisconnected() {
                call.reject("Billing service disconnected");
            }
        });
    }
}
