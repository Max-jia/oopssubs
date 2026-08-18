# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

（Android App 為主要發布渠道；網站 oopssubs.com 是輔助入口與 OAuth 中轉。Capacitor 包裝同一套 Web 程式碼。未來規劃 iOS。）

## Users

大眾省錢用戶：被遺忘的訂閱持續扣費而困擾的普通人。他們不一定是技術用戶，動機是「發現自己還在為沒用的東西付錢」並想省下來。

## Product Purpose

OopsSubs 幫用戶找到所有正在付費的訂閱（Gmail 掃描 + 手動添加），在扣費前提醒，並用逐步教學引導取消。成功 = 用戶發現並取消了遺忘的訂閱，感覺「省了錢、拿回了控制權」。

## Positioning

兩個差異點並重，缺一不可：

1. **隱私優先**：不存伺服器、資料全在裝置（No server. No database.）。與 Rocket Money / Truebill 等需授權讀取帳戶的競品形成對比——用戶不需要交出任何東西。
2. **偵探世界觀 + 幽默**：AI 審核取消證據（偵探蓋章風）、催繳追債動效——把「取消訂閱」這種不甘心的動作變成有情緒、有記憶點的體驗。

## Operating Context

- 訂閱管理流程：添加（手動/Gmail 掃描/App Store 掃描）→ 列表（到期日排序、催繳提醒）→ 取消（80 個服務的逐步教學、預填取消信）→ 證據制取消（上傳截圖、AI 審核、催繳追債直到交證據）
- 免費額度 3 個訂閱；Pro 一次買斷 $9.99（Android 用 RevenueCat/Google Play 內購；網站用 Stripe Checkout）
- Pro 身份：Google Play 購買紀錄（RevenueCat entitlement `pro`）；買過但 App 沒認出時可「Restore purchases」恢復
- 取消證明：截圖只存裝置（IndexedDB），AI 審核透過伺服器端轉發（Gemini key 不進 App 安裝包）
- App 內 Gmail 授權必須跳系統瀏覽器 + deep link 回跳（Google 封鎖 WebView OAuth）
- 深色 UI 為唯一視覺模式（2026-08 設計改造定案）；偵探金帽吉祥物為品牌標識
