// OopsSubs 取消證據 AI 審核後台
// 收截圖 + 訂閱資訊 → 交給 Gemini 審核 → 回傳結論
// 鑰匙藏在伺服器環境變量 GEMINI_API_KEY，用戶端永遠看不到
// Vercel serverless function：根目錄 api/ 會被 Vercel 當作獨立函數構建
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // base64 上限約 12MB（Gemini inline 上限 20MB）

// 允許的來源：網站 + App WebView（capacitor://localhost）+ 本機開發
const ALLOWED_ORIGINS = ["https://oopssubs.com", "http://localhost", "https://localhost", "capacitor://localhost", "capacitor://localhost:3000"];

// 從 Gemini 回傳的 steps 中抽出 model_output 的純文字
function extractOutputText(data) {
  for (const step of data.steps || []) {
    if (step.type !== "model_output") continue;
    let text = "";
    for (const part of step.content || []) {
      if (part.type === "text" && part.text) text += part.text;
    }
    if (text.trim()) return text.trim();
  }
  return "";
}

export default async function handler(req, res) {
  // CORS：App 的 WebView 與網站都是不同 origin，必須放行並回正確 header
  const origin = req.headers.origin || "";
  if (origin && !ALLOWED_ORIGINS.some((a) => origin.startsWith(a))) {
    return res.status(403).json({ error: "origin not allowed" });
  }
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: "bad json" });
  }
  const { name, amount, cycle, imageBase64, mimeType } = body;
  if (!name || !imageBase64) return res.status(400).json({ error: "missing fields" });
  if (imageBase64.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "image too large" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ aiAvailable: false, error: "ai not configured" });

  // 雙重審核:證明視角 + 反證視角(兩次獨立調用,任一不過即拒絕)
  const PASS_FEATURES =
    `PASS if the screenshot clearly shows ANY of these for the subscription "${name}":\n` +
    `  1) An explicit cancellation confirmation — text like "cancelled", "canceled", "you've cancelled", "cancellation confirmed", "cancelled on <date>".\n` +
    `  2) A subscription status that is NOT active — "Expired", "Ends on", "Won't renew", "Inactive".\n` +
    `  3) The account/settings page showing NO active subscription for this service — "No subscription", "You are not subscribed", "Unsubscribed", or an empty subscription list.\n` +
    `The subscription name ("${name}") must appear in the screenshot (or be clearly identifiable from it).\n` +
    `FAIL if: the screenshot is unrelated to "${name}" or to cancellation; it shows an ACTIVE subscription ("Active", "Subscribed", a list with this service and no cancelled mark); it only shows a billing/receipt page, login page, home page, or is too blurry/ambiguous to read.`;

  const promptA =
    `You are a subscription-cancellation proof reviewer (first reviewer). The user claims they cancelled the subscription "${name}"` +
    (amount ? ` (${amount}${cycle ? " per " + cycle : ""})` : "") +
    `. Examine the attached screenshot. Does it prove that THIS subscription ("${name}") was cancelled?\n${PASS_FEATURES}\n` +
    `Also report a checklist: "name_match" (does the screenshot show "${name}"?), "cancel_evidence" (any of the three PASS types above), "clarity" (is the screenshot legible?).\n` +
    `Reply with JSON only, no markdown: {"passed": true|false, "confidence": "high"|"medium"|"low", "reason": "one short sentence", "checks": {"name_match": true|false, "cancel_evidence": true|false, "clarity": true|false}}`;

  const promptB =
    `You are an adversarial second reviewer for the same claim: the user says they cancelled "${name}"` +
    (amount ? ` (${amount}${cycle ? " per " + cycle : ""})` : "") +
    `. Your job is to find reasons the attached screenshot does NOT prove the cancellation. Be skeptical.\n` +
    `Is there ANY chance this screenshot is: an unrelated service, a billing page, an active subscription list, a login page, a partial crop, an email receipt, or ambiguous? If so, FAIL.\n` +
    `${PASS_FEATURES}\n` +
    `Reply with JSON only, no markdown: {"passed": true|false, "confidence": "high"|"medium"|"low", "reason": "one short sentence"}`;

  const callGemini = async (prompt) => {
    const gemRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: "gemini-3.5-flash",
        input: [
          { type: "text", text: prompt },
          { type: "image", data: imageBase64, mime_type: mimeType || "image/jpeg" },
        ],
      }),
    });
    const data = await gemRes.json();
    if (!gemRes.ok) {
      console.error("verify-proof Gemini error:", gemRes.status, JSON.stringify(data).slice(0, 300));
      return null;
    }
    const text = extractOutputText(data);
    try {
      const v = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (typeof v.passed === "boolean") return v;
    } catch { /* fallthrough */ }
    console.error("verify-proof unparseable verdict:", text.slice(0, 300));
    return null;
  };

  try {
    // 雙重審核:兩次獨立調用,任一失敗/不通過 → 拒絕
    const [verdictA, verdictB] = await Promise.all([callGemini(promptA), callGemini(promptB)]);
    if (!verdictA || !verdictB) {
      return res.status(502).json({ aiAvailable: false, error: "ai upstream error" });
    }
    const passed = verdictA.passed && verdictB.passed;
    const reason = passed
      ? verdictA.reason
      : `Second opinion: ${verdictB.reason}${verdictA.reason ? " | " + verdictA.reason : ""}`;
    return res.json({
      aiAvailable: true,
      passed,
      confidence: passed
        ? (verdictA.confidence === "high" && verdictB.confidence === "high" ? "high" : "medium")
        : "low",
      reason,
    });
  } catch (e) {
    console.error("verify-proof error:", e.message);
    return res.status(502).json({ aiAvailable: false, error: "ai unreachable" });
  }
}
