import { llmConsumo } from "@/lib/queries";
import { requireSuperadmin } from "@/lib/guards";

export const dynamic = "force-dynamic";

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

export default async function Consumo() {
  await requireSuperadmin();
  const d = await llmConsumo();
  const t = d.total;
  const fallbackPct = t.calls ? Math.round((t.fallbackCalls / t.calls) * 100) : 0;
  const maxDay = Math.max(1, ...d.byDay.map((x) => x.tokens));

  return (
    <div className="space-y-8">
      <header>
        <p className="label">Admin</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">Consumo de LLM</h1>
        <p className="mt-2 max-w-lg text-sm text-ink-soft">
          Últimos 7 dias. Cada chamada ao modelo — do bot e do painel — vira uma linha.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={fmt(t.tokens)} unit="tokens · 7d" />
        <Stat n={fmt(t.calls)} unit="chamadas · 7d" />
        <Stat
          n={`${fallbackPct}%`}
          unit="caíram pro fallback"
          tone={fallbackPct > 20 ? "clay" : undefined}
        />
        <Stat
          n={`${t.rate429}`}
          unit="respostas 429"
          tone={t.rate429 > 0 ? "clay" : undefined}
        />
      </div>

      {t.localFallback > 0 && (
        <div className="card border-clay/40 p-4 text-sm">
          <span className="font-medium text-clay">{t.localFallback}</span> chamada(s) não tiveram
          resposta de nenhum provedor e usaram o texto de emergência. Se isso repetir, é sinal de
          cota estourada — hora da chave por usuário.
        </div>
      )}

      {/* tokens por dia */}
      <section>
        <h2 className="mb-3 text-base">Tokens por dia · 14d</h2>
        <div className="card p-5">
          <div className="flex items-end gap-1.5" style={{ height: 120 }}>
            {d.byDay.length === 0 && (
              <p className="text-sm text-ink-soft">Sem dados ainda — volta depois do primeiro ciclo.</p>
            )}
            {d.byDay.map((x) => (
              <div key={x.day} className="flex flex-1 flex-col items-center gap-1" title={`${x.day}: ${fmt(x.tokens)} tokens · ${x.calls} chamadas`}>
                <div
                  className="w-full max-w-[26px] rounded-[3px] bg-growth"
                  style={{ height: `${Math.max(2, (x.tokens / maxDay) * 104)}px` }}
                />
                <span className="text-[0.58rem] text-ink-soft">{x.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Table
          title="Quem mais consome · 7d"
          rows={d.byUser.map((r) => [r.name, `${fmt(r.tokens)} tok`, `${r.calls}×`])}
          head={["Pessoa", "Tokens", "Chamadas"]}
        />
        <Table
          title="Por provedor · 7d"
          rows={d.byProvider.map((r) => [r.provider, `${fmt(r.tokens)} tok`, `${r.calls}×`])}
          head={["Provedor", "Tokens", "Chamadas"]}
        />
      </div>

      <Table
        title="Por tipo de mensagem · 7d"
        rows={d.byTag.map((r) => [r.tag, `${fmt(r.tokens)} tok`, `${r.calls}×`])}
        head={["Tipo", "Tokens", "Chamadas"]}
      />
    </div>
  );
}

function Stat({ n, unit, tone }: { n: string; unit: string; tone?: "clay" }) {
  return (
    <div className="card p-4">
      <p className={`num text-2xl ${tone === "clay" ? "text-clay" : "text-ink"}`}>{n}</p>
      <p className="mt-1 text-xs text-ink-soft">{unit}</p>
    </div>
  );
}

function Table({
  title,
  head,
  rows,
}: {
  title: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <section>
      <h2 className="mb-3 text-base">{title}</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {head.map((h, i) => (
                <th key={h} className={`label p-3 font-medium ${i > 0 ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-3 text-ink-soft" colSpan={head.length}>
                  sem dados ainda
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={`p-3 ${j > 0 ? "num text-right text-ink-soft" : ""}`}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
