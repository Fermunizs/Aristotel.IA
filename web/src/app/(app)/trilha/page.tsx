import { getSession } from "@/lib/session";
import { dashboardData } from "@/lib/queries";
import { TrailMap } from "@/components/TrailMap";
import { LearningTree } from "@/components/LearningTree";
import { EmptyStone } from "@/components/art";

export const dynamic = "force-dynamic";

export default async function Trilha() {
  const { viewing } = (await getSession())!;
  const d = await dashboardData(viewing.id);

  if (!d.plan) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <div className="mx-auto mb-3 text-ink">
          <EmptyStone size={80} />
        </div>
        <h2 className="text-lg">Ainda sem trilha</h2>
        <p className="mt-2 text-sm text-ink-soft">Manda /start pra Aristótel.IA montar seu caminho.</p>
      </div>
    );
  }

  const total = d.plan.weeks.reduce((s, w) => s + w.days.length, 0);
  const walked = (d.plan.currentWeek - 1) * 5 + (d.plan.currentDay - 1);

  return (
    <div className="space-y-8">
      <header>
        <p className="label">Trilha</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">{d.plan.goal}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Você andou <span className="text-growth">{walked}</span> de {total} passos.
          Toque em qualquer dia pra ver o objetivo dele.
        </p>
      </header>

      <div className="card px-2 py-6">
        <LearningTree
          weeks={d.plan.weeks}
          currentWeek={d.plan.currentWeek}
          currentDay={d.plan.currentDay}
        />
        <p className="mt-1 text-center text-xs text-ink-soft">
          Cada galho é uma semana, cada folha um dia. Ela cresce junto com você.
        </p>
      </div>

      <div className="card overflow-hidden px-2 py-6">
        <TrailMap
          weeks={d.plan.weeks}
          currentWeek={d.plan.currentWeek}
          currentDay={d.plan.currentDay}
        />
      </div>
    </div>
  );
}
