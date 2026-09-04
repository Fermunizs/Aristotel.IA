import Link from "next/link";
import type { Progress } from "@/lib/xp";

export function LevelBar({ progress }: { progress: Progress }) {
  const pct = progress.xpForLevel > 0
    ? Math.min(100, Math.round((progress.xpInLevel / progress.xpForLevel) * 100))
    : 100;
  return (
    <Link href="/evolucao" className="card block p-4 hover:border-clay">
      <div className="flex items-baseline justify-between">
        <p className="label">Nível {progress.level} · {progress.stage}</p>
        <p className="text-xs text-ink-soft">
          {progress.xpToNext} XP pro nível {progress.level + 1}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2">
        <div
          className="h-full rounded-full bg-growth"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}
