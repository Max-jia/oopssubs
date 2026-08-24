// OopsSubs 取消證據 AI 審核後台
// 收截圖 + 訂閱資訊 → 交給 Gemini 審核 → 回傳結論
// 鑰匙藏在伺服器環境變量 GEMINI_API_KEY，用戶端永遠看不到
// Vercel serverless function：根目錄 api/ 會被 Vercel 當作獨立函數構建
// 百煉(DashScope)OpenAI 相容端點——一個 key 覆蓋圖片(qwen-vl)與語音(qwen-audio)
const DASHSCOPE_URL = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions";
// qwen3-asr-flash 未在专属端点開通(404)——转写走官方通用端点,审核继续走专属端点
const DASHSCOPE_PUBLIC_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
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
  const { name, amount, cycle, imageBase64, audioBase64, mimeType } = body;
  if (!name || (!imageBase64 && !audioBase64)) return res.status(400).json({ error: "missing fields" });
  if ((imageBase64 || audioBase64).length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "media too large" });

  const key = process.env.DASHSCOPE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ aiAvailable: false, error: "ai not configured" });

  // 雙重審核:證明視角 + 反證視角(兩次獨立調用,任一不過即拒絕)
  const PASS_FEATURES =
    `PASS if the screenshot clearly shows ANY of these for the subscription "${name}":\n` +
    `  1) An explicit cancellation confirmation — text like "cancelled", "canceled", "you've cancelled", "cancellation confirmed", "cancelled on <date>".\n` +
    `  2) A subscription status that is NOT active — "Expired", "Ends on", "Won't renew", "Inactive".\n` +
    `  3) The account/settings page showing NO active subscription for this service — "No subscription", "You are not subscribed", "Unsubscribed", or an empty subscription list.\n` +
    `The subscription name ("${name}") must appear in the screenshot (or be clearly identifiable from it). Voice or OCR transcription may have pronunciation/typo errors — accept close matches (e.g. "doolinga" ≈ "Duolingo", "netflix" ≈ "Netflix").\n` +
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

  // 偵探評語池(通過/拒絕,風格混合:法庭/審訊/幽默/偵探)
  const PASS_LINES = [
    "The witness's voice is steady. Credible. Case closed.",
    "Confession accepted. The court is satisfied.",
    "Crystal clear testimony. Case closed.",
    "The witness speaks true. Evidence recorded.",
    "Steady voice, clear words. This testimony holds up.",
    "The truth, the whole truth. Case closed.",
    "Nothing but the truth — and we heard it all. Case closed.",
    "The detective nods. Testimony accepted.",
    "Clean statement. No hesitation. Accepted.",
    "The witness has convinced the court. Case closed.",
  ];
  const FAIL_LINES = [
    "I detect hesitation... The court is not convinced.",
    "This testimony doesn't hold up. Try again.",
    "The witness mumbles. Evidence insufficient.",
    "Too vague. We need to hear the service name clearly.",
    "I hear words, but not a clear cancellation. Rejected.",
    "The court finds this testimony unreliable. Try again.",
    "Hmm... the witness seems unsure. Rejected.",
    "That's not a confession. That's a whisper. Try again.",
    "The detective frowns. Not good enough.",
    "Evidence doesn't match the claim. Rejected.",
  ];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const audioPromptA =
    `You are a court-appointed truth reviewer for a subscription cancellation claim. The user recorded a spoken testimony claiming they cancelled "${name}"` +
    (amount ? ` (${amount}${cycle ? " per " + cycle : ""})` : "") +
    `. Listen to the audio and transcribe it. The transcript you receive is a reliable machine transcription of the recording.\n` +
    `PASS if the testimony clearly states that "${name}" was cancelled or is no longer subscribed — accept any form: "I cancelled/cancel/canceled ${name}", "I ended my ${name} subscription", "${name} is cancelled", "I stopped ${name}", "no more ${name}". The service name may have transcription pronunciation errors — accept close matches (e.g. "doolinga" ≈ "Duolingo", "googled one" ≈ "Google One"). The service reference (or an unmistakable close match) and a cancellation statement must both be present. Do not invent doubts about a clear statement: a direct "I have cancelled X" statement must be accepted.\n` +
    `FAIL if: the service name is missing or unclear; there is no clear cancellation statement; the speech is too unclear/too short to understand; or the person seems to be reading something unrelated.\n` +
    `Reply with JSON only: {"passed": true|false, "confidence": "high"|"medium"|"low", "reason": "one short sentence", "transcript": "verbatim transcription of what was said"}`;

  const audioPromptB =
    `You are an adversarial second reviewer. The first reviewer already confirmed the service name "${name}" matches the testimony. Your ONLY job: is the cancellation statement credible? Be skeptical but fair.\n` +
    `FAIL only if there is genuinely no cancellation statement at all. Do NOT fail for briefness, casual spoken grammar, transcription imperfections, or service-name phrasing — "i have canceled", "i cancel", "i canceled", "i ended", "i stopped" are all valid. A clear statement like "I have cancelled X" must PASS — only invent doubts when the statement is genuinely missing.\n` +
    `Reply with JSON only: {"passed": true|false, "confidence": "high"|"medium"|"low", "reason": "one short sentence"}`;

  // ── 阿里雲 NLS 一句話識別(極速版):同步轉寫語音 ──
  const crypto = require("crypto");

  async function createNlsToken() {
    const ak = process.env.ALIYUN_AK_ID;
    const sk = process.env.ALIYUN_AK_SECRET;
    if (!ak || !sk) throw new Error("aliyun ak/sk missing");
    const params = {
      AccessKeyId: ak,
      Action: "CreateToken",
      Format: "JSON",
      SignatureMethod: "HMAC-SHA1",
      SignatureNonce: crypto.randomUUID(),
      SignatureVersion: "1.0",
      Timestamp: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      Version: "2019-02-28",
    };
    const encode = (v) => encodeURIComponent(String(v)).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
    const canonical = Object.keys(params).sort().map((k) => `${encode(k)}=${encode(params[k])}`).join("&");
    const stringToSign = "POST&%2F&" + encode(canonical);
    const sig = crypto.createHmac("sha1", sk + "&").update(stringToSign).digest("base64");
    params.Signature = sig;
    const url = "https://nls-meta.cn-shanghai.aliyuncs.com/?" + new URLSearchParams(params).toString();
    const resp = await fetch(url, { method: "POST" });
    const data = await resp.json();
    if (!data?.Token?.Id) throw new Error("nls token failed");
    return data.Token.Id;
  }

  // 音頻 base64 → 轉寫文本(qwen-audio-3.0-asr-flash 高精度;NLS 降級備援)
  // 注意:OpenAI 相容模式不認識 asr_options(那是原生 API 參數)→ 400。不放。
  async function transcribeWithQwen(audioB64, mime) {
    const dataUrl = `data:${mime || "audio/wav"};base64,${audioB64}`;
    const res = await fetch(DASHSCOPE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen-audio-3.0-asr-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Transcribe the audio verbatim. Output only the transcription." },
            { type: "input_audio", input_audio: { data: dataUrl } },
          ],
        }],
        max_tokens: 300,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error("qwen asr failed: " + (data?.message || res.status));
    return data.choices?.[0]?.message?.content || "";
  }

  // Gemini 聽寫(百煉語音模型若失效,頂替轉寫)
  async function geminiTranscribeOnce(audioB64, mime) {
    const gkey = process.env.GEMINI_API_KEY;
    if (!gkey) throw new Error("gemini key missing");
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + gkey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: "This is a speech-recognition task. Transcribe the audio EXACTLY as spoken — do not guess, correct, or rephrase words. Output only the transcription." },
              { inline_data: { mime_type: mime || "audio/wav", data: audioB64 } },
            ],
          }],
          generationConfig: { maxOutputTokens: 300, temperature: 0 },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error("gemini asr failed: " + (data?.error?.message || res.status));
    return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("") || "";
  }

  // 轉寫:含服務名首詞即信任(單次調用,省 Gemini 配額);否則再跑一次防幻聽,取最接近的一份
  async function transcribeWithGemini(audioB64, mime, name) {
    const firstToken = (name || "").toLowerCase().split(/\s+/)[0] || "";
    const first = await geminiTranscribeOnce(audioB64, mime);
    if (first && first.toLowerCase().includes(firstToken)) return first;
    const attempts = [first, await geminiTranscribeOnce(audioB64, mime)].filter(Boolean);
    if (attempts.length === 0) throw new Error("gemini asr failed");
    const score = (s) => {
      const lower = s.toLowerCase();
      let sc = lower.includes(name.toLowerCase()) ? 100 : 0;
      for (const token of name.toLowerCase().split(/\s+/)) if (lower.includes(token)) sc += 30;
      return sc + Math.min(s.length, 200);
    };
    return attempts.sort((a, b) => score(b) - score(a))[0];
  }

  async function transcribeAudio(audioB64) {
    const token = await createNlsToken();
    const appkey = process.env.ALIYUN_ISI_APPKEY;
    if (!appkey) throw new Error("nls appkey missing");
    const audio = Buffer.from(audioB64, "base64");
    const qs = new URLSearchParams({ appkey, format: "wav", sample_rate: "16000", language_hints: "en" });
    const resp = await fetch(`https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr?${qs}`, {
      method: "POST",
      headers: { "X-NLS-Token": token, "Content-Type": "application/octet-stream" },
      body: audio,
    });
    const data = await resp.json();
    if (data.status !== 20000000) throw new Error("nls asr failed: " + (data.message || data.status));
    return data.result || "";
  }

  const callDashScope = async (prompt, retries = 2, useTextOnly = false) => {
    // OpenAI 相容格式:圖片用 image_url,語音(未轉寫)用 input_audio,已轉寫 → 純文本
    const content = useTextOnly
      ? [{ type: "text", text: prompt }]
      : audioBase64
        ? [
            { type: "text", text: prompt },
            {
              type: "input_audio",
              input_audio: { data: audioBase64, format: (mimeType || "audio/wav").includes("mp4") ? "mp3" : "wav" },
            },
          ]
        : [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` } },
          ];
    console.error("verify-proof DashScope req:", JSON.stringify({ useTextOnly, hasAudio: !!audioBase64, promptLen: (prompt || "").length }).slice(0, 200));
    const gemRes = await fetch(DASHSCOPE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: useTextOnly || !audioBase64 ? "qwen3.6-flash" : "qwen-audio-3.0-asr-flash",
        messages: [{ role: "user", content }],
        max_tokens: 300,
        enable_thinking: false,
        temperature: 0,
      }),
    });
    const data = await gemRes.json();
    if (!gemRes.ok) {
      // 429 配額超限:等待後重試
      if (gemRes.status === 429 && retries > 0) {
        await new Promise((r) => setTimeout(r, 3000));
        return callDashScope(prompt, retries - 1);
      }
      console.error("verify-proof DashScope error:", gemRes.status, "BODY:", JSON.stringify(data).slice(0, 500));
      return null;
    }
    const text = data.choices?.[0]?.message?.content || "";
    try {
      const v = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (typeof v.passed === "boolean") return v;
    } catch { /* fallthrough */ }
    console.error("verify-proof unparseable verdict:", text.slice(0, 300));
    return null;
  };

  try {
    // 語音:qwen3-asr-flash 高精度轉寫 → 文本雙審;NLS 降級備援
    // 圖片:直接雙重審核
    let transcript = "";
    let promptUseA, promptUseB;
    if (audioBase64) {
      try {
        transcript = await transcribeWithQwen(audioBase64, mimeType);
      } catch (e) {
        console.error("verify-proof qwen-asr error:", e.message);
        try {
          transcript = await transcribeWithGemini(audioBase64, mimeType, name);
        } catch (e2) {
          console.error("verify-proof gemini-asr error:", e2.message);
          try {
            transcript = await transcribeAudio(audioBase64);
          } catch (e3) {
            console.error("verify-proof NLS error:", e3.message);
            transcript = "";
          }
        }
      }
      if (!transcript) return res.json({ aiAvailable: true, passed: false, confidence: "low", reason: "The court heard nothing. Speak clearly and try again.", transcript: "" });
      // 用轉寫文本審核(替換提示詞的音頻描述為文本)
      promptUseA = audioPromptA.replace(
        "Listen to the audio and transcribe it.",
        `The witness testified: "${transcript}"`
      );
      promptUseB = audioPromptB.replace(
        "Your ONLY job: is the cancellation statement credible?",
        `The witness testified: "${transcript}". Your ONLY job: is the cancellation statement credible?`
      );
    } else {
      promptUseA = promptA;
      promptUseB = promptB;
    }
    console.error("verify-proof prompts:", JSON.stringify({ a: (promptUseA || "").slice(0, 180), b: (promptUseB || "").slice(0, 180) }).slice(0, 500));
    // 圖片:送截圖給 AI 看(useTextOnly=false);錄音:已轉寫成文本,純文本審核
    const [verdictA, verdictB] = await Promise.all([
      callDashScope(promptUseA, 2, !!audioBase64),
      callDashScope(promptUseB, 2, !!audioBase64),
    ]);
    if (!verdictA || !verdictB) {
      return res.status(502).json({ aiAvailable: false, error: "ai upstream error" });
    }
    console.error("verify-proof verdicts:", JSON.stringify({ a: verdictA, b: verdictB }).slice(0, 400));
    let passed = verdictA.passed && verdictB.passed;
    // 審稿分歧:第三位獨立評審,多數決(單一審稿員偶發誤判不致誤殺)
    if (verdictA.passed !== verdictB.passed) {
      // C 用完整模板(A 式):B 式預設信任 A 的名字檢查,平手時不能拿 B 當裁判
      const verdictC = await callDashScope(promptUseA, 2, !!audioBase64);
      if (!verdictC) {
        return res.status(502).json({ aiAvailable: false, error: "ai upstream error" });
      }
      console.error("verify-proof verdictC:", JSON.stringify(verdictC).slice(0, 300));
      passed = [verdictA, verdictB, verdictC].filter((v) => v.passed).length >= 2;
    }
    const reason = passed
      ? pick(PASS_LINES)
      : pick(FAIL_LINES);
    return res.json({
      aiAvailable: true,
      passed,
      confidence: passed
        ? (verdictA.confidence === "high" && verdictB.confidence === "high" ? "high" : "medium")
        : "low",
      reason,
      ...(audioBase64 ? { transcript } : {}),
    });
  } catch (e) {
    console.error("verify-proof error:", e.message);
    return res.status(502).json({ aiAvailable: false, error: "ai unreachable" });
  }
}
