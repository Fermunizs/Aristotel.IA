"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TONES = [
  { key: "gentil", label: "Gentil", desc: "No seu ritmo, com leveza" },
  { key: "equilibrada", label: "Equilibrada", desc: "Sincera e firme, sem peso" },
  { key: "durona", label: "Durona", desc: "Pega no pé de verdade, sem amaciar" },
];

async function save(body: unknown) {
  await fetch("/api/prefs", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function AjustesForm({
  tone,
  note,
  readOnly,
}: {
  tone: string;
  note: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [t, setT] = useState(tone);
  const [n, setN] = useState(note);
  const firstN = useRef(true);

  useEffect(() => {
    if (firstN.current) return void (firstN.current = false);
    if (readOnly || n === note) return;
    const id = setTimeout(async () => {
      await save({ coachNote: n });
      router.refresh();
    }, 700);
    return () => clearTimeout(id);
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pickTone(k: string) {
    if (readOnly || k === t) return;
    setT(k);
    await save({ coachTone: k });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label mb-2">Como ela te cobra</p>
        <div className="grid grid-cols-3 gap-2">
          {TONES.map((o) => (
            <button
              key={o.key}
              onClick={() => pickTone(o.key)}
              disabled={readOnly}
              className={`card p-3 text-left transition ${
                t === o.key ? "border-clay bg-clay-soft" : "hover:border-clay/40"
              }`}
            >
              <p className={`font-medium ${t === o.key ? "text-clay" : ""}`}>{o.label}</p>
              <p className="mt-0.5 text-[0.7rem] text-ink-soft">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label mb-2">Um pedido seu</p>
        <div className="card p-4">
          <p className="mb-2 text-xs text-ink-soft">
            Algo que você quer que ela sempre considere ao falar com você. Ex: &ldquo;me trate como
            alguém que já trabalha na área&rdquo;, &ldquo;evita jargão&rdquo;, &ldquo;me lembra dos
            porquês&rdquo;.
          </p>
          <textarea
            value={n}
            onChange={(e) => setN(e.target.value)}
            disabled={readOnly}
            rows={3}
            maxLength={300}
            placeholder="opcional"
            className="card-solid w-full resize-y rounded-lg border border-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-clay"
          />
        </div>
      </div>
    </div>
  );
}
