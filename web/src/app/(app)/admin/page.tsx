import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { adminOverview } from "@/lib/queries";
import { ImpersonateButton } from "@/components/ImpersonateButton";
import { UserControls } from "@/components/UserControls";

export const dynamic = "force-dynamic";

function ago(d: Date | null) {
  if (!d) return "nunca";
  const h = (Date.now() - new Date(d).getTime()) / 3.6e6;
  if (h < 1) return "agora";
  if (h < 24) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

export default async function Admin() {
  const session = (await getSession())!;
  const canManage = session.account.role === "superadmin";
  if (!canManage && session.account.role !== "admin") redirect("/");

  const { rows, stats } = await adminOverview();

  return (
    <div className="space-y-8">
      <header>
        <p className="label">Admin</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">Quem está no caminho</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ["Pessoas", stats.total],
            ["Ativas", stats.active],
            ["No onboarding", stats.onboarding],
            ["Vistas em 7d", stats.seen7],
            ["Streak médio", stats.avgStreak],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="card p-3">
            <p className="num text-xl">{v}</p>
            <p className="mt-0.5 text-[0.68rem] text-ink-soft">{l}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label p-3 font-medium">Pessoa</th>
              <th className="label p-3 font-medium">Status</th>
              <th className="label p-3 font-medium">Streak</th>
              <th className="label p-3 font-medium">Hoje</th>
              <th className="label p-3 font-medium">Visto</th>
              {canManage && <th className="label p-3 font-medium">Acesso</th>}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="p-3">
                  {r.name ?? "—"}
                  {r.username && <span className="text-ink-soft"> @{r.username}</span>}
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      r.status === "active" ? "bg-growth-soft text-growth" : "bg-clay-soft text-clay"
                    }`}
                  >
                    {r.status === "active" ? "ativa" : "onboarding"}
                  </span>
                </td>
                <td className="num p-3">{r.streak}</td>
                <td className="p-3 text-ink-soft">
                  {r.doneToday}/{r.totalToday}
                </td>
                <td className="p-3 text-ink-soft">{ago(r.lastSeenAt)}</td>
                {canManage && (
                  <td className="p-3">
                    <UserControls
                      id={r.id}
                      role={r.role}
                      plan={r.plan}
                      isSelf={r.id === session.account.id}
                    />
                  </td>
                )}
                <td className="p-3 text-right">
                  <ImpersonateButton userId={r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-soft">
        Novas pessoas entram com <code>/start</code> em t.me/
        {process.env.TELEGRAM_BOT ?? "AristotelIA_bot"} e aparecem aqui.
      </p>
    </div>
  );
}
