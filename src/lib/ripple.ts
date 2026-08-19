// 點擊漣漪：全局監聽 pointerdown，在主/次按鈕上從實際點擊點擴散
// （CSS :active 方案手指抬起即中斷動畫，JS 方案動畫完整播完）
let registered = false;

export function enableRipple() {
  if (typeof window === "undefined" || registered) return;
  registered = true;
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest?.(".btn-primary, .btn-secondary, .btn-gold");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const span = document.createElement("span");
    span.className = "ripple-fx";
    span.style.left = `${e.clientX - rect.left}px`;
    span.style.top = `${e.clientY - rect.top}px`;
    btn.appendChild(span);
    setTimeout(() => span.remove(), 520);
  });
}
