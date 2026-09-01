"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type ChecklistItem = { t: string; min: number; done: boolean };
type Detail = { resumo: string; checklist: ChecklistItem[]; entrega: string; dica: string };
type Day = { d: number; topic: string; goal: string; detail?: Detail };
type Week = { n: number; theme: string; days: Day[] };
type Node = Day & { week: number; gi: number };

const W = 360;
const STEP = 88;
const TOP = 56;
const MIDX = 180;
const AMP = 78;

function pointFor(gi: number) {
  const side = gi % 2 === 0 ? -1 : 1;
  const wobble = 0.82 + 0.18 * Math.sin(gi * 1.7);
  return { x: MIDX + side * AMP * wobble, y: TOP + gi * STEP };
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

function statusOf(gi: number, walked: number) {
  if (gi < walked) return { key: "done", label: "concluído" };
  if (gi === walked) return { key: "here", label: "é hoje" };
  return { key: "future", label: "vem aí" };
}

export function TrailMap({
  weeks,
  currentWeek,
  currentDay,
}: {
  weeks: Week[];
  currentWeek: number;
  currentDay: number;
}) {
  const allDays: Node[] = weeks.flatMap((w) =>
    w.days.map((day, i) => ({ ...day, week: w.n, gi: 0, d: day.d ?? i + 1 })),
  );
  allDays.forEach((n, gi) => (n.gi = gi));

  const total = allDays.length;
  const walked = (currentWeek - 1) * 5 + (currentDay - 1);
  const pts = allDays.map((_, gi) => pointFor(gi));
  const path = smoothPath(pts);
  const height = TOP + (total - 1) * STEP + TOP;

  const [openGi, setOpenGi] = useState<number | null>(null);
  const open = openGi === null ? null : allDays[openGi];

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 620 }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet" fill="none">
        <path d={path} stroke="var(--color-trail)" strokeWidth="7" strokeLinecap="round" strokeDasharray="0.5 13" />
        <path
          d={path}
          stroke="var(--color-growth)"
          strokeWidth="8"
          strokeLinecap="round"
          pathLength={total}
          strokeDasharray={`${Math.max(walked, 0.001)} ${total}`}
        />
        {pts.map((p, gi) => {
          const done = gi < walked;
          const here = gi === walked;
          const selected = gi === openGi;
          return (
            <g
              key={gi}
              onClick={() => setOpenGi(gi)}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`Dia ${gi + 1}: ${allDays[gi].topic}`}
            >
              <circle cx={p.x} cy={p.y} r={24} fill="transparent" />
              {selected && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={here ? 21 : 18}
                  fill="none"
                  stroke="var(--color-clay)"
                  strokeWidth="1.5"
                  strokeDasharray="2 3"
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={here ? 15 : 12}
                fill={done ? "var(--color-growth)" : here ? "var(--color-clay-soft)" : "var(--color-paper)"}
                stroke={here ? "var(--color-clay)" : done ? "var(--color-growth)" : "var(--color-trail)"}
                strokeWidth="2.5"
              />
              {done && (
                <path
                  d={`M ${p.x - 4} ${p.y} l 3 3.5 l 6.5 -7.5`}
                  stroke="var(--color-paper)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {here && (
                <g className="flag">
                  <path
                    d={`M ${p.x} ${p.y - 15} V ${p.y - 44}`}
                    stroke="var(--color-ink)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${p.x} ${p.y - 44} c 10 .6 15 5 22 3.6 -5 5 -5 8.6 0 13.6 -7 1.4 -12 -3 -22 -3.6 Z`}
                    fill="var(--color-clay)"
                    stroke="var(--color-ink)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {allDays.map((day, gi) => {
        const p = pointFor(gi);
        const onLeft = p.x < MIDX;
        const done = gi < walked;
        const here = gi === walked;
        const topPct = ((p.y - 10) / height) * 100;
        return (
          <div key={gi}>
            {day.d === 1 && (
              <div
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-paper-2 px-3 py-1 text-[0.62rem] font-medium uppercase tracking-wide text-ink-soft"
                style={{ top: `${((p.y - STEP * 0.55) / height) * 100}%` }}
              >
                Semana {day.week} · {weeks[day.week - 1].theme}
              </div>
            )}
            <button
              onClick={() => setOpenGi(gi)}
              className="absolute w-[38%] text-[0.75rem] leading-snug outline-none sm:w-[34%]"
              style={{
                top: `${topPct}%`,
                ...(onLeft ? { right: "2%", textAlign: "left" } : { left: "2%", textAlign: "right" }),
              }}
            >
              <span
                className={`underline-offset-2 hover:underline ${
                  here ? "font-medium text-clay" : done ? "text-ink-soft" : "text-ink"
                }`}
              >
                {day.topic}
              </span>
            </button>
          </div>
        );
      })}

      {open && (
        <DayDetail
          node={open}
          theme={weeks[open.week - 1].theme}
          status={statusOf(open.gi, walked)}
          isCurrent={open.gi === walked}
          onClose={() => setOpenGi(null)}
        />
      )}
    </div>
  );
}

function DayDetail({
  node,
  theme,
  status,
  isCurrent,
  onClose,
}: {
  node: Node;
  theme: string;
  status: { key: string; label: string };
  isCurrent: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<"jasei" | "skip" | null>(null);
  const [detail, setDetail] = useState<Detail | null>(node.detail ?? null);
  const [loading, setLoading] = useState(!node.detail);
  const [err, setErr] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (detail) return;
    let alive = true;
    setLoading(true);
    setErr(false);
    fetch("/api/trilha/detail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ week: node.week, day: node.d }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => alive && setDetail(j.detail))
      .catch(() => alive && setErr(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [detail, node.week, node.d]);

  async function step(action: "jasei" | "skip") {
    setBusy(action);
    const res = await fetch("/api/trilha", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      router.refresh();
      onClose();
    } else setBusy(null);
  }

  async function toggle(index: number) {
    if (!detail) return;
    const done = !detail.checklist[index].done;
    const next = {
      ...detail,
      checklist: detail.checklist.map((c, i) => (i === index ? { ...c, done } : c)),
    };
    setDetail(next);
    fetch("/api/trilha/detail", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ week: node.week, day: node.d, index, done }),
    }).catch(() => {});
  }

  const badge =
    status.key === "done"
      ? "bg-growth-soft text-growth"
      : status.key === "here"
        ? "bg-clay-soft text-clay"
        : "bg-paper-2 text-ink-soft";

  const doneCount = detail?.checklist.filter((c) => c.done).length ?? 0;
  const totalMin = detail?.checklist.reduce((s, c) => s + c.min, 0) ?? 0;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-forest/40 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card-solid relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl p-6 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label">
              Semana {node.week} · Dia {node.d}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">{theme}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.62rem] font-medium uppercase tracking-wide ${badge}`}
          >
            {status.label}
          </span>
        </div>

        <h3 className="mt-4 text-lg leading-tight">{node.topic}</h3>

        {loading && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-ink-soft">Montando o passo a passo desse dia…</p>
            <div className="h-2 w-2/3 animate-pulse rounded bg-line" />
            <div className="h-2 w-full animate-pulse rounded bg-line" />
            <div className="h-2 w-4/5 animate-pulse rounded bg-line" />
          </div>
        )}

        {err && !loading && (
          <div className="mt-4">
            <p className="text-sm text-ink-soft">
              {node.goal || "Não consegui montar o detalhamento agora."}
            </p>
            <button
              onClick={() => setDetail(null)}
              className="mt-2 text-sm text-clay hover:underline"
            >
              tentar de novo
            </button>
          </div>
        )}

        {detail && !loading && (
          <div className="mt-4 space-y-5">
            {detail.resumo && <p className="text-sm leading-relaxed text-ink">{detail.resumo}</p>}

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="label">Checklist de hoje</p>
                <span className="text-[0.7rem] text-ink-soft">
                  {doneCount}/{detail.checklist.length} · ~{totalMin} min
                </span>
              </div>
              <ul className="space-y-1.5">
                {detail.checklist.map((c, i) => (
                  <li key={i}>
                    <button
                      onClick={() => toggle(i)}
                      className="flex w-full items-start gap-2.5 rounded-lg border border-line bg-paper/40 p-2.5 text-left transition hover:border-clay"
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          c.done ? "border-growth bg-growth text-paper" : "border-trail"
                        }`}
                      >
                        {c.done && (
                          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                            <path
                              d="M2.5 6.2l2.3 2.3 4.7-5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className={`flex-1 text-sm leading-snug ${c.done ? "text-ink-soft line-through" : "text-ink"}`}>
                        {c.t}
                      </span>
                      <span className="mt-0.5 shrink-0 text-[0.7rem] text-ink-soft">{c.min}min</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {detail.entrega && (
              <div className="rounded-lg bg-growth-soft p-3">
                <p className="label mb-1 text-growth">No fim você tem</p>
                <p className="text-sm leading-snug text-ink">{detail.entrega}</p>
              </div>
            )}

            {detail.dica && (
              <div className="rounded-lg bg-clay-soft p-3">
                <p className="label mb-1 text-clay">Fica esperta</p>
                <p className="text-sm leading-snug text-ink">{detail.dica}</p>
              </div>
            )}
          </div>
        )}

        {isCurrent && (
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={() => step("jasei")}
              disabled={!!busy}
              className="w-full rounded-full bg-growth py-2.5 text-sm font-medium text-paper transition disabled:opacity-50"
            >
              {busy === "jasei" ? "…" : "já domino isso — pular"}
            </button>
            <button
              onClick={() => step("skip")}
              disabled={!!busy}
              className="w-full rounded-full border border-line py-2.5 text-sm text-ink-soft transition hover:border-clay hover:text-clay disabled:opacity-50"
            >
              {busy === "skip" ? "…" : "pular só hoje"}
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className={`w-full rounded-full py-2.5 text-sm text-ink-soft transition hover:text-clay ${
            isCurrent ? "mt-2" : "mt-5 border border-line hover:border-clay"
          }`}
        >
          fechar
        </button>
      </div>
    </div>,
    document.body,
  );
}
