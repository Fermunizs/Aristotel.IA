"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminEntrar() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await fetch("/api/auth/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setErr((await res.json()).error ?? "Erro");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="text-2xl font-semibold">Painel admin</p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="senha"
          autoFocus
          className="card w-full px-4 py-3 outline-none focus:border-amber"
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          disabled={!pw || loading}
          className="w-full rounded-xl bg-amber py-3 font-medium text-black disabled:opacity-40"
        >
          {loading ? "..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
