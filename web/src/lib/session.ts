import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db";
import { users, webSessions } from "./schema";

const COOKIE = "arist_session";
const DAYS_30 = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = typeof users.$inferSelect;

export async function createSession(userId: string) {
  const token = randomBytes(24).toString("hex");
  await db.insert(webSessions).values({
    token,
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + DAYS_30),
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DAYS_30 / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(webSessions).where(eq(webSessions.token, token));
  jar.delete(COOKIE);
}

/** { account, viewing } — viewing = quem o superadmin está impersonando, senão = account */
export async function getSession(): Promise<
  { account: SessionUser; viewing: SessionUser } | null
> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ s: webSessions, u: users })
    .from(webSessions)
    .innerJoin(users, eq(users.id, webSessions.userId))
    .where(and(eq(webSessions.token, token), gt(webSessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;

  let viewing = row.u;
  if (row.s.actsAs && row.u.role === "superadmin") {
    const [target] = await db.select().from(users).where(eq(users.id, row.s.actsAs)).limit(1);
    if (target) viewing = target;
  }
  return { account: row.u, viewing };
}

export async function setImpersonation(actsAs: string | null) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) await db.update(webSessions).set({ actsAs }).where(eq(webSessions.token, token));
}
