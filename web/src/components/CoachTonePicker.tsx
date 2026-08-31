"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TONES: { key: string; label: string; desc: string }[] = [
  { key: "gentil", label: "Gentil", desc: "No seu ritmo, com leveza" },
  { key: "equilibrada", label: "Equilibrada", desc: "Sincera e firme, sem peso" },
  { key: "durona", label: "Durona", desc: "Sem passar a mão na cabeça" },
];

export function CoachTonePicker({ current, readOnly }: { current: string; readOnly?: boolean }) {
  const router = useRouter();
  const [tone, setTone] = useState(current);
  const [busy, setBusy] = useState(false);

  async function pick(k: string) {
    if (readOnly || k === tone) return;
    setTone(k);
    setBusy(true);
    await fetch("/api/prefs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coachTone: k }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {TONES.map((t) => (
        <button
          key={t.key}
          onClick={() => pick(t.key)}
          disabled={readOnly || busy}
          className={`card p-3 text-left transition ${
            tone === t.key ? "border-clay bg-clay-soft" : "hover:border-clay/40"
          }`}
        >
          <p className={`font-medium ${tone === t.key ? "text-clay" : ""}`}>{t.label}</p>
          <p className="mt-0.5 text-[0.7rem] text-ink-soft">{t.desc}</p>
        </button>
      ))}
    </div>
  );
}
