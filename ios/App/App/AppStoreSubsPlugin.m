#import <Capacitor/Capacitor.h>

CAP_PLUGIN(AppStoreSubsPlugin, "AppStoreSubs",
    CAP_PLUGIN_METHOD(getSubscriptions, CAPPluginReturnPromise);
)
