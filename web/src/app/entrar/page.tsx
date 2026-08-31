"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      setErr((await res.json()).error ?? "Erro");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="text-2xl font-semibold">
        Aristótel<span className="text-amber">.IA</span>
      </p>
      <p className="mt-1 text-sm text-muted">
        No Telegram, manda <code className="text-ink">/painel</code> pro bot e digita o código.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="000000"
          autoFocus
          className="card w-full px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-amber"
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          disabled={code.length !== 6 || loading}
          className="w-full rounded-xl bg-amber py-3 font-medium text-black disabled:opacity-40"
        >
          {loading ? "..." : "Entrar"}
        </button>
      </form>

      <a href="/admin/entrar" className="mt-6 text-center text-xs text-muted hover:text-ink">
        Entrar como admin
      </a>
    </main>
  );
}
