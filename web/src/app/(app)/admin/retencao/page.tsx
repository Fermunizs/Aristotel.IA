import { retencao } from "@/lib/queries";
import { requireSuperadmin } from "@/lib/guards";

export const dynamic = "force-dynamic";

const ago = (iso: string | null) => {
  if (!iso) return "nunca";
  const s = Math.round((Date.now() - new Date(iso + "T12:00:00").getTime()) / 86400_000);
  return s <= 0 ? "hoje" : s === 1 ? "ontem" : `há ${s} d`;
};

type Tone = "growth" | "clay" | "crit" | undefined;
const tone = (pct: number | null, good: number, weak: number): Tone =>
  pct == null ? undefined : pct >= good ? "growth" : pct >= weak ? "clay" : "crit";

const toneCls: Record<NonNullable<Tone>, string> = {
  growth: "text-growth",
  clay: "text-clay",
  crit: "text-red-500",
};

export default async function Retencao() {
  await requireSuperadmin();
  const r = await retencao();
  const maxDaily = Math.max(1, ...r.daily.map((d) => d.active));

  return (
    <div className="space-y-8">
      <header>
        <p className="label">Admin</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">Retenção</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          As métricas de sinal do <span className="num">Produto.md §8</span>. &quot;Dia engajado&quot; = fez
          quiz, review, desafio, foco, conversa ou concluiu tarefa. Mensagem que o bot manda não conta.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={r.funnel.total} unit="cadastros" />
        <Stat n={r.funnel.active} unit="ativos" />
        <Stat n={r.funnel.engaged7d} unit="engajaram · 7d" />
        <Stat n={r.funnel.engaged2d} unit="engajaram · 48h" />
      </div>

      <section>
        <h2 className="mb-3 text-base">Retenção por idade da conta</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {r.dn.map((d) => (
            <div key={d.label} className="card p-5">
              <div className="flex items-baseline justify-between">
                <span className="label">{d.label}</span>
                <span className="text-xs text-ink-soft">
                  {d.ret}/{d.elig} contas
                </span>
              </div>
              <p className={`mt-1 text-3xl ${d.pct == null ? "text-ink-soft" : toneCls[tone(d.pct, d.good, d.weak)!]}`}>
                {d.pct == null ? "—" : `${d.pct}%`}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {d.elig === 0
                  ? `nenhuma conta tem ${d.label.slice(1)} dias ainda`
                  : `alvo: bom ≥ ${d.good}% · fraco < ${d.weak}%`}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base">Funil da trilha</h2>
        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm">Chegou na semana 2+</span>
            <span className="text-xs text-ink-soft">
              {r.trilhaW2.reached}/{r.trilhaW2.elig} contas com 7+ dias
            </span>
          </div>
          <p
            className={`mt-1 text-3xl ${
              r.trilhaW2.pct == null ? "text-ink-soft" : toneCls[tone(r.trilhaW2.pct, r.trilhaW2.good, r.trilhaW2.weak)!]
            }`}
          >
            {r.trilhaW2.pct == null ? "—" : `${r.trilhaW2.pct}%`}
          </p>
          <p className="mt-1 text-xs text-ink-soft">alvo: bom ≥ {r.trilhaW2.good}% · fraco &lt; {r.trilhaW2.weak}%</p>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-base">Tarefa concluída por dia · 14 d</h2>
        <p className="mb-3 text-xs text-ink-soft">
          barra = quem engajou naquele dia · parte cheia = concluiu ao menos uma tarefa
        </p>
        <div className="card p-5">
          <div className="flex items-end gap-1.5" style={{ height: 130 }}>
            {r.daily.every((d) => d.active === 0) && (
              <p className="text-sm text-ink-soft">Sem dados ainda — volta depois do primeiro ciclo.</p>
            )}
            {r.daily.map((d) => (
              <div
                key={d.day}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${d.day}: ${d.done}/${d.active} concluíram tarefa${d.pct != null ? ` (${d.pct}%)` : ""}`}
              >
                <div
                  className="relative w-full max-w-[24px] rounded-[3px] bg-line/60"
                  style={{ height: `${Math.max(2, (d.active / maxDaily) * 108)}px` }}
                >
                  <div
                    className="absolute bottom-0 w-full rounded-[3px] bg-growth"
                    style={{ height: d.active ? `${(d.done / d.active) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-[10px] text-ink-soft">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-base">Sumiram</h2>
        <p className="mb-3 text-xs text-ink-soft">contas ativas sem nenhum engajamento há 3+ dias — candidatas a um empurrão</p>
        <div className="card divide-y divide-line p-0">
          {r.quiet.length === 0 && (
            <p className="p-5 text-sm text-ink-soft">Ninguém sumido. 🎯</p>
          )}
          {r.quiet.map((q, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
              <span>
                {q.name || q.username || "—"}
                {q.username && <span className="ml-2 text-ink-soft">@{q.username}</span>}
              </span>
              <span className="text-xs text-ink-soft">
                entrou {ago(q.signup)} · visto {ago(q.last_eng)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ n, unit }: { n: number | string; unit: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl">{n}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{unit}</p>
    </div>
  );
}
