"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KINDS, CHANNELS, DAY_LABELS, type Kind, type Channel } from "@/lib/reminder-kinds";

type R = {
  id: string;
  kind: string;
  customText: string | null;
  scheduleType: string;
  atTime: string | null;
  period: string | null;
  days: number[];
  channel: string;
  enabled: boolean;
};

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const KIND_KEYS = Object.keys(KINDS) as Kind[];
const CHAN_KEYS = (Object.keys(CHANNELS) as Channel[]).filter((c) => CHANNELS[c].ready);

function textLabel(kind: string) {
  if (kind === "livre") return { label: "Texto do lembrete", ph: "ex: beber água, alongar 2 min" };
  return {
    label: "Ajuste seu (opcional)",
    ph:
      kind === "insight"
        ? "ex: foca em carreira e mercado, não em código"
        : kind === "quiz"
          ? "ex: quiz mais difícil, com trecho de código"
          : "ex: tom mais durão / mais curto / cite uma fonte",
  };
}

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

  return (
    <div className="space-y-3">
      {initial.map((r) => (
        <ReminderCard
          key={r.id}
          r={r}
          readOnly={readOnly}
          onPatch={patch}
          onRemove={async (id) => {
            await api("DELETE", undefined, `?id=${id}`);
            router.refresh();
          }}
        />
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
  const firstT = useRef(true);
  const firstX = useRef(true);
  const tl = textLabel(r.kind);

  // salva 500ms depois de parar de digitar (edição confiável)
  useEffect(() => {
    if (firstT.current) return void (firstT.current = false);
    if (readOnly || time === r.atTime) return;
    const id = setTimeout(() => onPatch(r.id, { atTime: time }), 500);
    return () => clearTimeout(id);
  }, [time]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (firstX.current) return void (firstX.current = false);
    if (readOnly || text === (r.customText ?? "")) return;
    const id = setTimeout(() => onPatch(r.id, { customText: text }), 700);
    return () => clearTimeout(id);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

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
          aria-label={r.enabled ? "desligar" : "ligar"}
          className={`relative h-6 w-10 shrink-0 rounded-full transition ${r.enabled ? "bg-growth" : "bg-line"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-all ${
              r.enabled ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-3">
        <label className="label mb-1 block text-[0.62rem]">{tl.label}</label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={readOnly}
          maxLength={200}
          placeholder={tl.ph}
          className="card-solid w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-clay"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <span>às</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={readOnly}
            className="card-solid rounded-lg border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-clay"
          />
        </label>

        <select
          value={r.channel}
          onChange={(e) => onPatch(r.id, { channel: e.target.value })}
          disabled={readOnly}
          className="card-solid rounded-lg border border-line px-2 py-1.5 text-xs text-ink outline-none focus:border-clay"
        >
          {CHAN_KEYS.map((c) => (
            <option key={c} value={c}>
              {CHANNELS[c].label}
            </option>
          ))}
        </select>

        <div className="flex gap-1">
          {DAY_LABELS.map((lab, d) => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              disabled={readOnly}
              title={lab}
              className={`h-7 w-7 rounded-md text-[0.65rem] uppercase transition ${
                r.days.includes(d) ? "bg-growth-soft text-growth" : "bg-paper-2 text-ink-soft"
              }`}
            >
              {lab[0]}
            </button>
          ))}
        </div>

        {!readOnly && (
          <button onClick={() => onRemove(r.id)} className="ml-auto text-xs text-ink-soft hover:text-clay">
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
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    const res = await api("POST", { kind, atTime: time, customText: text, days: ALL_DAYS });
    if (res.ok) return onDone();
    setErr((await res.json().catch(() => ({}))).error ?? "Não deu.");
    setBusy(false);
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

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={200}
        placeholder={textLabel(kind).ph}
        className="card-solid w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-clay"
      />

      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="card-solid rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-clay"
      />

      {err && <p className="text-sm text-clay">{err}</p>}
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
