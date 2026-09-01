"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tomato } from "./art";

const CHIPS = [15, 25, 45, 50];
const MIN_FOCUS = 5;
const MAX_FOCUS = 90;
const ROUNDS_TO_LONG = 4; // pausa longa a cada 4 blocos de foco

type Phase = "idle" | "focus" | "break" | "long";

/** pausa curta ≈ foco/5 (3–10 min); pausa longa ≈ 3× a curta (15–25 min). */
function breaksFor(focus: number) {
  const short = Math.min(10, Math.max(3, Math.round(focus / 5)));
  const long = Math.min(25, Math.max(15, short * 3));
  return { short, long };
}

const LABEL: Record<Phase, string> = {
  idle: "",
  focus: "Foco",
  break: "Pausa",
  long: "Pausa longa",
};

export function TomatoTimer({ readOnly }: { readOnly?: boolean }) {
  const router = useRouter();
  const [focusMin, setFocusMin] = useState(25);
  const [phase, setPhase] = useState<Phase>("idle");
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0); // blocos de foco concluídos nesta sessão
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const { short, long } = breaksFor(focusMin);
  const phaseTotal =
    phase === "focus" ? focusMin * 60 : phase === "long" ? long * 60 : short * 60;

  // ── som (Web Audio, sem arquivo) ───────────────────────────────────
  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioRef.current = new Ctx();
    }
    void audioRef.current?.resume();
    return audioRef.current;
  }, []);

  const chime = useCallback((notes: number[]) => {
    const ac = audioRef.current;
    if (!ac) return;
    const t0 = ac.currentTime;
    notes.forEach((f, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      osc.connect(gain);
      gain.connect(ac.destination);
      const t = t0 + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }, []);

  const notify = useCallback((body: string) => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Aristótel.IA", { body, icon: "/icon-192.png" });
      }
      navigator.vibrate?.(180);
    } catch {
      /* sem suporte — o som já basta */
    }
  }, []);

  // ── relógio ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => void (tick.current && clearInterval(tick.current));
  }, [running]);

  // ── virada de fase ─────────────────────────────────────────────────
  useEffect(() => {
    if (left > 0 || !running) return;

    if (phase === "focus") {
      if (!readOnly) {
        fetch("/api/focus", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ minutes: focusMin }),
        }).then(() => router.refresh());
      }
      const done = rounds + 1;
      setRounds(done);
      const isLong = done % ROUNDS_TO_LONG === 0;
      const nextPhase: Phase = isLong ? "long" : "break";
      const mins = isLong ? long : short;
      chime([784, 988, 1175]); // "maduro" — sobe
      notify(`Bloco fechado. Pausa de ${mins} min — levanta, respira.`);
      setPhase(nextPhase);
      setLeft(mins * 60);
    } else {
      chime([988, 659]); // volta ao foco — desce
      notify("Fim da pausa. Bora pro próximo bloco.");
      setPhase("focus");
      setLeft(focusMin * 60);
    }
  }, [left, running, phase, rounds, focusMin, short, long, readOnly, chime, notify, router]);

  // ── controles ──────────────────────────────────────────────────────
  function setFocus(m: number) {
    const v = Math.max(MIN_FOCUS, Math.min(MAX_FOCUS, m));
    setFocusMin(v);
    if (phase === "idle") setLeft(v * 60);
  }

  function start() {
    ensureAudio();
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    } catch {
      /* ok */
    }
    if (phase === "idle") {
      setPhase("focus");
      setLeft(focusMin * 60);
    }
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setPhase("idle");
    setRounds(0);
    setLeft(focusMin * 60);
  }

  function skipBreak() {
    setPhase("focus");
    setLeft(focusMin * 60);
    setRunning(true);
  }

  const shown = Math.max(0, left);
  const mm = String(Math.floor(shown / 60)).padStart(2, "0");
  const ss = String(shown % 60).padStart(2, "0");
  const progress = phase === "idle" ? 0 : 1 - shown / phaseTotal;
  const onBreak = phase === "break" || phase === "long";

  return (
    <div className="flex flex-col items-center">
      {phase !== "idle" && (
        <span
          className={`mb-3 rounded-full px-3 py-1 text-xs font-medium ${
            onBreak ? "bg-growth-soft text-growth" : "bg-clay-soft text-clay"
          }`}
        >
          {LABEL[phase]}
          {phase === "focus" && rounds > 0 ? ` · bloco ${rounds + 1}` : ""}
        </span>
      )}

      <div className="relative" style={{ width: 300, height: 300 }}>
        <Tomato progress={progress} size={300} />
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
          {onBreak && <span className="mt-1 text-sm font-medium text-white">respira 🍃</span>}
        </div>
      </div>

      {phase === "idle" ? (
        <>
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={() => setFocus(focusMin - 5)}
              className="grid h-9 w-9 place-items-center rounded-full border border-line text-lg text-ink-soft"
              aria-label="menos 5 min"
            >
              –
            </button>
            <span className="num w-24 text-center text-xl">{focusMin} min</span>
            <button
              onClick={() => setFocus(focusMin + 5)}
              className="grid h-9 w-9 place-items-center rounded-full border border-line text-lg text-ink-soft"
              aria-label="mais 5 min"
            >
              +
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            {CHIPS.map((m) => (
              <button
                key={m}
                onClick={() => setFocus(m)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  focusMin === m ? "border-clay bg-clay-soft text-clay" : "border-line text-ink-soft"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-ink-soft">
            pausa de {short} min a cada bloco · {long} min a cada {ROUNDS_TO_LONG}
          </p>

          <button
            onClick={start}
            disabled={readOnly}
            className="mt-5 rounded-full bg-clay px-8 py-2.5 font-medium text-paper disabled:opacity-40"
          >
            Começar
          </button>
        </>
      ) : (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="rounded-full bg-clay px-6 py-2.5 font-medium text-paper"
          >
            {running ? "Pausar" : "Continuar"}
          </button>
          {onBreak && running && (
            <button
              onClick={skipBreak}
              className="rounded-full border border-line px-4 py-2.5 text-sm text-ink-soft"
            >
              pular pausa
            </button>
          )}
          <button
            onClick={reset}
            className="rounded-full border border-line px-4 py-2.5 text-sm text-ink-soft"
          >
            Encerrar
          </button>
        </div>
      )}

      {rounds > 0 && (
        <p className="mt-4 text-xs text-ink-soft">
          {rounds} bloco{rounds > 1 ? "s" : ""} de foco hoje · {rounds * focusMin} min
        </p>
      )}
    </div>
  );
}
