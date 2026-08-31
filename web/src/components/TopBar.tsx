"use client";

import { useRouter } from "next/navigation";

export function TopBar({
  name,
  impersonating,
  isAdmin,
}: {
  name: string;
  impersonating: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();

  async function stopImpersonate() {
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: null }),
    });
    router.push("/admin");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/entrar");
    router.refresh();
  }

  return (
    <div className="mb-6 flex items-center justify-between">
      <p className="text-lg font-semibold">
        Aristótel<span className="text-amber">.IA</span>
      </p>
      <div className="flex items-center gap-3 text-sm text-muted">
        {impersonating ? (
          <button onClick={stopImpersonate} className="text-amber">
            ← vendo {name} (voltar)
          </button>
        ) : (
          <>
            <span>{name}</span>
            {isAdmin && (
              <a href="/admin" className="hover:text-ink">
                admin
              </a>
            )}
            <button onClick={logout} className="hover:text-ink">
              sair
            </button>
          </>
        )}
      </div>
    </div>
  );
}
