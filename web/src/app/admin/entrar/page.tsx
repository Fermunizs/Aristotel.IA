"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/art";

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
      setErr((await res.json()).error ?? "Não deu.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="flex items-center gap-2 text-ink">
        <Mark size={28} />
        <span className="display text-lg" style={{ fontWeight: 600 }}>
          Painel admin
        </span>
      </div>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="senha"
          autoFocus
          className="card w-full px-4 py-3.5 outline-none focus:border-clay"
        />
        {err && <p className="text-sm text-clay">{err}</p>}
        <button
          disabled={!pw || loading}
          className="w-full rounded-full bg-ink py-3.5 font-medium text-paper disabled:opacity-40"
        >
          {loading ? "..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
