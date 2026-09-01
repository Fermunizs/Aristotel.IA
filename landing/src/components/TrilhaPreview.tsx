"use client";

import { useState } from "react";

const BOT = process.env.NEXT_PUBLIC_BOT || "AristotelIA_bot";
const TG = `https://t.me/${BOT}`;

type Dia = { d: number; titulo: string; objetivo: string };
type Semana = { tema: string; dias: Dia[] };

const EXEMPLOS = ["JavaScript pra backend", "design de produto", "inglês pra reuniões", "falar em público"];

// mostrado quando não há LLM configurado (dev sem chave)
const FALLBACK: Semana = {
  tema: "Semana 1 — os primeiros passos",
  dias: [
    { d: 1, titulo: "O primeiro conceito", objetivo: "Você aprende a ideia base e faz um exercício de 10 min hoje." },
    { d: 2, titulo: "Aplicar na prática", objetivo: "Um desafio pequeno usando o que viu ontem — sem pesquisar antes." },
    { d: 3, titulo: "Aprofundar", objetivo: "..." },
    { d: 4, titulo: "Conectar", objetivo: "..." },
    { d: 5, titulo: "Consolidar", objetivo: "..." },
  ],
};

export function TrilhaPreview() {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wk, setWk] = useState<Semana | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = goal.trim();
    if (g.length < 3 || busy) return;
    setBusy(true);
    setErr("");
    setWk(null);
    try {
      const res = await fetch("/api/trilha/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ goal: g }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setWk(FALLBACK); // dev sem chave — mostra a mecânica
      } else if (!res.ok) {
        setErr(data.error || "Não deu agora. Começa direto no Telegram.");
      } else {
        setWk(data as Semana);
      }
    } catch {
      setErr("Sem conexão. Tenta de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="preview">
      <p className="p-label">Diz o que você quer aprender</p>
      <form onSubmit={submit}>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          maxLength={90}
          placeholder="ex: JavaScript pra backend"
          aria-label="O que você quer aprender"
        />
        <button className="btn btn-primary" type="submit" disabled={busy || goal.trim().length < 3}>
          {busy ? (
            <svg className="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M12 3a9 9 0 1 0 9 9" />
            </svg>
          ) : (
            "Montar trilha"
          )}
        </button>
      </form>

      {!wk && !err && (
        <p className="hint">
          Tente: {EXEMPLOS.map((ex, i) => (
            <span key={ex}>
              {i > 0 && " · "}
              <button
                type="button"
                onClick={() => setGoal(ex)}
                style={{ background: "none", border: "none", color: "var(--clay)", cursor: "pointer", font: "inherit", padding: 0 }}
              >
                {ex}
              </button>
            </span>
          ))}
        </p>
      )}

      {err && (
        <div className="locked-cta">
          <span>{err}</span>
          <a className="btn btn-primary btn-sm" href={TG}>Começar no Telegram</a>
        </div>
      )}

      {wk && (
        <div className="trail-out">
          <p className="theme">{wk.tema}</p>
          {wk.dias.slice(0, 2).map((d) => (
            <div className="day" key={d.d}>
              <span className="n">{d.d}</span>
              <div>
                <h4>{d.titulo}</h4>
                <p>{d.objetivo}</p>
              </div>
            </div>
          ))}
          {wk.dias.slice(2).map((d) => (
            <div className="day locked" key={d.d} aria-hidden="true">
              <span className="n">{d.d}</span>
              <div>
                <h4>{d.titulo}</h4>
                <p>{d.objetivo}</p>
              </div>
            </div>
          ))}
          <div className="locked-cta">
            <span>Os outros 3 dias — e as semanas 2, 3 e 4 — a treinadora te manda no Telegram, um por dia.</span>
            <a className="btn btn-primary btn-sm" href={TG}>Ver o resto no Telegram</a>
          </div>
        </div>
      )}
    </div>
  );
}
