"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mark, Wordmark } from "@/components/art";

function EntrarInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"code" | "web">("code");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState(
    params.get("e") === "link" ? "Esse link não vale mais. Pede um novo ou usa o Telegram." : "",
  );
  const [loading, setLoading] = useState(false);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await fetch("/api/auth/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setErr((await res.json()).error ?? "Não deu.");
      setLoading(false);
    }
  }

  async function submitWeb(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await fetch("/api/signup/web", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (res.ok) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setErr((await res.json()).error ?? "Não deu.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="flex items-center gap-2 text-ink">
        <Mark size={30} />
        <Wordmark className="text-[1.35rem]" />
      </div>

      {mode === "code" ? (
        <>
          <p className="mt-3 text-sm text-ink-soft">
            No Telegram, manda <code className="text-ink">/painel</code> pra Aristótel.IA e ela te dá um código.
          </p>
          <form onSubmit={submitCode} className="mt-8 space-y-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              autoFocus
              className="card w-full px-4 py-4 text-center text-2xl tracking-[0.5em] outline-none focus:border-clay"
              style={{ fontFamily: "var(--font-mono)" }}
            />
            {err && <p className="text-sm text-clay">{err}</p>}
            <button
              disabled={code.length !== 6 || loading}
              className="w-full rounded-full bg-ink py-3.5 font-medium text-paper disabled:opacity-40"
            >
              {loading ? "..." : "Entrar"}
            </button>
          </form>
          <button
            onClick={() => { setMode("web"); setErr(""); }}
            className="mt-6 text-center text-sm text-clay hover:underline"
          >
            Não tenho Telegram
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-ink-soft">
            Cria a conta aqui. Sem senha — no fim eu te dou um link pessoal pra você salvar e voltar.
          </p>
          <form onSubmit={submitWeb} className="mt-8 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 80))}
              placeholder="Seu nome"
              autoFocus
              className="card w-full px-4 py-3.5 outline-none focus:border-clay"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 200))}
              type="email"
              inputMode="email"
              placeholder="Seu e-mail"
              className="card w-full px-4 py-3.5 outline-none focus:border-clay"
            />
            <p className="text-xs text-ink-soft">
              O e-mail é só pra recuperar o acesso e ligar uma assinatura. Não mando nada nele.
            </p>
            {err && <p className="text-sm text-clay">{err}</p>}
            <button
              disabled={name.trim().length < 2 || !email.includes("@") || loading}
              className="w-full rounded-full bg-ink py-3.5 font-medium text-paper disabled:opacity-40"
            >
              {loading ? "criando..." : "Criar conta e montar a trilha"}
            </button>
          </form>
          <button
            onClick={() => { setMode("code"); setErr(""); }}
            className="mt-6 text-center text-sm text-clay hover:underline"
          >
            Tenho Telegram, quero o código
          </button>
        </>
      )}

      <a href="/admin/entrar" className="mt-6 text-center text-xs text-ink-soft hover:text-ink">
        entrar como admin
      </a>
    </main>
  );
}

export default function Entrar() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <EntrarInner />
    </Suspense>
  );
}
