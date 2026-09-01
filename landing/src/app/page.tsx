import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollReveal } from "@/components/ScrollReveal";
import { TrilhaPreview } from "@/components/TrilhaPreview";

const BOT = process.env.NEXT_PUBLIC_BOT || "AristotelIA_bot";
const TG = `https://t.me/${BOT}`;

const PILLARS = [
  {
    tag: "Trilha + checklist",
    h: "O plano se monta sozinho",
    p: "Semanas e dias gerados pra você, com tópico, objetivo e ação. A checklist do dia aparece pronta. Fez pelo Telegram? Marca sozinho.",
  },
  {
    tag: "Trilha adaptativa",
    h: "Errou? Ela volta no assunto",
    p: "Errou os quizzes de um tópico e ela insere um dia de revisão. Acertou tudo e ela acelera.",
  },
  {
    tag: "Foco",
    h: "Pomodoro que conta",
    p: "No painel e no Telegram. O bot silencia durante a sessão e soma os minutos de foco no seu histórico.",
  },
  {
    tag: "Evolução",
    h: "A jornada, não a barra de progresso",
    p: "Dashboard do que você aprendeu, praticou e resolveu. Uma árvore de aprendizado que cresce a cada dia concluído.",
  },
  {
    tag: "Conteúdo",
    h: "Formação virando post",
    p: "Banco de ideias e planner semanal. O que você estudou essa semana vira três peças pra publicar.",
  },
  {
    tag: "Sem culpa",
    h: '"Hoje não" não te pune',
    p: "Horário de silêncio, pausar tudo numa tecla (viagem, doença), streak que não quebra por um dia perdido. O tom nunca cobra com peso.",
  },
];

const STEPS = [
  { h: "Dizer o que estudar", p: 'Às 8h: o tópico de hoje e a primeira ação concreta. Não "estude funções" — "escreva uma função que…".' },
  { h: "Fazer pensar", p: "Ela pergunta antes de explicar. Um conceito por vez. Quiz de uma pergunta, sua resposta, reforço." },
  { h: "Fazer aplicar", p: 'Desafio de código de 10 minutos. "Não pesquise antes de tentar."' },
  { h: "Registrar", p: "À noite você responde três linhas: o que aprendi, o que fiz, o que entendi melhor. Vira um card de evolução." },
  { h: "Virar conteúdo", p: "O que você aprendeu vira ideia de carrossel, reel ou thread — com rascunho de copy pronto." },
  { h: "Mostrar evolução", p: "Conceitos, prática, minutos de foco, streak. O gráfico sobe. Na terceira semana você vê." },
];

const FAQ = [
  ["Preciso de cartão?", "Não. O Free é grátis de verdade e o trial do Pro não pede cartão nem cobra no fim."],
  ["Não uso Telegram.", "Dá pra usar pelo painel web — trilha, checklist, foco e a conversa com a treinadora. Push no navegador e e-mail estão a caminho."],
  ["E se eu furar um dia?", '"Hoje não" reagenda sem quebrar o streak. Sumir uma semana também não te pune — a trilha congela e espera você voltar.'],
  ["Serve só pra programar?", "O motor é o mesmo pra qualquer coisa que você queira aprender com constância. Hoje o conteúdo é mais forte em tech, que é onde a gente está validando."],
  ["Quanto vai custar depois?", "O Free continua grátis. O Pro deve ficar em R$19/mês (ou R$149/ano), e quem entra agora trava esse valor. Nada é cobrado sem você escolher."],
  ["E os meus dados?", "Ficam no nosso banco, não são vendidos. Você pode pedir o export (no Pro) ou a exclusão a qualquer momento."],
];

export default function Home() {
  return (
    <>
      <ScrollReveal />

      <header className="nav">
        <div className="nav-inner">
          <Brand />
          <div className="nav-right">
            <ThemeToggle />
            <a className="btn btn-primary btn-sm" href={TG}>
              Começar no Telegram
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ── hero ── */}
        <section className="hero wrap">
          <div className="hero-grid">
            <div>
              <p className="eyebrow">Agente de evolução 1%</p>
              <h1>Você sabe o que estudar. Só não consegue fazer todo dia.</h1>
              <p className="lede">
                A Aristótel.IA vira sua treinadora: monta o plano, decide o que você faz hoje, te cobra,
                corrige a rota e te mostra que você está evoluindo. No Telegram — onde você já está.
              </p>
              <p className="note">Grátis pra usar. Sem cartão. Monte metade da sua trilha agora mesmo:</p>
              <TrilhaPreview />
            </div>
            <figure className="statue">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/aristotelia.webp"
                alt="Estátua de mármore da Aristótel.IA — coroa de louros, óculos redondos, segurando um tablet"
                width={720}
                height={720}
              />
            </figure>
          </div>
        </section>

        {/* ── não é bot de lembrete ── */}
        <section className="contrast" id="por-que">
          <div className="wrap">
            <p className="eyebrow">Não é bot de lembrete</p>
            <h2>Não é mais um app pra você esquecer de abrir.</h2>
            <div className="cols">
              <p className="passive">
                <b>Notion</b> te dá um quadro em branco. <b>Udemy</b>, um catálogo. <b>App de foco</b>, um
                cronômetro. <b>ChatGPT</b>, um chat sem memória. Todos esperam que você já tenha a disciplina
                que você não tem — e todos são mais um ícone pra ignorar.
              </p>
              <p className="active-claim">
                A Aristótel.IA é <span className="hl">ativa</span>. Ela puxa a conversa, decide o próximo passo
                e <span className="hl">não desiste de você</span>. E "hoje não" reagenda sem quebrar nada.
              </p>
            </div>
          </div>
        </section>

        {/* ── ciclo ── */}
        <section className="cycle wrap" id="como-funciona">
          <div className="sec-head">
            <p className="eyebrow">O ciclo 1%</p>
            <h2>Um pouco por dia, e o caminho aparece.</h2>
            <p>Todo dia ela fecha o mesmo ciclo com você. Nada de despejo de conteúdo — um passo de cada vez.</p>
          </div>

          <svg className="trail-spine" viewBox="0 0 120 1000" preserveAspectRatio="none" aria-hidden="true">
            <path className="bed" d="M60 10 C 20 130, 100 250, 60 370 S 20 610, 60 730 S 100 900, 60 990" />
            <path className="done" d="M60 10 C 20 130, 100 250, 60 370 S 20 610, 60 730 S 100 900, 60 990" />
          </svg>

          <div className="steps">
            {STEPS.map((s, i) => (
              <article className="step fade" key={s.h}>
                <div className="top">
                  <span className="stone">{i + 1}</span>
                  <h3>{s.h}</h3>
                </div>
                <p>{s.p}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── pilares ── */}
        <section className="wrap" id="o-que-tem">
          <div className="sec-head">
            <p className="eyebrow">O que você ganha</p>
            <h2>Uma treinadora, não um painel de configuração.</h2>
            <p>Você define o objetivo. Ela monta o resto — e ajusta conforme você anda.</p>
          </div>
          <div className="pillars">
            {PILLARS.map((p) => (
              <article className="pillar fade" key={p.tag}>
                <span className="tag">{p.tag}</span>
                <h3>{p.h}</h3>
                <p>{p.p}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── por que na 3ª semana ── */}
        <section className="wrap">
          <div className="evo fade">
            <div>
              <p className="eyebrow">Por que na 3ª semana</p>
              <h2>O valor é composto.</h2>
              <p>
                No dia 1 é só uma tarefa. Na terceira semana o gráfico já subiu, o card semanal aponta seu
                ponto forte e o fraco (sincero), e você tem prova de que mudou de patamar. É aí que fica
                difícil parar.
              </p>
            </div>
            <div className="bars" role="img" aria-label="Gráfico de evolução subindo ao longo das semanas">
              {[22, 30, 28, 46, 58, 55, 74, 90].map((h, i) => (
                <span className="bar" key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </section>

        {/* ── planos ── */}
        <section className="wrap" id="planos">
          <div className="sec-head">
            <p className="eyebrow">Planos</p>
            <h2>Comece de graça. Pague quando quiser mais.</h2>
            <p>
              Enquanto a Aristótel.IA está em validação, tudo está liberado. Quem entra agora trava o preço de
              fundador.
            </p>
          </div>
          <div className="plans">
            <article className="plan fade">
              <div className="plan-top">
                <h3>Free</h3>
              </div>
              <div className="price">
                R$0 <small>pra sempre</small>
              </div>
              <ul>
                <li>O ciclo 1% inteiro, todo dia</li>
                <li>Trilha + checklist com auto-check</li>
                <li>Pomodoro e minutos de foco</li>
                <li>Gráfico e árvore de evolução</li>
                <li>Horário de silêncio e pausar sem culpa</li>
                <li>Todos os canais (Telegram hoje; push e e-mail a caminho)</li>
                <li>Até 5 lembretes no seu ritmo</li>
              </ul>
              <a className="btn btn-primary" href={TG}>
                Começar no Telegram
              </a>
            </article>
            <article className="plan pro fade">
              <div className="plan-top">
                <h3>Pro</h3>
                <span className="badge">Em breve · fundador</span>
              </div>
              <div className="price">
                R$19 <small>/mês · ou R$149/ano</small>
              </div>
              <ul>
                <li>Tudo do Free</li>
                <li>Agenda: foco marcado nas suas brechas reais (Google/Outlook)</li>
                <li>Planner de conteúdo semanal com rascunho de copy</li>
                <li>Análise semanal profunda e comparação entre semanas</li>
                <li>Export do histórico (CSV / Notion)</li>
                <li>Até 30 lembretes e limites maiores</li>
              </ul>
              <a className="btn btn-ghost" href={TG}>
                Quero ser fundador
              </a>
              <p className="foot">Preço travado pra quem entra na fase de validação.</p>
            </article>
            <article className="plan fade">
              <div className="plan-top">
                <h3>Trial</h3>
              </div>
              <div className="price">
                14 dias <small>de Pro, sem cartão</small>
              </div>
              <ul>
                <li>Libera tudo do Pro por duas semanas</li>
                <li>Tempo de ver o card semanal e o gráfico subir</li>
                <li>No fim vira Free — seu histórico fica inteiro</li>
                <li>Sem cobrança automática, sem pegadinha</li>
              </ul>
              <a className="btn btn-ghost" href={TG}>
                Testar o Pro
              </a>
            </article>
          </div>
          <p className="trial-note">
            Preços em avaliação com a primeira turma. <b>O Free continua grátis de verdade.</b>
          </p>
        </section>

        {/* ── faq ── */}
        <section className="wrap" id="faq">
          <div className="sec-head">
            <p className="eyebrow">Perguntas rápidas</p>
            <h2>O que costuma travar antes de começar.</h2>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <div className="ans">{a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* ── cta final ── */}
        <section className="final wrap">
          <p className="eyebrow">Um passo</p>
          <h2>Diz o que você quer aprender.</h2>
          <p>A Aristótel.IA monta sua trilha e te cobra amanhã de manhã.</p>
          <div className="cta-row">
            <a className="btn btn-primary" href={TG}>
              Começar no Telegram
            </a>
          </div>
        </section>
      </main>

      <footer>
        <div className="foot-inner">
          <span>Aristótel.IA — agente de evolução 1%</span>
          <nav>
            <a href="/privacidade">Privacidade</a>
            <a href={TG}>Fale com a gente</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
