import type { Progress } from "@/lib/xp";

const SOURCES: { key: keyof Progress["bySource"]; label: string }[] = [
  { key: "quiz", label: "quizzes" },
  { key: "desafio", label: "desafios" },
  { key: "foco", label: "foco" },
  { key: "constancia", label: "constância" },
  { key: "revisao", label: "revisão" },
];

export function ProgressCard({
  progress,
  streak,
}: {
  progress: Progress;
  streak: { current: number; best: number };
}) {
  const pct = progress.xpForLevel > 0
    ? Math.min(100, Math.round((progress.xpInLevel / progress.xpForLevel) * 100))
    : 100;
  const weekMax = Math.max(1, ...SOURCES.map((s) => progress.bySource[s.key]));

  return (
    <section className="card overflow-hidden">
      <div className="bg-growth-soft px-5 py-4">
        <p className="label text-growth">Nível {progress.level}</p>
        <h2 className="num mt-1 text-[clamp(1.8rem,5vw,2.6rem)] text-ink">{progress.stage}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {progress.xp} XP no total · {progress.xpToNext} pro nível {progress.level + 1}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-growth" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
        <div>
          <p className="num text-2xl text-growth">{streak.current}</p>
          <p className="text-xs text-ink-soft">dias seguidos · recorde {streak.best}</p>
        </div>
        <div>
          <p className="num text-2xl">
            {SOURCES.reduce((a, s) => a + progress.bySource[s.key], 0)}
          </p>
          <p className="text-xs text-ink-soft">XP nos últimos 7 dias</p>
        </div>
      </div>

      <div className="space-y-2 px-5 pb-5">
        {SOURCES.map((s) => {
          const v = progress.bySource[s.key];
          return (
            <div key={s.key} className="flex items-center gap-3 text-xs">
              <span className="w-20 text-ink-soft">{s.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
                <span
                  className="block h-full rounded-full bg-trail"
                  style={{ width: `${Math.round((v / weekMax) * 100)}%` }}
                />
              </span>
              <span className="num w-8 text-right text-ink-soft">{v}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
