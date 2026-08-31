import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { markDirty } from "@/lib/reminders";

const TONES = ["gentil", "equilibrada", "durona"];

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { coachTone } = await req.json().catch(() => ({}));
  if (!TONES.includes(coachTone)) {
    return NextResponse.json({ error: "valor inválido" }, { status: 400 });
  }

  await db
    .update(preferences)
    .set({ coachTone })
    .where(eq(preferences.userId, session.viewing.id));

  await markDirty(session.viewing.id); // o bot re-lê o usuário ao re-agendar
  return NextResponse.json({ ok: true });
}
