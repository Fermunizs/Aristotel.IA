import { getSession } from "@/lib/session";
import { dashboardData } from "@/lib/queries";
import { TomatoTimer } from "@/components/TomatoTimer";

export const dynamic = "force-dynamic";

export default async function Foco() {
  const { viewing, account } = (await getSession())!;
  const readOnly = account.id !== viewing.id;
  const d = await dashboardData(viewing.id);

  return (
    <div className="space-y-8">
      <header>
        <p className="label">Foco</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">Um tomate por vez.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          A técnica se chama pomodoro porque o cronômetro era um tomate de cozinha.
          {d.week.focoMin > 0 && ` Você já plantou ${d.week.focoMin} min essa semana.`}
        </p>
      </header>

      <div className="card px-4 py-10">
        <TomatoTimer readOnly={readOnly} />
      </div>
    </div>
  );
}
