import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { dashboardData } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import Checklist from "@/components/Checklist";
import Pomodoro from "@/components/Pomodoro";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/entrar");

  const { account, viewing } = session;
  const impersonating = account.id !== viewing.id;
  const readOnly = impersonating;
  const data = await dashboardData(viewing.id);

  if (viewing.status === "onboarding") {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <TopBar name={viewing.name ?? "você"} impersonating={impersonating} isAdmin={account.role === "superadmin"} />
        <div className="card p-6 text-sm text-muted">
          {impersonating ? "Essa pessoa ainda" : "Você ainda"} não terminou o onboarding no Telegram.
          Manda <code className="text-ink">/start</code> pro bot.
        </div>
      </main>
    );
  }

  const w = data.week;
  const cur =
    data.plan?.weeks.find((x) => x.n === data.plan!.currentWeek) ?? null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <TopBar name={viewing.name ?? "você"} impersonating={impersonating} isAdmin={account.role === "superadmin"} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Streak" value={`${data.streak.current}d`} />
        <Stat label="Foco (7d)" value={`${w.focoMin}min`} />
        <Stat label="Recorde" value={`${data.streak.best}d`} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">Checklist de hoje</h2>
      <Checklist tasks={data.todayTasks} readOnly={readOnly} />

      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">Foco</h2>
      <Pomodoro readOnly={readOnly} />

      <h2 className="mb-3 mt-8 text-sm font-medium text-muted">Essa semana</h2>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Quizzes" value={w.quiz} />
        <Stat label="Desafios" value={w.desafio} />
        <Stat label="Reviews" value={w.review} />
      </div>

      {data.plan && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-medium text-muted">
            Trilha — {data.plan.goal}
          </h2>
          <div className="card p-4">
            {data.plan.weeks.map((wk) => (
              <div key={wk.n} className="border-b border-line py-2 last:border-0">
                <p className={wk.n === data.plan!.currentWeek ? "text-amber" : ""}>
                  Semana {wk.n} — {wk.theme}
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted">
                  {wk.days.map((d) => (
                    <li key={d.d}>
                      {wk.n === data.plan!.currentWeek && d.d === data.plan!.currentDay ? "→ " : ""}
                      {d.topic}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
