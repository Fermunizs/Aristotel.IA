import { llmConsumo, llmLimites, type LimiteProvider } from "@/lib/queries";
import { requireSuperadmin } from "@/lib/guards";

export const dynamic = "force-dynamic";

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

const agoLabel = (d: Date) => {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 90) return "agora há pouco";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  return `há ${Math.round(s / 86400)} d`;
};

export default async function Consumo() {
  await requireSuperadmin();
  const [d, limites] = await Promise.all([llmConsumo(), llmLimites()]);
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

      {/* D1 — pressão nas chaves de LLM */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base">Limites das chaves · agora</h2>
          <p className="mt-1 max-w-lg text-sm text-ink-soft">
            Quão perto cada provedor da cadeia está de estourar o rate limit do free tier.
            Quando um provedor manda os headers <span className="num">x-ratelimit-*</span> (Groq,
            Cerebras, OpenRouter) o número é exato; nos outros (Gemini) é estimativa a partir do
            uso das últimas 24h contra limites <span className="italic">aproximados</span> — ajuste
            em <span className="num">web/src/lib/llm-limits.ts</span>.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {limites.map((p) => (
            <LimiteCard key={p.provider} p={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

const TONE: Record<LimiteProvider["tone"], { text: string; ring: string; label: string }> = {
  ok: { text: "text-ink", ring: "border-line", label: "folgado" },
  amber: { text: "text-clay", ring: "border-clay/50", label: "apertando" },
  red: { text: "text-red-600 dark:text-red-500", ring: "border-red-500/60", label: "no limite" },
};

function Bar({ used, cap, tone }: { used: number; cap: number | null; tone: LimiteProvider["tone"] }) {
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const fill = tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-clay" : "bg-growth";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}

function LimiteCard({ p }: { p: LimiteProvider }) {
  const t = TONE[p.tone];
  const pctLabel = `${Math.round(p.pct * 100)}%`;
  const rpd = p.limits?.rpd ?? null;
  const tpd = p.limits?.tpd ?? null;

  return (
    <div className={`card space-y-3 border p-4 ${t.ring}`}>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-medium">
            {p.provider}
            {!p.inChain && <span className="ml-2 text-xs text-ink-soft">(fora da cadeia)</span>}
          </p>
          {p.model && <p className="text-xs text-ink-soft">{p.model}</p>}
        </div>
        <p className={`num text-xl ${t.text}`}>{pctLabel}</p>
      </div>

      <div className="space-y-2 text-xs text-ink-soft">
        <div>
          <div className="flex justify-between">
            <span>Requests · 24h</span>
            <span className="num">
              {fmt(p.reqDay)}
              {rpd ? ` / ${fmt(rpd)}` : ""}
            </span>
          </div>
          <div className="mt-1">
            <Bar used={p.reqDay} cap={rpd} tone={p.tone} />
          </div>
        </div>
        <div>
          <div className="flex justify-between">
            <span>Tokens · 24h</span>
            <span className="num">
              {fmt(p.tokDay)}
              {tpd ? ` / ${fmt(tpd)}` : ""}
            </span>
          </div>
          {tpd && (
            <div className="mt-1">
              <Bar used={p.tokDay} cap={tpd} tone={p.tone} />
            </div>
          )}
        </div>
        <div className="flex justify-between">
          <span>Pico · 1 min (24h)</span>
          <span className="num">
            {p.peakRpm}{p.limits?.rpm ? `/${p.limits.rpm}` : ""} req · {fmt(p.peakTpm)}
            {p.limits?.tpm ? `/${fmt(p.limits.tpm)}` : ""} tok
          </span>
        </div>
        {p.snap && (
          <div className="flex justify-between">
            <span>Header {agoLabel(p.snap.at)}</span>
            <span className="num">
              {p.snap.remReq != null && p.snap.limReq != null
                ? `${fmt(p.snap.remReq)}/${fmt(p.snap.limReq)} req`
                : ""}
              {p.snap.remTok != null && p.snap.limTok != null
                ? ` · ${fmt(p.snap.remTok)}/${fmt(p.snap.limTok)} tok`
                : ""}
              {p.snap.resetSeconds != null ? ` · reset ${Math.round(p.snap.resetSeconds)}s` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2 text-xs">
        <span className={`${t.text} font-medium`}>{t.label}</span>
        {p.cooldownLikely && (
          <span className="rounded-full bg-clay-soft px-2 py-0.5 text-clay">
            em cooldown (provável)
          </span>
        )}
        {p.lastNearLimit ? (
          <span className="text-ink-soft">último aperto {agoLabel(p.lastNearLimit)}</span>
        ) : (
          <span className="text-ink-soft">sem aperto registrado</span>
        )}
      </div>
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
