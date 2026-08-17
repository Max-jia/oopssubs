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

  const prompt =
    `You are a subscription-cancellation proof reviewer. The user claims they cancelled the subscription "${name}"` +
    (amount ? ` (${amount}${cycle ? " per " + cycle : ""})` : "") +
    `. Examine the attached screenshot. Does it prove that THIS subscription ("${name}") was cancelled?\n` +
    `PASS only if the screenshot clearly shows a cancellation confirmation for "${name}" — e.g. a page or email stating "subscription cancelled", "you've cancelled", "cancellation confirmed", "cancelled on <date>", or an account/settings page showing this subscription with an explicit "Cancelled", "Expired", "Ends on" or "Won't renew" status.\n` +
    `FAIL if: the screenshot is unrelated to "${name}" or to cancellation; it only shows a billing/receipt page, login page, home page, a list of subscriptions WITHOUT any cancelled status; or it is ambiguous.\n` +
    `Reply with JSON only, no markdown, no extra text: {"passed": true|false, "confidence": "high"|"medium"|"low", "reason": "one short sentence explaining the verdict"}`;

  try {
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
      return res.status(502).json({ aiAvailable: false, error: "ai upstream error" });
    }

    const text = extractOutputText(data);
    let verdict = null;
    try {
      verdict = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      /* fallthrough */
    }
    if (!verdict || typeof verdict.passed !== "boolean") {
      console.error("verify-proof unparseable verdict:", text.slice(0, 300));
      return res.status(502).json({ aiAvailable: false, error: "ai returned unparseable verdict" });
    }
    return res.json({
      aiAvailable: true,
      passed: verdict.passed,
      confidence: verdict.confidence || "low",
      reason: verdict.reason || "",
    });
  } catch (e) {
    console.error("verify-proof error:", e.message);
    return res.status(502).json({ aiAvailable: false, error: "ai unreachable" });
  }
}
