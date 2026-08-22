// 偵探破案風分享卡:Canvas 繪製 PNG(零依賴,QR 除外)
// 版本 C2:WANTED 通緝令 v3(垂直堆疊佈局,三區:hero/證據/CTA,互不搶位)
import QRCode from "qrcode";

export interface ShareData {
  cases: number;
  streak: number;
  recovered: number; // 年度化總額
  closed: { name: string; amount: number; cycle: string }[]; // 最近 N 個
}

export interface ShareCardOptions {
  ratio?: "4:5" | "1:1";
}

const QR_TARGET = "https://oopssubs.com";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function rankTitle(cases: number): string {
  if (cases >= 30) return "CHIEF INSPECTOR";
  if (cases >= 15) return "INSPECTOR";
  if (cases >= 5) return "DETECTIVE";
  if (cases >= 1) return "JUNIOR DETECTIVE";
  return "CADET";
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// 字體太大就等比縮小,直到放得進 maxW(長金額保命)
function fitFont(ctx: CanvasRenderingContext2D, font: string, text: string, maxW: number): string {
  let f = font;
  while (ctx.measureText(text).width > maxW) {
    const next = f.replace(/(\d+(?:\.\d+)?)px/, (m, n) => Math.round(parseFloat(n) * 0.85) + "px");
    if (next === f) break;
    f = next;
  }
  return f;
}

export async function drawShareCard(data: ShareData, opts: ShareCardOptions = {}): Promise<string> {
  const ratio = opts.ratio ?? "4:5";
  const W = 1080, H = ratio === "1:1" ? 1080 : 1350;
  const s = H / 1350; // 1:1 時全圖等比縮 0.8,佈局共用同一套
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const annual = (a: number, c: string) => (c === "yearly" ? a : a * 12);
  const total = Math.round(data.recovered);
  // 同名合併:同服務加總金額,標 ×N(避免 Duolingo 出現兩次)
  const merged = new Map<string, { name: string; amount: number; count: number }>();
  for (const c of data.closed) {
    const k = c.name.trim().toLowerCase();
    const amt = annual(c.amount, c.cycle);
    const cur = merged.get(k);
    if (cur) { cur.amount += amt; cur.count += 1; }
    else merged.set(k, { name: c.name, amount: amt, count: 1 });
  }
  const closed = Array.from(merged.values()).sort((a, b) => b.amount - a.amount).slice(0, 3);
  const shown = closed.length;
  const more = Math.max(0, data.cases - shown);

  // 背景:radial 深色
  const bg = ctx.createRadialGradient(W / 2, H * 0.18, 100 * s, W / 2, H / 2, H * 0.9);
  bg.addColorStop(0, "#1A1A20");
  bg.addColorStop(0.6, "#0D0D10");
  bg.addColorStop(1, "#0A0A0C");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 做舊噪點
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  for (let i = 0; i < 900; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.6 * s, 1.6 * s);
  }

  // 金邊框
  ctx.strokeStyle = "rgba(255,179,64,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // ── Zone 1:Hero(標題 + icon) ──
  ctx.textAlign = "center";
  ctx.fillStyle = "#F5F5F7";
  ctx.font = `900 ${96 * s}px -apple-system, sans-serif`;
  ctx.save();
  ctx.translate(W / 2, 128 * s);
  ctx.letterSpacing = "24px";
  ctx.fillText("WANTED", 0, 0);
  ctx.restore();
  ctx.fillStyle = "#FFB340";
  ctx.font = `600 ${25 * s}px -apple-system, sans-serif`;
  ctx.letterSpacing = "4px";
  ctx.fillText("FOR HIDING IN YOUR", W / 2, 192 * s);
  ctx.fillText("SUBSCRIPTIONS", W / 2, 224 * s);

  // 金帽 logo(獨立區,不跟數字重疊)
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = "/logo-gold.png"; });
    ctx.save();
    ctx.shadowColor = "rgba(255,179,64,0.3)";
    ctx.shadowBlur = 24;
    roundRect(ctx, W / 2 - 100 * s, 232 * s, 200 * s, 200 * s, 24 * s);
    ctx.strokeStyle = "#FFB340";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    roundRect(ctx, W / 2 - 100 * s, 232 * s, 200 * s, 200 * s, 24 * s);
    ctx.clip();
    ctx.drawImage(img, W / 2 - 100 * s, 232 * s, 200 * s, 200 * s);
    ctx.restore();
  } catch { /* logo 失敗跳過 */ }

  // ── Zone 2:證據數字(數量 → 金額,上下兩層,互不搶位) ──
  // ── Zone 2:證據數字(一句「12 SUBSCRIPTIONS CAUGHT」→ 金額,閱讀流不中斷) ──
  const pre = `${data.cases} SUBSCRIPTIONS`;
  ctx.font = fitFont(ctx, `900 ${52 * s}px -apple-system, sans-serif`, `${pre} CAUGHT`, W * 0.9);
  const w1 = ctx.measureText(pre).width;
  const ws = ctx.measureText(" ").width;
  const w2 = ctx.measureText("CAUGHT").width;
  const x0 = (W - w1 - ws - w2) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = "#F5F5F7";
  ctx.fillText(pre, x0, 506 * s);
  ctx.fillStyle = "#FFB340";
  ctx.fillText("CAUGHT", x0 + w1 + ws, 506 * s);

  // 金額:全圖第二視覺中心,居中
  const g = ctx.createLinearGradient(W / 2 - 480 * s, 0, W / 2 + 480 * s, 0);
  g.addColorStop(0, "#FFE29A");
  g.addColorStop(0.5, "#FFB340");
  g.addColorStop(1, "#E8930C");
  ctx.fillStyle = g;
  ctx.textAlign = "center";
  ctx.font = fitFont(ctx, `900 ${186 * s}px -apple-system, sans-serif`, fmt(total), W * 0.85);
  ctx.fillText(fmt(total), W / 2, 700 * s);
  ctx.fillStyle = "#98989F";
  ctx.font = `700 ${27 * s}px -apple-system, sans-serif`;
  ctx.letterSpacing = "8px";
  ctx.fillText("/ YEAR FOUND", W / 2, 742 * s);

  // ── Zone 3:證據列表(最多 3 行,同名合併) ──
  let y = 806 * s;
  for (const c of closed) {
    const label = c.count > 1 ? `${c.name} ×${c.count}` : c.name;
    ctx.save();
    roundRect(ctx, 120 * s, y, W - 240 * s, 88 * s, 14 * s);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "left";
    ctx.fillStyle = "#F5F5F7";
    ctx.font = `700 ${28 * s}px -apple-system, sans-serif`;
    ctx.fillText(label.toUpperCase(), 160 * s, y + 48 * s);
    ctx.fillStyle = "#98989F";
    ctx.font = `500 ${18 * s}px -apple-system, sans-serif`;
    ctx.fillText(`CHARGE: ${fmt(c.amount)}/YEAR · FOUND`, 160 * s, y + 78 * s);
    ctx.textAlign = "right";
    ctx.fillStyle = "#30D158";
    ctx.font = `700 ${26 * s}px -apple-system, sans-serif`;
    ctx.fillText(fmt(c.amount), W - 160 * s, y + 52 * s);
    y += 100 * s;
  }

  // 還有 N 個沒列出(金額邏輯閉環)
  // 列表行數不足 3 時,9 MORE 跟列表上移;品牌區(QR/OopSubs/鉤子)4:5 跟上、1:1 固定貼底
  const lift = (3 - closed.length) * 100 * s;
  const bottomLift = ratio === "1:1" ? 0 : lift;
  if (more > 0) {
    ctx.fillStyle = "#98989F";
    ctx.font = `700 ${20 * s}px -apple-system, sans-serif`;
    ctx.letterSpacing = "3px";
    ctx.fillText(`${more} MORE SUBSCRIPTION${more > 1 ? "S" : ""}`, W / 2, 1136 * s - lift);
  }

  // CASE CLOSED 紅章:獨立裝飾徽章,蓋右上角空白(內移到金框內,預留安全邊距)
  ctx.save();
  ctx.translate(W - 230 * s, 370 * s);
  ctx.rotate(-0.24);
  ctx.strokeStyle = "#FF453A";
  ctx.lineWidth = 3;
  ctx.fillStyle = "rgba(255,69,58,0.06)";
  ctx.font = `900 ${26 * s}px -apple-system, sans-serif`;
  ctx.letterSpacing = "4px";
  const sw = ctx.measureText("CASE CLOSED").width + 56;
  roundRect(ctx, -sw / 2, -30 * s, sw, 60 * s, 12 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FF453A";
  ctx.textAlign = "center";
  ctx.fillText("CASE CLOSED", 0, 9 * s);
  ctx.restore();

  // ── Zone 4:CTA(QR+標籤 左,品牌鉤子 中,整體留白不貼邊) ──
  try {
    const qr = await QRCode.toDataURL(QR_TARGET, {
      width: 320, margin: 0,
      color: { dark: "#0D0D10", light: "#FFFFFF" },
    });
    const q = new Image();
    await new Promise<void>((res, rej) => { q.onload = () => res(); q.onerror = () => rej(); q.src = qr; });
    const size = 80 * s;
    const qx = 64 * s, qy = 1174 * s - bottomLift;
    // 金框 + 光暈:黑底上讓 QR 跳出來(轉化入口)
    ctx.save();
    ctx.shadowColor = "rgba(255,179,64,0.55)";
    ctx.shadowBlur = 24 * s;
    roundRect(ctx, qx, qy, size, size, 10 * s);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#FFB340";
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.restore();
    ctx.drawImage(q, qx + 6 * s, qy + 6 * s, size - 12 * s, size - 12 * s);
    // 標籤與 QR 垂直堆疊,成一個轉化元素
    ctx.fillStyle = "#6E6E76";
    ctx.font = `600 ${13 * s}px -apple-system, sans-serif`;
    ctx.letterSpacing = "2px";
    ctx.textAlign = "left";
    ctx.fillText("SCAN TO FIND YOURS", qx, qy + size + 20 * s);
  } catch { /* QR 失敗不擋分享 */ }

  // 中下:品牌 + 社交鉤子(兩行居中,間距放鬆)
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFB340";
  ctx.font = `800 ${26 * s}px -apple-system, sans-serif`;
  ctx.fillText("OopSubs", W / 2, 1210 * s - bottomLift);
  ctx.fillStyle = "#98989F";
  ctx.font = `700 ${22 * s}px -apple-system, sans-serif`;
  ctx.fillText("How much are yours costing you?", W / 2, 1258 * s - bottomLift);

  return canvas.toDataURL("image/png");
}

// 社交台詞:生成卡片時同步備好,一鍵複製或帶入分享面板
export function buildCaption(data: ShareData): string {
  const total = Math.round(data.recovered);
  return `I just found ${fmt(total)}/year in subscriptions I forgot about. How much are you wasting? 🕵️`;
}

// 分享卡先寫入暫存檔,返回 file:// URI(原生外掛對 data URI 不穩)
async function persistShareImage(dataUrl: string): Promise<string | null> {
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const base64 = dataUrl.split(",")[1];
    const name = `share-${Date.now()}.png`;
    await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
    return uri;
  } catch {
    return null;
  }
}

// 保存分享卡到相簿(App 內用 Media 外掛;網站版用 download)
export async function saveShareToPhotos(dataUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const uri = await persistShareImage(dataUrl);
    if (!uri) return { ok: false, error: "temp file failed" };
    const { Media } = await import("@capacitor-community/media");
    // Android 需要 albumIdentifier——確保 OopsSubs 相簿存在
    const albums = (await Media.getAlbums()).albums;
    let album = albums.find((a) => a.name === "OopsSubs");
    if (!album) {
      await Media.createAlbum({ name: "OopsSubs" });
      const after = (await Media.getAlbums()).albums;
      album = after.find((a) => a.name === "OopsSubs");
    }
    if (album) {
      await Media.savePhoto({ path: uri, albumIdentifier: album.identifier });
    } else {
      await Media.savePhoto({ path: uri });
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e?.code || e).slice(0, 60) };
  }
}

// App 內原生分享(寫暫存檔後分享文件;可帶社交台詞)
export async function shareCardNative(dataUrl: string, text?: string): Promise<void> {
  const uri = await persistShareImage(dataUrl);
  const { Share } = await import("@capacitor/share");
  if (uri) {
    await Share.share({ title: "OopsSubs case report", text, files: [uri], dialogTitle: "Share your case report" });
  } else {
    await Share.share({ title: "OopsSubs case report", text, url: dataUrl, dialogTitle: "Share your case report" });
  }
}

// ── 版本 C:結案檔案夾封面(報告頁分享用) ──
export async function drawFileCard(data: ShareData): Promise<string> {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const annual = (a: number, c: string) => (c === "yearly" ? a : a * 12);
  const total = Math.round(data.recovered);
  const closed = data.closed.slice(-5);

  // 牛皮紙背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#C9A87C");
  bg.addColorStop(0.45, "#B8925F");
  bg.addColorStop(1, "#A67C49");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 紙紋(橫線)
  ctx.strokeStyle = "rgba(43,33,22,0.07)";
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 4) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // 標籤(CONFIDENTIAL)——深棕底,與全站風格統一(不用金)
  ctx.fillStyle = "#3E2F1C";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 210, 0); ctx.lineTo(W / 2 + 210, 0);
  ctx.lineTo(W / 2 + 210, 96); ctx.lineTo(W / 2 - 210, 96);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#E8D5B5";
  ctx.textAlign = "center";
  ctx.font = "900 30px -apple-system, sans-serif";
  ctx.letterSpacing = "8px";
  ctx.fillText("CONFIDENTIAL", W / 2, 62);

  // 內框
  ctx.strokeStyle = "rgba(43,33,22,0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, W - 120, H - 120);

  // 標題
  ctx.fillStyle = "#2B2116";
  ctx.font = "900 78px -apple-system, sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("CASE FILE", W / 2, 260);
  ctx.fillStyle = "#6B4F2E";
  ctx.font = "800 34px -apple-system, sans-serif";
  ctx.letterSpacing = "8px";
  ctx.fillText(`FILE #${data.cases} · 2026`, W / 2, 320);

  // 分隔線
  ctx.strokeStyle = "rgba(43,33,22,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(140, 370); ctx.lineTo(W - 140, 370); ctx.stroke();

  // 欄位
  const field = (label: string, value: string, y: number, gold = false) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#6B4F2E";
    ctx.font = "800 22px -apple-system, sans-serif";
    ctx.letterSpacing = "4px";
    ctx.fillText(label.toUpperCase(), 140, y);
    ctx.fillStyle = gold ? "#7A4E12" : "#2B2116";
    ctx.font = "800 42px -apple-system, sans-serif";
    ctx.letterSpacing = "0px";
    ctx.fillText(value, 140, y + 52);
  };
  field("Subject", "Your forgotten subscriptions", 440);
  field("Status", `${data.cases} CASES CLOSED · ${rankTitle(data.cases)}`, 550);
  field("Recovered", `${fmt(total)} / YEAR`, 680, true);

  // 破案清單
  let y = 820;
  ctx.textAlign = "left";
  for (const c of closed) {
    ctx.fillStyle = "#2B2116";
    ctx.font = "700 30px -apple-system, sans-serif";
    ctx.fillText(c.name, 140, y);
    ctx.fillStyle = "#1E7A3A";
    ctx.font = "900 22px -apple-system, sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillText("CLOSED", W - 140 - ctx.measureText("CLOSED").width, y);
    ctx.strokeStyle = "rgba(43,33,22,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(140, y + 26); ctx.lineTo(W - 140, y + 26); ctx.stroke();
    y += 78;
  }

  // CLOSED 大紅章
  ctx.save();
  ctx.translate(W - 220, 1030);
  ctx.rotate(-0.2);
  ctx.strokeStyle = "#B3261E";
  ctx.lineWidth = 6;
  ctx.fillStyle = "rgba(179,38,30,0.08)";
  ctx.font = "900 56px -apple-system, sans-serif";
  ctx.letterSpacing = "4px";
  const sw = ctx.measureText("CLOSED").width + 80;
  roundRect(ctx, -sw / 2, -52, sw, 104, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#B3261E";
  ctx.textAlign = "center";
  ctx.fillText("CLOSED", 0, 16);
  ctx.restore();

  // 底部品牌
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = "/logo-gold.png"; });
    ctx.drawImage(img, 140, H - 175, 64, 64);
  } catch { /* 跳過 */ }
  ctx.textAlign = "left";
  ctx.fillStyle = "#2B2116";
  ctx.font = "800 30px -apple-system, sans-serif";
  ctx.fillText("OopsSubs", 226, H - 132);
  ctx.fillStyle = "#6B4F2E";
  ctx.font = "500 22px -apple-system, sans-serif";
  ctx.fillText("oopssubs.com", 226, H - 92);

  return canvas.toDataURL("image/png");
}
