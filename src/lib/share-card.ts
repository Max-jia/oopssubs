// 偵探破案風分享卡:Canvas 繪製 1080x1350 PNG(零依賴)
// 版本 B:WANTED 通緝令海報
interface ShareData {
  cases: number;
  streak: number;
  recovered: number; // 年度化總額
  closed: { name: string; amount: number; cycle: string }[]; // 最近 N 個
}

const W = 1080, H = 1350;

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

export async function drawShareCard(data: ShareData): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const annual = (a: number, c: string) => (c === "yearly" ? a : a * 12);
  const total = Math.round(data.recovered);
  const closed = data.closed.slice(-3);

  // 背景:radial 深色
  const bg = ctx.createRadialGradient(W / 2, H * 0.2, 100, W / 2, H / 2, H * 0.9);
  bg.addColorStop(0, "#1A1A20");
  bg.addColorStop(0.6, "#0D0D10");
  bg.addColorStop(1, "#0A0A0C");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 做舊噪點
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  for (let i = 0; i < 900; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
  }

  // 金邊框
  ctx.strokeStyle = "rgba(255,179,64,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // WANTED 大標
  ctx.textAlign = "center";
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "900 118px -apple-system, sans-serif";
  ctx.save();
  ctx.translate(W / 2, 250);
  ctx.letterSpacing = "26px";
  ctx.fillText("WANTED", 0, 0);
  ctx.restore();
  ctx.fillStyle = "#FFB340";
  ctx.font = "600 28px -apple-system, sans-serif";
  ctx.letterSpacing = "8px";
  ctx.fillText("FOR UNLICENSED SUBSCRIPTION CHARGES", W / 2, 310);

  // 頭像(金帽 logo)
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = "/logo-gold.png"; });
    ctx.save();
    ctx.shadowColor = "rgba(255,179,64,0.3)";
    ctx.shadowBlur = 30;
    roundRect(ctx, W / 2 - 100, 350, 200, 200, 24);
    ctx.strokeStyle = "#FFB340";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    roundRect(ctx, W / 2 - 100, 350, 200, 200, 24);
    ctx.clip();
    ctx.drawImage(img, W / 2 - 100, 350, 200, 200);
    ctx.restore();
  } catch { /* logo 失敗跳過 */ }
  ctx.fillStyle = "#98989F";
  ctx.font = "600 24px -apple-system, sans-serif";
  ctx.fillText(`THE SUBSCRIPTION SQUAD · ${data.cases} APPREHENDED`, W / 2, 610);

  // 通緝犯名單
  let y = 700;
  for (const c of closed) {
    const amt = Math.round(annual(c.amount, c.cycle));
    ctx.save();
    roundRect(ctx, 120, y, W - 240, 128, 14);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "left";
    ctx.fillStyle = "#F5F5F7";
    ctx.font = "700 34px -apple-system, sans-serif";
    ctx.fillText(c.name.toUpperCase(), 160, y + 48);
    ctx.fillStyle = "#98989F";
    ctx.font = "500 20px -apple-system, sans-serif";
    ctx.fillText(`CHARGE: ${fmt(amt)}/YEAR · UNLICENSED CHARGES`, 160, y + 82);
    ctx.textAlign = "right";
    ctx.fillStyle = "#30D158";
    ctx.font = "700 30px -apple-system, sans-serif";
    ctx.fillText(fmt(amt), W - 160, y + 52);
    y += 152;
  }

  // APPREHENDED 紅章
  ctx.save();
  ctx.translate(W - 290, 680);
  ctx.rotate(-0.24);
  ctx.strokeStyle = "#FF453A";
  ctx.lineWidth = 5;
  ctx.fillStyle = "rgba(255,69,58,0.06)";
  ctx.font = "900 46px -apple-system, sans-serif";
  ctx.letterSpacing = "4px";
  const sw = ctx.measureText("APPREHENDED").width + 80;
  roundRect(ctx, -sw / 2, -52, sw, 104, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FF453A";
  ctx.textAlign = "center";
  ctx.fillText("APPREHENDED", 0, 16);
  ctx.restore();

  // 底部:品牌 + 等級
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = "/logo-gold.png"; });
    ctx.drawImage(img, 64, H - 140, 72, 72);
  } catch { /* 跳過 */ }
  ctx.textAlign = "left";
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "800 34px -apple-system, sans-serif";
  ctx.fillText("OopsSubs", 158, H - 92);
  ctx.fillStyle = "#6E6E76";
  ctx.font = "500 24px -apple-system, sans-serif";
  ctx.fillText("oopssubs.com", 158, H - 52);
  ctx.textAlign = "right";
  ctx.fillStyle = "#FFB340";
  ctx.font = "800 26px -apple-system, sans-serif";
  ctx.fillText(`${rankTitle(data.cases)} · ${data.cases} CASES`, W - 64, H - 92);
  ctx.fillStyle = "#98989F";
  ctx.font = "600 22px -apple-system, sans-serif";
  ctx.fillText(`${fmt(total)} RECOVERED / YEAR`, W - 64, H - 52);

  return canvas.toDataURL("image/png");
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

// App 內原生分享(寫暫存檔後分享文件)
export async function shareCardNative(dataUrl: string): Promise<void> {
  const uri = await persistShareImage(dataUrl);
  const { Share } = await import("@capacitor/share");
  if (uri) {
    await Share.share({ title: "OopsSubs case report", files: [uri], dialogTitle: "Share your case report" });
  } else {
    await Share.share({ title: "OopsSubs case report", url: dataUrl, dialogTitle: "Share your case report" });
  }
}

// ── 版本 C:結案檔案夾封面(報告頁分享用) ──
export async function drawFileCard(data: ShareData): Promise<string> {
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

  // 金色標籤(CONFIDENTIAL)
  ctx.fillStyle = "#FFB340";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 210, 0); ctx.lineTo(W / 2 + 210, 0);
  ctx.lineTo(W / 2 + 210, 96); ctx.lineTo(W / 2 - 210, 96);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#2B2116";
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
    ctx.fillStyle = gold ? "#8B5E1F" : "#2B2116";
    ctx.font = "800 42px -apple-system, sans-serif";
    ctx.letterSpacing = "0px";
    ctx.fillText(value, 140, y + 52);
  };
  field("Subject", "Your forgotten subscriptions", 440);
  field("Status", `${data.cases} CASES CLOSED`, 550);
  ctx.fillStyle = "#8B5E1F";
  ctx.font = "700 34px -apple-system, sans-serif";
  ctx.fillText(`${rankTitle(data.cases)}`, 140, 602);
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
    ctx.drawImage(img, 140, H - 130, 64, 64);
  } catch { /* 跳過 */ }
  ctx.textAlign = "left";
  ctx.fillStyle = "#2B2116";
  ctx.font = "800 30px -apple-system, sans-serif";
  ctx.fillText("OopsSubs", 226, H - 92);
  ctx.fillStyle = "#6B4F2E";
  ctx.font = "500 22px -apple-system, sans-serif";
  ctx.fillText("oopssubs.com", 226, H - 52);
  ctx.textAlign = "right";
  ctx.fillStyle = "#6B4F2E";
  ctx.font = "700 22px -apple-system, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("FIND YOURS →", W - 140, H - 60);

  return canvas.toDataURL("image/png");
}
