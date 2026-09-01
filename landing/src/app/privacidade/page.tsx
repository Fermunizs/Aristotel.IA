import type { Metadata } from "next";
import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";

const BOT = process.env.NEXT_PUBLIC_BOT || "AristotelIA_bot";

export const metadata: Metadata = {
  title: "Privacidade — Aristótel.IA",
  description: "O que a Aristótel.IA guarda, o que faz com isso e como você revoga.",
};

export default function Privacidade() {
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Brand />
          <div className="nav-right">
            <ThemeToggle />
            <a className="btn btn-primary btn-sm" href={`https://t.me/${BOT}`}>
              Começar no Telegram
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="wrap">
          <div className="prose">
            <p className="eyebrow">Privacidade</p>
            <h1>Direto ao ponto.</h1>

            <p>
              A Aristótel.IA é uma treinadora de estudos no Telegram e num painel web. Esta página diz o que a
              gente guarda, por quê, e como você tira tudo do ar.
            </p>

            <h2>O que a gente guarda</h2>
            <ul>
              <li>Seu nome e o identificador da sua conta no Telegram (pra saber pra quem mandar mensagem).</li>
              <li>O que você escolheu aprender, sua trilha, suas respostas de quiz e os registros de evolução.</li>
              <li>Suas preferências (horários dos lembretes, tom da treinadora, horário de silêncio).</li>
              <li>
                Se você conectar uma agenda (Google/Outlook): um token de acesso, <b>cifrado</b>, que serve só
                pra escrever no calendário que a gente cria.
              </li>
            </ul>

            <h2>O que a gente faz com isso</h2>
            <ul>
              <li>Montar sua trilha, te cobrar nos horários e mostrar sua evolução.</li>
              <li>
                Gerar as mensagens com um modelo de linguagem. O texto da sua conversa é enviado ao provedor do
                modelo (hoje Groq e Google) só pra gerar a resposta.
              </li>
              <li>
                Se você conectar a agenda: a gente cria <b>um</b> calendário chamado "Aristótel.IA" na sua conta
                e escreve <b>só nele</b>. Nunca lemos nem mexemos nos seus outros eventos.
              </li>
              <li>Nada é vendido. Não tem anúncio. Não tem rastreador de terceiros nesta página.</li>
            </ul>

            <h2>Como revogar</h2>
            <ul>
              <li>Agenda: "Desconectar" no painel, ou nas configurações de segurança da sua conta Google/Microsoft.</li>
              <li>
                Tudo: manda <code>/recomecar</code> pra zerar a trilha, ou pede a exclusão da conta pelo contato
                abaixo — a gente apaga em até 7 dias.
              </li>
            </ul>

            <h2>Contato</h2>
            <p>
              Fala com a gente no Telegram: <a href={`https://t.me/${BOT}`}>t.me/{BOT}</a>.
            </p>

            <p style={{ marginTop: "2.5rem" }}>
              <a href="/">← voltar</a>
            </p>
          </div>
        </section>
      </main>

      <footer>
        <div className="foot-inner">
          <span>Aristótel.IA — agente de evolução 1%</span>
          <nav>
            <a href="/privacidade">Privacidade</a>
            <a href={`https://t.me/${BOT}`}>Fale com a gente</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
