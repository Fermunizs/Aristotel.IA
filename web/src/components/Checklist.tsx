"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyStone } from "./art";

type Task = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  source: string;
  doneVia: string | null;
};

const LABEL: Record<string, string> = {
  trilha: "trilha",
  desafio: "desafio",
  pomodoro: "foco",
  manual: "manual",
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
    return (
      <div className="card flex items-center gap-4 p-5 text-sm text-ink-soft">
        <span className="text-ink">
          <EmptyStone size={56} />
        </span>
        Sua checklist chega às 08h com o foco do dia. Enquanto isso, começa um foco.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const done = t.status === "done";
        return (
          <li key={t.id}>
            <button
              onClick={() => toggle(t)}
              disabled={busy === t.id || readOnly}
              className="card flex w-full items-start gap-3 p-3.5 text-left transition hover:border-clay/40 disabled:opacity-60"
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition ${
                  done ? "border-growth bg-growth text-paper" : "border-line"
                }`}
              >
                {done && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.5l2.5 2.5 4.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={done ? "text-ink-soft line-through" : ""}>{t.title}</span>
                {t.detail && <span className="mt-0.5 block text-xs text-ink-soft">{t.detail}</span>}
                <span className="mt-1.5 flex gap-1.5 text-[0.62rem]">
                  <span className="rounded bg-paper-2 px-1.5 py-0.5 text-ink-soft">
                    {LABEL[t.source] ?? t.source}
                  </span>
                  {t.doneVia === "auto" && (
                    <span className="rounded bg-growth-soft px-1.5 py-0.5 text-growth">
                      feito no Telegram
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
