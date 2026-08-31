import { getSession } from "@/lib/session";
import { evolucaoData } from "@/lib/queries";
import { HatchedBars } from "@/components/HatchedBars";
import { EmptyStone } from "@/components/art";

export const dynamic = "force-dynamic";

export default async function Evolucao() {
  const { viewing } = (await getSession())!;
  const d = await evolucaoData(viewing.id);

  return (
    <div className="space-y-8">
      <header>
        <p className="label">Evolução</p>
        <h1 className="mt-1 text-[clamp(1.6rem,4vw,2.4rem)]">
          <span className="num text-growth">{d.streak.current}</span> dias sem quebrar.
        </h1>
        <p className="mt-2 text-sm text-ink-soft">Seu recorde é {d.streak.best}.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={d.totals.quiz} unit="quizzes" />
        <Stat n={d.totals.desafio} unit="desafios" />
        <Stat n={d.totals.review} unit="reviews" />
        <Stat n={d.totals.foco} unit="focos" />
      </div>

      <section>
        <h2 className="mb-3 text-base">Últimos 14 dias</h2>
        <HatchedBars series={d.series} />
      </section>

      <section>
        <h2 className="mb-3 text-base">Banco de conteúdo</h2>
        {d.ideas.length === 0 ? (
          <div className="card flex items-center gap-4 p-5 text-sm text-ink-soft">
            <span className="text-ink">
              <EmptyStone size={56} />
            </span>
            Quando algo que você aprendeu virar ideia de post, a Aristótel.IA guarda aqui.
          </div>
        ) : (
          <ul className="space-y-2">
            {d.ideas.map((idea) => (
              <li key={idea.id} className="card flex items-center justify-between p-3 text-sm">
                <span>
                  <span className="font-medium">{idea.title || idea.theme}</span>
                  {idea.format && (
                    <span className="ml-2 rounded bg-paper-2 px-1.5 py-0.5 text-[0.65rem] text-ink-soft">
                      {idea.format}
                    </span>
                  )}
                </span>
                {idea.published && <span className="text-xs text-growth">publicado</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ n, unit }: { n: number; unit: string }) {
  return (
    <div className="card p-4">
      <p className="num text-2xl">{n}</p>
      <p className="mt-1 text-xs text-ink-soft">{unit}</p>
    </div>
  );
}
