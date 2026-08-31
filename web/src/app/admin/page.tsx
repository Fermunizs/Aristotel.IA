import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { adminOverview } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";
import { ImpersonateButton } from "@/components/ImpersonateButton";

export const dynamic = "force-dynamic";

function ago(d: Date | null) {
  if (!d) return "nunca";
  const h = (Date.now() - new Date(d).getTime()) / 3.6e6;
  if (h < 1) return "agora";
  if (h < 24) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

export default async function Admin() {
  const session = await getSession();
  if (!session) redirect("/entrar");
  if (session.account.role !== "superadmin") redirect("/");

  const { rows, stats } = await adminOverview();

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <TopBar name={session.account.name ?? "admin"} impersonating={false} isAdmin />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Usuários", stats.total],
          ["Ativos", stats.active],
          ["Onboarding", stats.onboarding],
          ["Ativos 7d", stats.seen7],
          ["Streak médio", stats.avgStreak],
        ].map(([l, v]) => (
          <div key={l} className="card p-3">
            <p className="text-xs text-muted">{l}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-line">
              <th className="p-3">Pessoa</th>
              <th className="p-3">Status</th>
              <th className="p-3">Streak</th>
              <th className="p-3">Hoje</th>
              <th className="p-3">Visto</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="p-3">
                  {r.name ?? "—"}
                  {r.username && <span className="text-muted"> @{r.username}</span>}
                </td>
                <td className="p-3 text-muted">{r.status}</td>
                <td className="p-3 tabular-nums">{r.streak}d</td>
                <td className="p-3 tabular-nums text-muted">
                  {r.doneToday}/{r.totalToday}
                </td>
                <td className="p-3 text-muted">{ago(r.lastSeenAt)}</td>
                <td className="p-3 text-right">
                  <ImpersonateButton userId={r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        Novas pessoas entram dando <code className="text-ink">/start</code> em
        t.me/{process.env.TELEGRAM_BOT ?? "AristotelIA_bot"} — aparecem aqui automaticamente.
      </p>
    </main>
  );
}
