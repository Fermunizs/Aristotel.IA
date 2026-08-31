"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KINDS, CHANNELS, DAY_LABELS, type Kind } from "@/lib/reminder-kinds";

type R = {
  id: string;
  kind: string;
  customText: string | null;
  scheduleType: string;
  atTime: string | null;
  period: string | null;
  days: number[];
  enabled: boolean;
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const KIND_KEYS = Object.keys(KINDS) as Kind[];

async function api(method: string, body?: unknown, qs = "") {
  return fetch(`/api/reminders${qs}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function RemindersEditor({ initial, readOnly }: { initial: R[]; readOnly?: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  async function patch(id: string, data: Partial<R>) {
    await api("PATCH", { id, ...data });
    router.refresh();
  }
  async function remove(id: string) {
    await api("DELETE", undefined, `?id=${id}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {initial.map((r) => (
        <ReminderCard key={r.id} r={r} readOnly={readOnly} onPatch={patch} onRemove={remove} />
      ))}

      {!readOnly &&
        (adding ? (
          <AddForm
            onDone={() => {
              setAdding(false);
              router.refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="card w-full border-dashed p-4 text-sm text-ink-soft transition hover:border-clay hover:text-clay"
          >
            + adicionar lembrete
          </button>
        ))}

      <p className="pt-2 text-xs text-ink-soft">
        Hoje tudo vai pelo Telegram. Notificação no navegador e e-mail chegam em breve.
      </p>
    </div>
  );
}

function ReminderCard({
  r,
  readOnly,
  onPatch,
  onRemove,
}: {
  r: R;
  readOnly?: boolean;
  onPatch: (id: string, d: Partial<R>) => void;
  onRemove: (id: string) => void;
}) {
  const meta = KINDS[r.kind as Kind];
  const [time, setTime] = useState(r.atTime ?? "09:00");
  const [text, setText] = useState(r.customText ?? "");

  function toggleDay(d: number) {
    if (readOnly) return;
    const next = r.days.includes(d) ? r.days.filter((x) => x !== d) : [...r.days, d].sort();
    onPatch(r.id, { days: next.length ? next : ALL_DAYS });
  }

  return (
    <div className={`card p-4 ${r.enabled ? "" : "opacity-55"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{meta?.label ?? r.kind}</p>
          <p className="text-xs text-ink-soft">{meta?.desc}</p>
        </div>
        <button
          onClick={() => !readOnly && onPatch(r.id, { enabled: !r.enabled })}
          disabled={readOnly}
          aria-label="ligar/desligar"
          className={`relative h-6 w-10 shrink-0 rounded-full transition ${
            r.enabled ? "bg-growth" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper transition-all ${
              r.enabled ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {r.kind === "livre" && (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== r.customText && onPatch(r.id, { customText: text })}
          disabled={readOnly}
          placeholder="o que você quer que ela te lembre?"
          className="card-solid mt-3 w-full border border-line px-3 py-2 text-sm outline-none focus:border-clay"
        />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => time !== r.atTime && onPatch(r.id, { atTime: time })}
          disabled={readOnly}
          className="card-solid rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-clay"
        />
        <div className="flex gap-1">
          {DAY_LABELS.map((lab, d) => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              disabled={readOnly}
              className={`h-7 w-7 rounded-md text-[0.65rem] transition ${
                r.days.includes(d)
                  ? "bg-growth-soft text-growth"
                  : "bg-paper-2 text-ink-soft"
              }`}
            >
              {lab[0]}
            </button>
          ))}
        </div>
        {!readOnly && (
          <button
            onClick={() => onRemove(r.id)}
            className="ml-auto text-xs text-ink-soft hover:text-clay"
          >
            remover
          </button>
        )}
      </div>
    </div>
  );
}

function AddForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [kind, setKind] = useState<Kind>("livre");
  const [time, setTime] = useState("09:00");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await api("POST", { kind, atTime: time, customText: text, days: ALL_DAYS });
    onDone();
  }

  return (
    <div className="card space-y-3 p-4">
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as Kind)}
        className="card-solid w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-clay"
      >
        {KIND_KEYS.map((k) => (
          <option key={k} value={k}>
            {KINDS[k].label}
          </option>
        ))}
      </select>
      <p className="text-xs text-ink-soft">{KINDS[kind].desc}</p>

      {kind === "livre" && (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="o texto do lembrete"
          className="card-solid w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-clay"
        />
      )}

      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="card-solid rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-clay"
      />

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy || (kind === "livre" && !text.trim())}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-40"
        >
          adicionar
        </button>
        <button onClick={onCancel} className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft">
          cancelar
        </button>
      </div>
    </div>
  );
}

// evita "unused" no build
void CHANNELS;
