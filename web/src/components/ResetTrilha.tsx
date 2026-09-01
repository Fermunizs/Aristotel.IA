"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State = "idle" | "confirm" | "loading" | "done";

export function ResetTrilha({ botHandle }: { botHandle: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [err, setErr] = useState("");

  async function reset() {
    setState("loading");
    setErr("");
    const res = await fetch("/api/trilha/reset", { method: "POST" });
    if (res.ok) {
      setState("done");
      router.refresh();
    } else {
      setErr((await res.json().catch(() => ({}))).error ?? "Não deu.");
      setState("confirm");
    }
  }

  if (state === "done") {
    return (
      <div className="card p-4 text-sm">
        <p className="font-medium text-growth">Trilha zerada.</p>
        <p className="mt-1 text-ink-soft">
          Abre o Telegram — a{" "}
          <a
            href={`https://t.me/${botHandle}`}
            target="_blank"
            rel="noreferrer"
            className="text-clay underline"
          >
            Aristótel.IA
          </a>{" "}
          já mandou a primeira pergunta. Responde as 4 e ela monta a nova.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="mb-2 text-xs text-ink-soft">
        Monta uma trilha nova do zero — refaz as 4 perguntas no Telegram. Seu streak, evolução e
        banco de conteúdo continuam intactos.
      </p>

      {state === "idle" && (
        <button
          onClick={() => setState("confirm")}
          className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition hover:border-clay/40 hover:text-ink"
        >
          Recomeçar trilha
        </button>
      )}

      {state !== "idle" && (
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={state === "loading"}
            className="rounded-full bg-clay px-4 py-2 text-sm font-medium text-paper disabled:opacity-40"
          >
            {state === "loading" ? "..." : "Confirmar — apaga a trilha atual"}
          </button>
          <button
            onClick={() => setState("idle")}
            disabled={state === "loading"}
            className="text-sm text-ink-soft hover:text-ink"
          >
            cancelar
          </button>
        </div>
      )}

      {err && <p className="mt-2 text-sm text-clay">{err}</p>}
    </div>
  );
}
