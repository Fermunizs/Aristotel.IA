import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { authCodes } from "@/lib/schema";
import { createSession } from "@/lib/session";
import { ipOf, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const ip = ipOf(req);
  // força bruta: 6 dígitos = 1M combinações; sem isto dá pra varrer numa janela de 10 min.
  if (!rateLimit(`code:${ip}`, 8, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Espera uns minutos." },
      { status: 429 },
    );
  }

  const { code } = await req.json().catch(() => ({}));
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }

  // consumo atômico: marca como usado E confere validade numa query só.
  const [row] = await db
    .update(authCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authCodes.code, String(code)),
        isNull(authCodes.usedAt),
        gt(authCodes.expiresAt, new Date()),
      ),
    )
    .returning({ userId: authCodes.userId });

  if (!row) return NextResponse.json({ error: "Código expirado ou já usado" }, { status: 401 });

  await createSession(row.userId);
  return NextResponse.json({ ok: true });
}
