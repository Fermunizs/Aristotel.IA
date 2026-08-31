"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Task = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  source: string;
  doneVia: string | null;
};

const LABEL: Record<string, string> = {
  trilha: "Trilha",
  desafio: "Desafio",
  pomodoro: "Foco",
  manual: "Manual",
};

export default function Checklist({ tasks, readOnly }: { tasks: Task[]; readOnly?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(t: Task) {
    if (readOnly) return;
    setBusy(t.id);
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: t.status === "done" ? "pending" : "done" }),
    });
    setBusy(null);
    router.refresh();
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-muted">Nada na checklist de hoje ainda. Chega às 08h.</p>;
  }

  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <li key={t.id}>
          <button
            onClick={() => toggle(t)}
            disabled={busy === t.id || readOnly}
            className="card flex w-full items-start gap-3 p-3 text-left transition hover:border-amber/50 disabled:opacity-60"
          >
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                t.status === "done" ? "border-amber bg-amber text-black" : "border-line"
              }`}
            >
              {t.status === "done" ? "✓" : ""}
            </span>
            <span className="min-w-0">
              <span className={`block ${t.status === "done" ? "text-muted line-through" : ""}`}>
                {t.title}
              </span>
              {t.detail && <span className="block text-xs text-muted">{t.detail}</span>}
              <span className="mt-1 inline-block rounded bg-line px-1.5 py-0.5 text-[10px] text-muted">
                {LABEL[t.source] ?? t.source}
                {t.doneVia === "auto" && " · feito no Telegram"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
