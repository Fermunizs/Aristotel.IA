import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  const [admin] = await db.select().from(users).where(eq(users.role, "superadmin")).limit(1);
  if (!admin) {
    return NextResponse.json(
      { error: "Nenhum superadmin ainda — dê /start no bot primeiro." },
      { status: 409 },
    );
  }

  await createSession(admin.id);
  return NextResponse.json({ ok: true });
}
