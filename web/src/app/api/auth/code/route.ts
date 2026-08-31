import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { authCodes } from "@/lib/schema";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}));
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(authCodes)
    .where(
      and(
        eq(authCodes.code, String(code)),
        isNull(authCodes.usedAt),
        gt(authCodes.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return NextResponse.json({ error: "Código expirado ou já usado" }, { status: 401 });

  await db.update(authCodes).set({ usedAt: new Date() }).where(eq(authCodes.code, row.code));
  await createSession(row.userId);
  return NextResponse.json({ ok: true });
}
