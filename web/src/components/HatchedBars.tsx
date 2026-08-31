type Row = { day: string; estudo: number; pratica: number; foco: number };

export function HatchedBars({ series }: { series: Row[] }) {
  const max = Math.max(1, ...series.map((r) => r.estudo + r.pratica + r.foco));

  return (
    <div className="card p-5">
      <div className="flex items-end gap-1.5" style={{ height: 140 }}>
        {series.map((r, i) => {
          const total = r.estudo + r.pratica + r.foco;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full max-w-[22px] overflow-hidden rounded-[4px] bg-paper-2"
                style={{ height: `${(total / max) * 110 + 4}px` }}
              >
                <div className="hatch h-full w-full" style={{ opacity: total ? 1 : 0 }} />
              </div>
              <span className="text-[0.6rem] text-ink-soft">{r.day}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="hatch h-3 w-3 rounded-[3px]" /> atividade diária (14 dias)
        </span>
      </div>
    </div>
  );
}
