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

// 打字機組件:text 含 \n 會換行;完成時 onComplete + 金色 class 切換
export function Typewriter({ text, speed = 70, startDelay = 0, sound = true, onComplete, className, doneClassName }: {
  text: string;
  speed?: number;
  startDelay?: number;
  sound?: boolean;
  onComplete?: () => void;
  className?: string;
  doneClassName?: string;
}) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setCount(0);
    setDone(false);
    if (!text) return;
    let i = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      timer = setInterval(() => {
        i++;
        setCount(i);
        if (sound) typeClick();
        if (i >= text.length) {
          if (timer) clearInterval(timer);
          setDone(true);
          onComplete?.();
        }
      }, speed);
    }, startDelay);
    return () => { clearTimeout(startTimer); if (timer) clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const shown = text.slice(0, count);
  const finalClass = done && doneClassName ? doneClassName : className;
  return (
    <span className={finalClass}>
      {shown.split("\n").map((line, i) => (
        <span key={i}>
          {line}
          {i < shown.split("\n").length - 1 && <br />}
        </span>
      ))}
      {/* 打字游標:未完成時顯示 */}
      {!done && <span className="type-cursor">|</span>}
    </span>
  );
}
