// Árvore de aprendizado: cada semana é um galho, cada dia uma folha.
// Puramente decorativo/informativo (sem interação) — o toque em cada dia
// continua no TrailMap, logo abaixo. Sem client JS: é matemática determinística.

type Day = { d: number; topic: string; goal: string };
type Week = { n: number; theme: string; days: Day[] };

const W = 300;
const H = 300;
const GROUND = 262;
const BASE_X = 150;
const MAX_H = 178; // altura máxima do tronco (todas as semanas cabem aqui)
const STUMP = 22; // broto mínimo, mesmo em progresso 0

export function LearningTree({
  weeks,
  currentWeek,
  currentDay,
}: {
  weeks: Week[];
  currentWeek: number;
  currentDay: number;
}) {
  const totalWeeks = weeks.length || 1;
  const totalDays = weeks.reduce((s, w) => s + w.days.length, 0) || 1;

  let walked = 0;
  for (const w of weeks) {
    if (w.n < currentWeek) walked += w.days.length;
    else if (w.n === currentWeek) walked += Math.max(0, Math.min(w.days.length, currentDay - 1));
  }
  const progress = Math.max(0, Math.min(1, walked / totalDays));
  const done = progress >= 1;
  const grownH = STUMP + progress * (MAX_H - STUMP);
  const topY = GROUND - MAX_H;
  const grownTopY = GROUND - grownH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 300 }} className="mx-auto block">
      {/* chão */}
      <path d={`M 40 ${GROUND} Q 150 ${GROUND + 7} 260 ${GROUND}`} stroke="var(--color-line)" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* tronco fantasma: o tamanho que ela vai alcançar */}
      <path
        d={trunkPath(GROUND, topY, 11, 3)}
        fill="var(--color-line)"
        opacity="0.55"
      />
      {/* tronco crescido até aqui */}
      <path
        d={trunkPath(GROUND, grownTopY, 11, 3 + (11 - 3) * (1 - progress))}
        fill="var(--color-ink)"
      />

      {(() => {
        let cum = 0;
        return weeks.map((w, i) => {
          const startIdx = cum;
          cum += w.days.length;
          const branchY = GROUND - MAX_H * ((i + 0.55) / totalWeeks);
          const side: 1 | -1 = i % 2 === 0 ? -1 : 1;
          const status = cum <= walked ? "done" : startIdx < walked || w.n === currentWeek ? "now" : "future";
          return (
            <Branch key={w.n} baseY={branchY} side={side} status={status} days={w.days} startIdx={startIdx} walked={walked} />
          );
        });
      })()}

      {/* topo: broto (em progresso) ou flor (trilha concluída) */}
      {done ? (
        <g transform={`translate(${BASE_X} ${grownTopY})`}>
          <circle r="7.5" fill="var(--color-clay)" />
          <circle r="3" fill="var(--color-paper)" opacity="0.9" />
        </g>
      ) : (
        <path
          d={`M ${BASE_X} ${grownTopY} q -3 -8 2 -12 q 5 4 2 12 Z`}
          fill="var(--color-growth)"
        />
      )}
    </svg>
  );
}

function trunkPath(groundY: number, topY: number, baseW: number, topW: number) {
  const h = groundY - topY;
  if (h <= 0) return `M ${BASE_X - baseW / 2} ${groundY} h ${baseW} v 1 h -${baseW} Z`;
  // leve curva orgânica pro tronco, não uma linha reta
  const bend = Math.min(6, h * 0.08);
  return [
    `M ${BASE_X - baseW / 2} ${groundY}`,
    `Q ${BASE_X - baseW / 2 - bend} ${groundY - h * 0.55} ${BASE_X - topW / 2} ${topY}`,
    `H ${BASE_X + topW / 2}`,
    `Q ${BASE_X + baseW / 2 + bend} ${groundY - h * 0.55} ${BASE_X + baseW / 2} ${groundY}`,
    "Z",
  ].join(" ");
}

function Branch({
  baseY,
  side,
  status,
  days,
  startIdx,
  walked,
}: {
  baseY: number;
  side: 1 | -1;
  status: "done" | "now" | "future";
  days: Day[];
  startIdx: number;
  walked: number;
}) {
  const len = 46;
  const angle = (38 * Math.PI) / 180;
  const dx = Math.cos(angle) * side;
  const dy = -Math.sin(angle);
  const baseX = BASE_X;
  const endX = baseX + dx * len;
  const endY = baseY + dy * len;
  const ctrlX = baseX + dx * len * 0.55 + side * 6;
  const ctrlY = baseY + dy * len * 0.55 - 4;

  const color =
    status === "done" ? "var(--color-growth)" : status === "now" ? "var(--color-clay)" : "var(--color-line)";
  const dash = status === "future" ? "1 6" : undefined;
  const perpX = -dy * side;
  const perpY = dx * side;
  const spacing = 11;
  const n = days.length;

  return (
    <g opacity={status === "future" ? 0.65 : 1}>
      <path
        d={`M ${baseX} ${baseY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`}
        stroke={color}
        strokeWidth={status === "now" ? 3 : 2.4}
        strokeLinecap="round"
        strokeDasharray={dash}
        fill="none"
      />
      {days.map((day, k) => {
        const off = (k - (n - 1) / 2) * spacing;
        const lx = endX + perpX * off + dx * 5;
        const ly = endY + perpY * off + dy * 5;
        const gi = startIdx + k;
        const dayDone = gi < walked;
        const isHere = gi === walked;
        return (
          <g key={day.d}>
            {isHere && (
              <circle cx={lx} cy={ly} r="6.5" fill="none" stroke="var(--color-clay)" strokeWidth="1.3" strokeDasharray="1.5 2" />
            )}
            <circle
              cx={lx}
              cy={ly}
              r="4.1"
              fill={dayDone ? "var(--color-growth)" : isHere ? "var(--color-clay)" : "var(--color-paper)"}
              stroke={dayDone ? "var(--color-growth)" : isHere ? "var(--color-clay)" : "var(--color-ink-soft)"}
              strokeWidth="1.4"
            />
          </g>
        );
      })}
    </g>
  );
}
