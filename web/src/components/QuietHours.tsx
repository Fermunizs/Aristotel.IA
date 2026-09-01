"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const hhmm = (v: string | null) => (v ? v.slice(0, 5) : "");

async function save(body: unknown) {
  await fetch("/api/prefs", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Janela em que o bot não agenda nenhum lembrete. Pode cruzar a meia-noite. */
export function QuietHours({
  start,
  end,
  readOnly,
}: {
  start: string | null;
  end: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(Boolean(start && end));
  const [s, setS] = useState(hhmm(start) || "22:00");
  const [e, setE] = useState(hhmm(end) || "07:00");
  const [saved, setSaved] = useState<string>("");

  async function persist(next: { on: boolean; s: string; e: string }) {
    if (readOnly) return;
    const body = next.on
      ? { quietStart: next.s, quietEnd: next.e }
      : { quietStart: null, quietEnd: null };
    await save(body);
    setSaved(next.on ? `sem lembretes das ${next.s} às ${next.e}` : "silêncio desligado");
    router.refresh();
  }

  function toggle() {
    const next = !on;
    setOn(next);
    persist({ on: next, s, e });
  }

  return (
    <div className="card p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="font-medium">Horário de silêncio</span>
          <span className="mt-0.5 block text-xs text-ink-soft">
            Nada de lembrete nessa faixa — nem o das 06h. O streak não quebra.
          </span>
        </span>
        <input
          type="checkbox"
          checked={on}
          onChange={toggle}
          disabled={readOnly}
          className="h-4 w-4 accent-clay"
        />
      </label>

      {on && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-ink-soft">das</span>
          <input
            type="time"
            value={s}
            disabled={readOnly}
            onChange={(ev) => setS(ev.target.value)}
            onBlur={() => persist({ on, s, e })}
            className="card-solid rounded-lg border border-line px-2 py-1 outline-none focus:border-clay"
          />
          <span className="text-ink-soft">às</span>
          <input
            type="time"
            value={e}
            disabled={readOnly}
            onChange={(ev) => setE(ev.target.value)}
            onBlur={() => persist({ on, s, e })}
            className="card-solid rounded-lg border border-line px-2 py-1 outline-none focus:border-clay"
          />
        </div>
      )}

      {saved && <p className="mt-2 text-xs text-ink-soft">{saved}</p>}
    </div>
  );
}
