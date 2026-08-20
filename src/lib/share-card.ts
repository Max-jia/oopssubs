// 偵探破案風分享卡:Canvas 繪製 1080x1350 PNG(零依賴)
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

  // 背景漸層
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0A0A0C");
  bg.addColorStop(0.55, "#151519");
  bg.addColorStop(1, "#0A0A0C");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 筆記本格線
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 56) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // 角落金色膠帶
  const tape = (x: number, y: number, angle: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(255,179,64,0.13)";
    ctx.fillRect(-90, -22, 180, 44);
    ctx.strokeStyle = "rgba(255,179,64,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-90, -22, 180, 44);
    ctx.restore();
  };
  tape(70, 150, -0.5);
  tape(W - 70, H - 150, -0.5);

  // 頂部
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFB340";
  ctx.font = "800 30px -apple-system, sans-serif";
  ctx.fillText("DETECTIVE FILE", 64, 100);
  ctx.fillStyle = "#98989F";
  ctx.font = "600 24px -apple-system, sans-serif";
  ctx.fillText("SUBSCRIPTION CASES · 2026", 64, 140);
  ctx.textAlign = "right";
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "800 44px -apple-system, sans-serif";
  ctx.fillText(fmt(total), W - 64, 106);
  ctx.fillStyle = "#98989F";
  ctx.font = "600 22px -apple-system, sans-serif";
  ctx.fillText("RECOVERED", W - 64, 142);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(64, 175); ctx.lineTo(W - 64, 175); ctx.stroke();

  // 等級徽章
  const rank = rankTitle(data.cases);
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "700 30px -apple-system, sans-serif";
  const bw = ctx.measureText(`DETECTIVE · ${data.cases} CASES CLOSED`).width + 72;
  ctx.strokeStyle = "rgba(255,179,64,0.55)";
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(255,179,64,0.06)";
  roundRect(ctx, (W - bw) / 2, 215, bw, 62, 31);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FFB340";
  ctx.fillText(`DETECTIVE · ${data.cases} CASES CLOSED`, W / 2, 256);
  ctx.restore();

  // 中央大金額
  ctx.textAlign = "center";
  ctx.fillStyle = "#6E6E76";
  ctx.font = "600 26px -apple-system, sans-serif";
  ctx.fillText("RECOVERED FROM FORGOTTEN SUBSCRIPTIONS", W / 2, 420);
  const g = ctx.createLinearGradient(0, 470, 0, 670);
  g.addColorStop(0, "#FFC766");
  g.addColorStop(1, "#FF9F0A");
  ctx.fillStyle = g;
  ctx.font = "800 190px -apple-system, sans-serif";
  ctx.fillText(fmt(total), W / 2, 600);
  ctx.fillStyle = "#98989F";
  ctx.font = "700 34px -apple-system, sans-serif";
  ctx.fillText("PER YEAR", W / 2, 660);

  // 破案清單(最近 5 個)
  const closed = data.closed.slice(-5);
  ctx.textAlign = "left";
  let y = 760;
  for (const c of closed) {
    const amt = Math.round(annual(c.amount, c.cycle));
    ctx.fillStyle = "#6E6E76";
    ctx.font = "800 26px -apple-system, sans-serif";
    ctx.fillText("CASE", 96, y);
    ctx.fillStyle = "#F5F5F7";
    ctx.font = "600 34px -apple-system, sans-serif";
    ctx.fillText(c.name, 250, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#30D158";
    ctx.font = "700 30px -apple-system, sans-serif";
    ctx.fillText(fmt(amt), W - 300, y);
    // CLOSED 小章
    ctx.save();
    ctx.translate(W - 150, y - 10);
    ctx.rotate(-0.1);
    ctx.strokeStyle = "#30D158";
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "transparent";
    ctx.font = "800 22px -apple-system, sans-serif";
    const tw = ctx.measureText("CLOSED").width + 28;
    roundRect(ctx, -tw / 2, -24, tw, 44, 8);
    ctx.stroke();
    ctx.fillStyle = "#30D158";
    ctx.fillText("CLOSED", 0, 7);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.moveTo(96, y + 34); ctx.lineTo(W - 96, y + 34); ctx.stroke();
    y += 78;
  }

  // RECOVERED 大紅章(蓋在金額右側)
  ctx.save();
  ctx.translate(W - 210, 545);
  ctx.rotate(-0.21);
  ctx.strokeStyle = "#FF453A";
  ctx.lineWidth = 8;
  ctx.fillStyle = "rgba(255,69,58,0.05)";
  ctx.font = "900 72px -apple-system, sans-serif";
  const sw = ctx.measureText("RECOVERED").width + 80;
  roundRect(ctx, -sw / 2, -55, sw, 110, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#FF453A";
  ctx.textAlign = "center";
  ctx.fillText("RECOVERED", 0, 16);
  ctx.restore();

  // 底部品牌
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = "/logo-gold.png"; });
    ctx.drawImage(img, 64, H - 140, 76, 76);
  } catch { /* logo 載入失敗就跳過 */ }
  ctx.textAlign = "left";
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "800 36px -apple-system, sans-serif";
  ctx.fillText("OopsSubs", 164, H - 88);
  ctx.fillStyle = "#6E6E76";
  ctx.font = "500 26px -apple-system, sans-serif";
  ctx.fillText("oopssubs.com", 164, H - 48);
  ctx.textAlign = "right";
  ctx.fillStyle = "#6E6E76";
  ctx.font = "600 22px -apple-system, sans-serif";
  ctx.fillText("FIND YOURS →", W - 64, H - 60);

  return canvas.toDataURL("image/png");
}
