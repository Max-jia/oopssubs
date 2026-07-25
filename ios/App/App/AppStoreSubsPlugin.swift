import Capacitor
import StoreKit

@objc(AppStoreSubsPlugin)
public class AppStoreSubsPlugin: CAPPlugin {
    
    @objc func getSubscriptions(_ call: CAPPluginCall) {
        Task {
            var subs: [[String: Any]] = []
            
            for await result in Transaction.currentEntitlements {
                guard case .verified(let transaction) = result else { continue }
                guard let expirationDate = transaction.expirationDate,
                      expirationDate > Date() else { continue }
                
                let productId = transaction.productID
                // Convert bundle-style product IDs: "com.netflix.subscription.monthly" -> "Netflix"
                let name = productId
                    .replacingOccurrences(of: "com.", with: "")
                    .replacingOccurrences(of: ".subscription", with: "")
                    .replacingOccurrences(of: ".monthly", with: "")
                    .replacingOccurrences(of: ".yearly", with: "")
                    .replacingOccurrences(of: ".premium", with: "")
                    .components(separatedBy: ".")
                    .last?
                    .capitalized ?? productId
                
                subs.append([
                    "name": name,
                    "amount": 0, // StoreKit doesn't expose price for existing subs
                    "cycle": productId.contains("yearly") || productId.contains("annual") ? "yearly" : "monthly",
                    "renewalDate": ISO8601DateFormatter().string(from: expirationDate)
                ])
            }
            
            call.resolve(["subscriptions": subs])
        }
    }
}
