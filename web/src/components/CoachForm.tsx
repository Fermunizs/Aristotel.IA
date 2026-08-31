"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Fields = { identidade: string; objetivo: string; tom: string; sempre: string };

const META: { key: keyof Fields; label: string; hint: string; rows: number }[] = [
  {
    key: "identidade",
    label: "Quem ela é",
    hint: "A frase que define a treinadora. Uma linha.",
    rows: 2,
  },
  {
    key: "objetivo",
    label: "Objetivo principal",
    hint: "O que ela existe pra fazer por quem usa.",
    rows: 3,
  },
  {
    key: "tom",
    label: "Tom de voz",
    hint: "Como ela fala. Sincera? Durona? Gentil? Sem clichê?",
    rows: 3,
  },
  {
    key: "sempre",
    label: "Sempre respeitar",
    hint: "Regras que valem pra toda resposta (formato, emoji, tamanho).",
    rows: 3,
  },
];

export function CoachForm({ initial }: { initial: Fields }) {
  const router = useRouter();
  const [f, setF] = useState<Fields>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  const dirty = (Object.keys(f) as (keyof Fields)[]).some((k) => f[k] !== initial[k]);

  async function save() {
    setState("saving");
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    setState("saved");
    router.refresh();
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div className="space-y-4">
      {META.map(({ key, label, hint, rows }) => (
        <div key={key} className="card p-4">
          <label className="font-medium">{label}</label>
          <p className="mb-2 text-xs text-ink-soft">{hint}</p>
          <textarea
            value={f[key]}
            onChange={(e) => setF({ ...f, [key]: e.target.value })}
            rows={rows}
            className="card-solid w-full resize-y rounded-lg border border-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-clay"
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || state === "saving"}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-40"
        >
          {state === "saving" ? "salvando..." : "salvar"}
        </button>
        {state === "saved" && <span className="text-sm text-growth">salvo · aplica em até 2 min</span>}
      </div>
    </div>
  );
}
