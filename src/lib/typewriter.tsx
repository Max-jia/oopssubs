// 打字機效果 + 機械鍵盤音效(Web Audio 合成,零依賴)

import { useEffect, useState } from "react";

let audioCtx: AudioContext | null = null;

// 機械鍵盤「嗒」聲:短促方波 click(低音量)
export function typeClick() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1900, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.02);
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.035);
  } catch { /* 音效失敗不影響打字 */ }
}

// 詞組嗒嗒打字機:逐詞敲出(每詞一聲機械嗒),比逐字快數倍
export function Typewriter({ words, wordSpeed = 140, startDelay = 0, sound = true, onComplete, className }: {
  words: string[];
  wordSpeed?: number;
  startDelay?: number;
  sound?: boolean;
  onComplete?: () => void;
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setCount(0);
    setDone(false);
    if (!words.length) return;
    let i = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      timer = setInterval(() => {
        i++;
        setCount(i);
        if (sound) typeClick();
        if (i >= words.length) {
          if (timer) clearInterval(timer);
          setDone(true);
          onComplete?.();
        }
      }, wordSpeed);
    }, startDelay);
    return () => { clearTimeout(startTimer); if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.join("|")]);

  const shown = words.slice(0, count).join(" ");
  return (
    <span className={className}>
      {shown}
      {/* 打字游標:未完成時顯示 */}
      {!done && <span className="type-cursor">|</span>}
    </span>
  );
}
