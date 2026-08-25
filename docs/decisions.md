# 產品決策紀錄

## 2026-08-04

- **收費方式**：Pro 改為手機原生內購（RevenueCat 整合 Google Play Billing），捨棄 Stripe 付款連結。原因：Google Play 審核不合規、手機刷卡體驗差、`pro=unlocked` 網址暗號可被免費破解、不利未來 iPhone 版共用。
- **中間商選擇**：採用 RevenueCat（方案 B）。原因：預期未來上架 Apple App Store，RevenueCat 讓兩平台共用同一套收費程式，現在寫一次勝過以後寫兩次。
- **免費額度**：從 5 個訂閱降為 3 個。
- **版本策略**：跳過純免費版 v1，直接開發含收費的 v2 一次送審。
- **收費形式**：維持一次買斷 $9.99（Google Play 內購商品 `oopssubs_pro`），不做月費制。
- **網站定位**：網站不做收款（RevenueCat 原生內購僅在 App 內可用）；網站上「買 Pro」按鈕改為引導下載 App。網站免費額度同樣為 3 個。
- **登入體系**：不新增登入功能。Pro 身份依賴 Google Play 購買紀錄（Google 帳號即身份），換手機重裝可自動恢復。
- **識別碼**：RevenueCat entitlement ID = `pro`；Google Play 商品 ID = `oopssubs_pro`；測試金鑰目前放 `.env.local`，上架前換正式金鑰。

## 2026-08-16

- **網站上線（試用倒數版本）**：試用到期倒數 4 階段（badge/提醒/通知 action/Keep it–Cancel it 處理）部署至 oopssubs.com。含 2 個修復（Cancel now 教學頁查詢、daysUntil 時區統一）與首頁極簡文案。
- **取消教學新增 Gemini**：清單 81 → 82 個。原因：靜態網站的動態網址必須在清單內，否則直接訪問 /cancel/gemini 會報錯；Gemini 為 Google 常見訂閱，本就該有教學。
- **App v8（診斷版）**：修 InstallPrompt 在 App 環境誤顯示（加入 `Capacitor.isNativePlatform()` 判斷，App 內不再出現「Add to Home Screen」提示）。另開啟 WebView 除錯（`webContentsDebuggingEnabled: true`）以診斷「按鈕點擊無反應」——**上架前必須關閉**。
- **「按鈕無反應」真相（v7/v8 排查，v9 修復）**：首頁兩個 CTA（Add subscriptions manually / Connect Gmail to scan）的 href 由 `appHref()` 決定，其偵測 App 的方式是 `window.Capacitor`。但 Next.js static export 的 HTML 在伺服器端烘焙，那時沒有 window → href 一律烘焙成網頁版 `/app/#action=...`；App 的內部伺服器遇到這個網址會回傳首頁 HTML（而非儀表板）→ 看起來「點擊無反應」。**v9 修復**：① `isNativeApp()` 改用最可靠訊號——App 內部網址 host 固定是 localhost（purchases.ts）；② 首頁元件 hydrate 後立即用 `useEffect` 重算兩個按鈕 href。實測 v9：兩按鈕 href 正確為 `/app/index.html#action=...`，點擊後儀表板＋新增表單、Gmail 掃描頁均正常出現。先前「殘影」理論為誤診，作廢。

## 2026-08-16（續）

- **App 內 Gmail 授權全鏈路打通（v13–v15，關鍵決策）**：App 內授權失敗的真正根因是 **Google 封鎖 App 內嵌瀏覽器（WebView）做 OAuth**（2023 年起的平台安全政策，對敏感 scope 如 gmail.readonly 生效；錯誤顯示為籠統的「request is invalid」）。**標準解法（大公司 App 通用）**：跳出 App → 系統瀏覽器（Custom Tab）授權 → 經中轉頁 + deep link 跳回 App。具體：① 後台 redirect_uri 白名單含 `https://oopssubs.com/oauth-app`（只認已登記網域，localhost 無法登記）；② `@capacitor/browser` 的 `Browser.open()` 開 Custom Tab（Google 認可的環境）；③ 中轉頁 `/oauth-app`（static export 靜態頁）把 hash 用 `window.location.replace("com.oopssubs.app://oauth" + hash)` 跳回；④ AndroidManifest 加 `<data android:scheme="com.oopssubs.app"/>` intent-filter；⑤ `CapApp.addListener("appUrlOpen")` 收 token → 啟動掃描。Google 後台**無需新增 client**（Web client + https redirect 即可）。
- **gapi 依賴移除（v15）**：`gapi.client.init()` 在 Capacitor WebView 環境不可靠（gapi.load 的 client 庫載入行為異常，報 `Cannot read properties of undefined (reading 'init')`），但**掃描全程只用 fetch + Bearer token，從未真正用過 gapi**——直接移除 gapi 依賴（`initGapiClient` 只保留 setToken no-op）。網站版「首次掃描必失敗」（等 gapi script 載入的競態）也隨之根除。**教訓：庫載入（gapi/gis Script 標籤）是歷史遺留，實際功能不依賴它，應審視後移除而非等待。**
- **網站版掃描一直沒通的真相**：線上網站是舊版（無 gapi Script 標籤、無 oauth-app 頁面）——「授權通」≠「掃描通」，掃描從未在網站版真正成功過；Product Hunt 發布不等於掃描功能驗證過。**教訓：上線前必須完整走一遍「授權 → 掃描 → 出結果」全流程，而非只驗證登入。**
- **v15 診斷訊息保留**：掃描失敗時顯示具體錯誤（`Scan failed: <原因>`）而非籠統提示——對無技術背景的用戶，詳細錯誤可直接複製回報，比「Please try again」更有助於遠端排查。
- **首頁加「View my subscriptions」入口（v16）**：添加/掃描訂閱後回到首頁沒有進訂閱列表的路徑（原僅有 manual/scan 兩個 CTA，指向表單/掃描頁而非列表）。在兩個主按鈕下方加小字入口「View my subscriptions →」（href 走 appHref 家族，App/網站共用同一首頁元件，一次改動兩邊生效；action=list 在儀表板無處理 → 落入默認列表視圖）。

## 2026-08-17

- **證據制取消（v17）**：點「已取消」必須上傳對應訂閱的取消成功截圖才完成取消；未上傳則催繳提醒每 24 小時持續（「尚未提交取消證據（第 N 天）」）。原因：防止「按了已取消就當作沒這回事」的虛假取消。截圖只存裝置（IndexedDB，localStorage 5MB 不夠存圖），不上傳任何伺服器；ProofRecord 只存驗證結果與時間。
- **AI 審核委託網站後台**：Gemini 鑰匙放 Vercel serverless 後台（`api/verify-proof.js`）環境變數，App 與網站透過 `https://oopssubs.com/api/verify-proof` 轉發。原因：鑰匙絕不能進 App 安裝包（會被反編譯偷走）；後台 CORS 白名單只放行 oopssubs.com 與 App WebView。
- **Gemini Interactions API（2026 大改版）**：`generateContent` 已退休（404），新版 `POST /v1beta/interactions`，需 `Api-Revision: 2026-05-20` header + `x-goog-api-key`，模型用 `gemini-3.5-flash`（gemini-2.x 全線退休）。回傳從 `steps[]` 中 `type === "model_output"` 的 step 取文字。
- **審核互動風格 = AI 偵探蓋章風**：審核中顯示放大鏡掃描截圖（「Inspector is examining your evidence…」）；通過 = 綠色 APPROVED 印章歪蓋上截圖（蓋下瞬間畫面震動）+ 隨機俏皮話（「Case closed 🕵️」「Sayonara, {name} 👋」等 6 句輪抽）；不通過 = 紅色 REJECTED 印章退回 + 吐槽（「Nice try, but I'm not convinced 🤨」等 5 句輪抽）。目的：取消這種「不甘心」的動作用幽默降低痛苦感，用戶更願意真的去截圖。
- **AI 失敗降級**：後台掛了或回傳無法解析時不擋用戶——顯示「AI check unavailable」可直接繼續，截圖仍算證據（verified: "ai-down"）。AI 說不通過時用戶仍可「I did cancel it — skip AI check」硬過（verified: "skipped"），但兩種情況都會在取消記錄標示證據等級。
- **全 App 移除系統 emoji**：偵探台詞、狀態圖示、按鈕全改純文字或自繪 SVG。原因：Android 系統 emoji 各廠渲染不一致（有的變黑白、豆腐塊），破壞「偵探蓋章風」的視覺統一。教訓：搜索 emoji 時正則要涵蓋 U+1F000–U+1FAFF 全區（grep 只列常見幾個會漏，如 📸）。
- **催繳提醒 = 漸進折磨動效**：待交證據卡片按天數升級動效——DAY 1 呼吸脈動 → DAY 2-3 左右搖晃 → DAY 4-5 搖晃加劇+紅光閃爍+DAY 數字跳動 → DAY 6+ 崩潰級搖晃+紅光更強+數字狂抖；台詞 4 秒輪換隨天數加劇（「The case is open. Evidence due.」→「DAY SIX?! The suspect is getting away!」）。紅光透明度上限 18% 避免傷眼。目的：延續偵探世界觀，把催繳從「靜態通知」變成「有情緒的追債」，促使用戶快交證據。用戶選擇此方向而非「未結案件卡（警戒膠帶）」或「兩者結合」。

## 2026-08-17（UI 審查修正）

- **清單數量改程式自動計算**：首頁「View all 79 services →」與 pricing「Cancel guide for 79+ services」為硬編碼，實際清單已 80 個（8/16 加入 Gemini 時決策紀錄誤寫 82，程式碼實測 80）。改為 `cancelGuides.length` 動態顯示，日後增減清單不會再不同步。
- **Pricing 只列 Android 功能**：移除「iOS App Store subscription scanner」條目——目前僅 Android 版，iOS 版未開發，不預先承諾。
- **隱私主張精簡**：頁尾信任卡原標題「No server. No database. No tracking.」與首屏標語重複講同一件事，改為「Private by design」+ 單行說明，去掉重複。

## 2026-08-19（待辦紀錄）

- **Cancel now 跳轉教學頁未生效(待修)**:urgent banner「Cancel now」在 App 內點擊後未跳轉到對應教學頁/列表。已排除 overlay 攔截(已修)、window.open(已改 location.href)、匹配邏輯(本地驗證 cancelSlugFor 正常)。v30 後用戶實測仍未跳轉——**待排查**(可能 App 內 location.href 導航被 Capacitor 攔截,或按鈕點擊未觸發)。測試環境 localhost 下 mouse 點擊可跳轉,但用戶實測不行——懷疑 Capacitor WebView 的導航處理差異。

## 2026-08-24

- **截圖證明評語文案分流**：審計發現語音版評語池(「The witness's voice is steady…」)套在截圖結果上，文字風格格格不入，且「聽不到服務名」會誤導用戶重錄語音。新增 IMAGE_PASS_LINES/IMAGE_FAIL_LINES 圖片版評語池，按證明類型分流。判斷邏輯未動。

## 2026-08-25 設計審計修復 FINDING-007:隱私頁對比度
- 隱私頁是唯一未用設計 token 的頁面(Tailwind 灰階 text-gray-900/600/400 配深色背景 #0A0A0C,對比 1.1:1/2.6:1,近乎不可見)
- 決策:全部改為 token 系(text-[var(--text)] 標題、text-[var(--text-secondary)] 內文/連結),對比升至 17.9:1 / 7.2:1,過 WCAG AA
- 依循「設計審計修復」批次,後續修復逐條追加

## 2026-08-25 免費額度 Bug 修復：額度計算含已取消訂閱
- 問題：免費用戶 3 個額度只算「活躍中」訂閱，已取消的不佔額度 → 用戶可「追蹤 3 個 → 取消 → 再追蹤 3 個」無限繞過付費牆
- 決策：額度 = 活躍訂閱 + 已取消訂閱（usedSlots helper，4 處 FREE_LIMIT 檢查全部改用），防止繞過
- 影響：src/app/app/page.tsx（手動新增檢查、付費牆觸發檢查、右上角額度顯示、paywall 文案不變）

## 2026-08-25 付費牆假解鎖 Bug 修復：跳轉 Stripe 前不再提前解鎖
- 問題：網站版按「Get Pro」→ buyPro 跳轉 Stripe 前回傳 ok → 按鈕立即 setPro(true) → 用戶按瀏覽器返回，bfcache 還原頁面記憶體狀態 → 未付款但 Pro 顯示已解鎖
- 決策：buyPro 跳轉路徑改回傳 { ok:false, redirecting:true }，解鎖只發生在 handleStripeReturn 伺服器驗證 payment_status=paid 之後；兩處按鈕（app 付費牆、pricing 頁）處理 redirecting 分支
- 影響：src/lib/purchases.ts、src/app/app/page.tsx、src/app/pricing/page.tsx
