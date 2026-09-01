const BOT = process.env.TELEGRAM_BOT ?? "AristotelIA_bot";

/** Aviso: notificação no Telegram só funciona com Telegram + /start. */
export function TelegramNotice() {
  return (
    <div className="card border-clay/40 p-4 text-sm">
      <p className="font-medium text-clay">Pra ser avisada no Telegram</p>
      <p className="mt-1 text-ink-soft">
        As mensagens da treinadora (o que estudar, quiz, desafio, fechamento) chegam pelo Telegram.
        Pra receber, você precisa ter o Telegram instalado, abrir{" "}
        <a
          href={`https://t.me/${BOT}`}
          target="_blank"
          rel="noreferrer"
          className="text-clay underline"
        >
          t.me/{BOT}
        </a>{" "}
        e mandar <code className="rounded bg-paper-2 px-1 py-0.5">/start</code> uma vez.
      </p>
      <p className="mt-1 text-ink-soft">
        Sem Telegram? Sem problema — dá pra conversar com a treinadora aqui no painel, na aba{" "}
        <span className="font-medium text-ink">Conversar</span>. A conversa é a mesma nos dois lados.
      </p>
    </div>
  );
}
