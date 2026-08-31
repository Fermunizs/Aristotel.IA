"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mark, Wordmark } from "@/components/art";

export default function Entrar() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
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

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="flex items-center gap-2 text-ink">
        <Mark size={30} />
        <Wordmark className="text-[1.35rem]" />
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        No Telegram, manda <code className="text-ink">/painel</code> pra Aristótel.IA e ela te dá um código.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
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

      <a href="/admin/entrar" className="mt-6 text-center text-xs text-ink-soft hover:text-ink">
        entrar como admin
      </a>
    </main>
  );
}
