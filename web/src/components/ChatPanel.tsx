"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

export function ChatPanel({ initial }: { initial: Turn[] }) {
  const [msgs, setMsgs] = useState<Turn[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setErr("");
    setMsgs((m) => [...m, { role: "user", content: t }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Não deu. Tenta de novo.");
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setErr("Sem conexão. Tenta de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-[min(70vh,620px)] flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <p className="mt-8 text-center text-sm text-ink-soft">
            Fala com a treinadora. O que rolar aqui ela também sabe no Telegram, e vice-versa.
          </p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-clay-soft text-ink"
                : "mr-auto bg-paper-2 text-ink"
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="mr-auto rounded-2xl bg-paper-2 px-3.5 py-2.5 text-sm text-ink-soft">
            escrevendo…
          </div>
        )}
        {err && <p className="text-sm text-clay">{err}</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-line p-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={1500}
          placeholder="Escreve aqui…"
          className="card-solid max-h-32 flex-1 resize-none rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-full bg-clay px-4 py-2 text-sm font-medium text-paper disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
