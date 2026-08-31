type Week = { n: number; theme: string; days: { d: number; topic: string; goal: string }[] };

const W = 360;
const STEP = 88;
const TOP = 56;
const MIDX = 180;
const AMP = 78;

function pointFor(gi: number) {
  // alterna lados de forma limpa, com uma leve variação orgânica
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

export function TrailMap({
  weeks,
  currentWeek,
  currentDay,
}: {
  weeks: Week[];
  currentWeek: number;
  currentDay: number;
}) {
  const allDays = weeks.flatMap((w) => w.days.map((day) => ({ ...day, week: w.n })));
  const total = allDays.length;
  const walked = (currentWeek - 1) * 5 + (currentDay - 1);
  const pts = allDays.map((_, gi) => pointFor(gi));
  const path = smoothPath(pts);
  const height = TOP + (total - 1) * STEP + TOP;

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 620 }}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        aria-hidden
      >
        {/* caminho de terra: pontinhos (pegadas) */}
        <path d={path} stroke="var(--color-trail)" strokeWidth="7" strokeLinecap="round" strokeDasharray="0.5 13" />
        {/* trecho já andado: verde sólido */}
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
          return (
            <g key={gi}>
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
                  <path d={`M ${p.x} ${p.y - 15} V ${p.y - 44}`} stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
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
        const onLeft = p.x < MIDX; // stone à esquerda -> rótulo à direita
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
            <div
              className="absolute w-[38%] text-[0.75rem] leading-snug sm:w-[34%]"
              style={{
                top: `${topPct}%`,
                ...(onLeft ? { right: "2%", textAlign: "left" } : { left: "2%", textAlign: "right" }),
              }}
            >
              <span className={here ? "font-medium text-clay" : done ? "text-ink-soft" : "text-ink"}>
                {day.topic}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
