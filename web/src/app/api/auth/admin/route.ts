import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { createSession } from "@/lib/session";
import { ipOf, rateLimit } from "@/lib/ratelimit";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const ip = ipOf(req);
  if (!rateLimit(`admin:${ip}`, 5, 15 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Espera 15 min." }, { status: 429 });
  }

  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || typeof password !== "string" || !safeEqual(password, expected)) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  // superadmin determinístico: o mais antigo (evita ambiguidade com 2+ superadmins)
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, "superadmin"))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!admin) {
    return NextResponse.json(
      { error: "Nenhum superadmin ainda — dê /start no bot primeiro." },
      { status: 409 },
    );
  }

  await createSession(admin.id);
  return NextResponse.json({ ok: true });
}
