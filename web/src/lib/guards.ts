import { redirect } from "next/navigation";
import { getSession } from "./session";

/** Sessão válida ou manda pro login. */
export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/entrar");
  return s;
}

const impersonating = (s: { account: { id: string }; viewing: { id: string } }) =>
  s.account.id !== s.viewing.id;

/**
 * Página de superadmin. Bloqueia:
 *  - quem não é superadmin
 *  - superadmin "disfarçado" de outra pessoa (impersonação) — tem que sair antes.
 * O 2º ponto evita a confusão de ver ferramentas de admin enquanto vê o painel de um usuário.
 */
export async function requireSuperadmin() {
  const s = await requireSession();
  if (s.account.role !== "superadmin" || impersonating(s)) redirect("/");
  return s;
}

/** Página de admin (admin ou superadmin), também bloqueada durante impersonação. */
export async function requireAdmin() {
  const s = await requireSession();
  if ((s.account.role !== "superadmin" && s.account.role !== "admin") || impersonating(s)) {
    redirect("/");
  }
  return s;
}
