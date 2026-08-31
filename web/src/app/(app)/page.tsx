import { getSession } from "@/lib/session";
import { dashboardData } from "@/lib/queries";
import Checklist from "@/components/Checklist";
import { EmptyStone } from "@/components/art";
import Link from "next/link";

export const dynamic = "force-dynamic";

function firstName(n: string | null) {
  return (n ?? "você").split(" ")[0];
}

export default async function Hoje() {
  const session = (await getSession())!;
  const { viewing, account } = session;
  const readOnly = account.id !== viewing.id;

  if (viewing.status === "onboarding") {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <div className="mx-auto mb-3 text-ink">
          <EmptyStone size={80} />
        </div>
        <h2 className="text-lg">Falta o primeiro passo</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {readOnly ? "Essa pessoa" : "Você"} ainda não terminou o onboarding.
          {readOnly ? "" : " Manda /start pra Aristótel.IA no Telegram."}
        </p>
      </div>
    );
  }

  const d = await dashboardData(viewing.id);
  const cur = d.plan?.weeks.find((w) => w.n === d.plan!.currentWeek);
  const today = cur?.days.find((x) => x.d === d.plan!.currentDay);

  return (
    <div className="space-y-8">
      <header>
        <p className="label">Hoje</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">
          Bom te ver, {firstName(viewing.name)}.
        </h1>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat n={`${d.streak.current}`} unit="dias seguidos" tone="growth" />
        <Stat n={`${d.week.focoMin}`} unit="min de foco · 7d" />
        <Stat n={`${d.streak.best}`} unit="recorde" />
      </div>

      {today && (
        <section className="card overflow-hidden">
          <div className="bg-clay-soft px-5 py-3">
            <p className="label text-clay">Foco de hoje · semana {d.plan!.currentWeek}</p>
            <p className="mt-1 font-medium">{today.topic}</p>
            <p className="text-sm text-ink-soft">{today.goal}</p>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base">Checklist</h2>
          <Link href="/foco" className="text-sm text-clay">
            começar um foco →
          </Link>
        </div>
        <Checklist tasks={d.todayTasks} readOnly={readOnly} />
      </section>

      {d.plan && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base">Sua trilha</h2>
            <Link href="/trilha" className="text-sm text-clay">
              ver o caminho →
            </Link>
          </div>
          <MiniTrail weeks={d.plan.weeks.length} current={d.plan.currentWeek} />
        </section>
      )}
    </div>
  );
}

function Stat({ n, unit, tone }: { n: string; unit: string; tone?: "growth" }) {
  return (
    <div className="card p-4">
      <p className={`num text-3xl ${tone === "growth" ? "text-growth" : "text-ink"}`}>{n}</p>
      <p className="mt-1 text-xs text-ink-soft">{unit}</p>
    </div>
  );
}

function MiniTrail({ weeks, current }: { weeks: number; current: number }) {
  return (
    <div className="card flex items-center gap-1 p-5">
      {Array.from({ length: weeks }).map((_, i) => {
        const w = i + 1;
        return (
          <div key={w} className="flex flex-1 items-center gap-1">
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs ${
                w < current
                  ? "border-growth bg-growth text-paper"
                  : w === current
                    ? "border-clay bg-clay-soft text-clay"
                    : "border-trail text-ink-soft"
              }`}
            >
              {w}
            </span>
            {w < weeks && (
              <span
                className={`h-[3px] flex-1 rounded-full ${w < current ? "bg-growth" : "bg-trail"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
