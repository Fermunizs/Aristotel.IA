"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = [
  { k: "user", l: "usuária" },
  { k: "admin", l: "admin" },
  { k: "superadmin", l: "super" },
];
const PLANS = [
  { k: "free", l: "free" },
  { k: "pro", l: "pro" },
  { k: "unlimited", l: "ilimitado" },
];

export function UserControls({
  id,
  role,
  plan,
  isSelf,
}: {
  id: string;
  role: string;
  plan: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const locked = role === "superadmin";

  async function patch(body: Record<string, string>) {
    setBusy(true);
    await fetch("/api/admin/user", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1.5">
      <select
        value={role}
        onChange={(e) => patch({ role: e.target.value })}
        disabled={busy || locked || isSelf}
        className="card-solid rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-clay disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r.k} value={r.k}>
            {r.l}
          </option>
        ))}
      </select>
      <select
        value={plan}
        onChange={(e) => patch({ plan: e.target.value })}
        disabled={busy || locked}
        className="card-solid rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-clay disabled:opacity-50"
      >
        {PLANS.map((p) => (
          <option key={p.k} value={p.k}>
            {p.l}
          </option>
        ))}
      </select>
    </div>
  );
}
