"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/art";
import { PushToggle } from "@/components/PushToggle";

type Step = 0 | 1 | 2 | 3 | "building" | "done";

const LEVELS = [
  { k: "1", label: "Do zero" },
  { k: "2", label: "Sei o básico" },
  { k: "3", label: "Intermediário, quero aprofundar" },
];
const TONES = [
  { k: "gentil", label: "Gentil, no meu ritmo" },
  { k: "equilibrada", label: "Equilibrada" },
  { k: "durona", label: "Durona, sem passar a mão na cabeça" },
];

export function OnboardingFlow({ name }: { name: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [tone, setTone] = useState("");
  const [err, setErr] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function finish(chosenTone: string) {
    setStep("building");
    setErr("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal, level, minutes, tone: chosenTone }),
    });
    if (!res.ok) {
      setErr((await res.json()).error ?? "Não deu agora.");
      setStep(3);
      return;
    }
    const l = await fetch("/api/me/link").then((r) => r.json()).catch(() => ({ link: null }));
    setLink(l.link ?? null);
    setStep("done");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 flex items-center gap-2 text-ink">
        <Mark size={26} />
        <span className="text-sm text-ink-soft">montando seu plano, {name}</span>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <h1 className="text-xl">O que você quer aprender ou desenvolver?</h1>
          <p className="text-sm text-ink-soft">
            Responde específico. Ex: &quot;JavaScript pra backend&quot;, &quot;design de produto&quot;,
            &quot;inglês pra reuniões&quot;.
          </p>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value.slice(0, 400))}
            autoFocus
            rows={2}
            className="card w-full px-4 py-3 outline-none focus:border-clay"
          />
          <button
            disabled={goal.trim().length < 3}
            onClick={() => setStep(1)}
            className="w-full rounded-full bg-ink py-3.5 font-medium text-paper disabled:opacity-40"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h1 className="text-xl">Quanto você já sabe disso?</h1>
          <div className="space-y-2">
            {LEVELS.map((l) => (
              <button
                key={l.k}
                onClick={() => { setLevel(l.k); setStep(2); }}
                className="card w-full px-4 py-3 text-left hover:border-clay"
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h1 className="text-xl">Quantos minutos por dia você consegue de verdade?</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setMinutes((m) => Math.max(10, m - 5))} className="card px-4 py-2 text-lg">–</button>
            <span className="w-16 text-center text-2xl" style={{ fontFamily: "var(--font-mono)" }}>{minutes}</span>
            <button onClick={() => setMinutes((m) => Math.min(180, m + 5))} className="card px-4 py-2 text-lg">+</button>
            <span className="text-sm text-ink-soft">min</span>
          </div>
          <button
            onClick={() => setStep(3)}
            className="w-full rounded-full bg-ink py-3.5 font-medium text-paper"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h1 className="text-xl">Como você quer que eu te cobre?</h1>
          <div className="space-y-2">
            {TONES.map((t) => (
              <button
                key={t.k}
                onClick={() => { setTone(t.k); finish(t.k); }}
                className="card w-full px-4 py-3 text-left hover:border-clay"
              >
                {t.label}
              </button>
            ))}
          </div>
          {err && <p className="text-sm text-clay">{err}</p>}
        </div>
      )}

      {step === "building" && (
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-clay" />
          <p className="text-sm text-ink-soft">Montando sua trilha… uns 30 segundos.</p>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-5">
          <h1 className="text-xl">Trilha pronta. 🌱</h1>

          {link && (
            <div className="card space-y-2 p-4">
              <p className="text-sm font-medium">Salve seu link de acesso</p>
              <p className="text-xs text-ink-soft">
                É como você volta a entrar — não tem senha. Guarda nos favoritos.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="card-solid min-w-0 flex-1 truncate px-3 py-2 text-xs"
                />
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(link).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  className="rounded-full bg-clay px-4 py-2 text-sm font-medium text-paper"
                >
                  {copied ? "copiado" : "copiar"}
                </button>
              </div>
            </div>
          )}

          <div className="card space-y-2 p-4">
            <p className="text-sm font-medium">Ative as notificações</p>
            <p className="text-xs text-ink-soft">
              É por aqui que eu te chamo todo dia (você não tem Telegram). No celular, instale o painel como app.
            </p>
            <PushToggle />
          </div>

          <button
            onClick={() => { router.push("/"); router.refresh(); }}
            className="w-full rounded-full bg-ink py-3.5 font-medium text-paper"
          >
            Ver meu plano
          </button>
        </div>
      )}
    </main>
  );
}
