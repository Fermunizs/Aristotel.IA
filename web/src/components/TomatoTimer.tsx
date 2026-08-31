"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tomato } from "./art";

const PRESETS = [15, 25, 45];

export function TomatoTimer({ readOnly }: { readOnly?: boolean }) {
  const router = useRouter();
  const [mins, setMins] = useState(25);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => void (tick.current && clearInterval(tick.current));
  }, [running]);

  useEffect(() => {
    if (left > 0 || !running) return;
    setRunning(false);
    setDone(true);
    if (!readOnly) {
      fetch("/api/focus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ minutes: mins }),
      }).then(() => router.refresh());
    }
  }, [left, running, mins, readOnly, router]);

  function choose(m: number) {
    setMins(m);
    setLeft(m * 60);
    setRunning(false);
    setDone(false);
  }
  function reset() {
    setLeft(mins * 60);
    setRunning(false);
    setDone(false);
  }

  const progress = 1 - left / (mins * 60);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 300, height: 300 }}>
        <Tomato progress={done ? 1 : progress} size={300} />
        <div
          className="absolute inset-x-0 flex flex-col items-center"
          style={{ top: "54%", transform: "translateY(-50%)" }}
        >
          <span
            className="text-[2.7rem] leading-none tracking-tight"
            style={{ fontFamily: "var(--font-mono)", color: "#fff", textShadow: "0 1px 6px rgba(43,38,33,.35)" }}
          >
            {mm}:{ss}
          </span>
          {done && <span className="mt-1 text-sm font-medium text-white">maduro 🍅</span>}
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => choose(m)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              mins === m ? "border-clay bg-clay-soft text-clay" : "border-line text-ink-soft"
            }`}
          >
            {m} min
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          disabled={readOnly || done}
          className="rounded-full bg-clay px-6 py-2.5 font-medium text-paper disabled:opacity-40"
        >
          {running ? "Pausar" : left < mins * 60 ? "Continuar" : "Começar"}
        </button>
        <button onClick={reset} className="rounded-full border border-line px-4 py-2.5 text-sm text-ink-soft">
          Zerar
        </button>
      </div>
    </div>
  );
}
