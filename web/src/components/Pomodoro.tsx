"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FOCUS = 25 * 60;

export default function Pomodoro({ readOnly }: { readOnly?: boolean }) {
  const router = useRouter();
  const [left, setLeft] = useState(FOCUS);
  const [running, setRunning] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => void (tick.current && clearInterval(tick.current));
  }, [running]);

  useEffect(() => {
    if (left > 0) return;
    setRunning(false);
    setLeft(FOCUS);
    if (!readOnly) {
      fetch("/api/focus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ minutes: 25 }),
      }).then(() => router.refresh());
    }
  }, [left, readOnly, router]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="card flex items-center justify-between p-4">
      <div>
        <p className="text-sm text-muted">Foco</p>
        <p className="font-mono text-3xl tabular-nums">
          {mm}:{ss}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          disabled={readOnly}
          className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          {running ? "Pausar" : "Começar"}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setLeft(FOCUS);
          }}
          className="rounded-lg border border-line px-3 py-2 text-sm text-muted"
        >
          Zerar
        </button>
      </div>
    </div>
  );
}
