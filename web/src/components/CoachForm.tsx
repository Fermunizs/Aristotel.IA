"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Fields = {
  identidade: string;
  objetivo: string;
  tom: string;
  sempre: string;
  nunca: string;
  teto_tokens: string;
};

const IDENTIDADE: { key: keyof Fields; label: string; hint: string; rows: number }[] = [
  { key: "identidade", label: "Quem ela é", hint: "A frase que define a treinadora.", rows: 2 },
  { key: "objetivo", label: "Objetivo principal", hint: "O que ela existe pra fazer por quem usa.", rows: 3 },
  { key: "tom", label: "Tom de voz", hint: "Como ela fala. É o padrão — a pessoa ajusta em cima disso.", rows: 3 },
  { key: "sempre", label: "Sempre respeitar", hint: "Regras de formato pra toda resposta.", rows: 3 },
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

  const upd = (k: keyof Fields, v: string) => setF({ ...f, [k]: v });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-base">Identidade</h2>
          <p className="text-xs text-ink-soft">O jeito dela. Cada pessoa ajusta a personalidade em cima disso.</p>
        </div>
        {IDENTIDADE.map(({ key, label, hint, rows }) => (
          <div key={key} className="card p-4">
            <label className="font-medium">{label}</label>
            <p className="mb-2 text-xs text-ink-soft">{hint}</p>
            <textarea
              value={f[key]}
              onChange={(e) => upd(key, e.target.value)}
              rows={rows}
              className="card-solid w-full resize-y rounded-lg border border-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-clay"
            />
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base text-clay">Limites</h2>
          <p className="text-xs text-ink-soft">
            Valem pra todo mundo, acima de qualquer ajuste. Os usuários não veem nem mudam isto.
          </p>
        </div>

        <div className="card border-clay/30 p-4">
          <label className="font-medium">O que ela nunca faz</label>
          <p className="mb-2 text-xs text-ink-soft">Vai no topo de toda resposta, com prioridade máxima.</p>
          <textarea
            value={f.nunca}
            onChange={(e) => upd("nunca", e.target.value)}
            rows={4}
            className="card-solid w-full resize-y rounded-lg border border-line px-3 py-2 text-sm leading-relaxed outline-none focus:border-clay"
          />
        </div>

        <div className="card border-clay/30 p-4">
          <label className="font-medium">Teto de tokens por resposta</label>
          <p className="mb-2 text-xs text-ink-soft">
            Limita o tamanho (e o custo) de cada mensagem de conversa. 120 a 4000. Quiz e trilha não contam.
          </p>
          <input
            type="number"
            min={120}
            max={4000}
            step={50}
            value={f.teto_tokens}
            onChange={(e) => upd("teto_tokens", e.target.value)}
            className="card-solid w-32 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-clay"
          />
        </div>
      </section>

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
