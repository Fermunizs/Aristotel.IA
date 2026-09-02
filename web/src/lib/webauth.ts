// Acesso sem Telegram: cadastro web + link pessoal (bearer de 256 bits).
// Ver docs/superpowers/specs/2026-09-02-acesso-web-e-kiwify-design.md
import { randomBytes } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { users, pendingUpgrades } from "./schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function newLoginToken(): string {
  return randomBytes(32).toString("base64url"); // 256 bits, ~43 chars
}

export async function findUserByLoginToken(token: string) {
  if (!token || token.length < 20) return null;
  const [u] = await db.select().from(users).where(eq(users.loginToken, token)).limit(1);
  return u ?? null;
}

/** Cria as linhas-filhas (preferences/streaks/bot_state) — espelha bot/db.py::get_or_create_user.
 *  SQL cru porque as colunas têm DEFAULT no banco mas o schema Drizzle as marca notNull. */
async function ensureChildRows(userId: string) {
  await db.execute(sql`INSERT INTO preferences (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`);
  await db.execute(sql`INSERT INTO streaks (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`);
  await db.execute(sql`INSERT INTO bot_state (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`);
}

type SignupResult = { id: string; token: string } | { error: string };

export async function createWebUser(rawName: string, rawEmail: string): Promise<SignupResult> {
  const name = (rawName ?? "").trim().slice(0, 80);
  const email = (rawEmail ?? "").trim().toLowerCase().slice(0, 200);
  if (name.length < 2) return { error: "Escreve teu nome." };
  if (!EMAIL_RE.test(email)) return { error: "Esse e-mail não parece certo." };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (existing) {
    return { error: "Já tem uma conta com esse e-mail. Usa o teu link pessoal pra entrar." };
  }

  // pagou no Kiwify antes de criar a conta?
  const [pending] = await db
    .select()
    .from(pendingUpgrades)
    .where(eq(pendingUpgrades.email, email))
    .limit(1);
  const plan = pending?.plan ?? "free";

  const token = newLoginToken();
  const [u] = await db
    .insert(users)
    .values({
      name,
      email,
      plan,
      role: "user",
      status: "onboarding",
      signupVia: "web",
      timezone: "America/Sao_Paulo",
      createdAt: new Date(),
      loginToken: token,
      loginTokenAt: new Date(),
    })
    .returning({ id: users.id });

  await ensureChildRows(u.id);
  if (pending) await db.delete(pendingUpgrades).where(eq(pendingUpgrades.email, email));

  return { id: u.id, token };
}

/** Rotaciona o link pessoal (o antigo para de funcionar). Sessões ativas continuam. */
export async function rotateLoginToken(userId: string): Promise<string> {
  const token = newLoginToken();
  await db.update(users).set({ loginToken: token, loginTokenAt: new Date() }).where(eq(users.id, userId));
  return token;
}
