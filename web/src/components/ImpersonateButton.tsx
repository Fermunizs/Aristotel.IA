"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImpersonateButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft transition hover:border-clay hover:text-clay disabled:opacity-40"
    >
      ver painel
    </button>
  );
}
