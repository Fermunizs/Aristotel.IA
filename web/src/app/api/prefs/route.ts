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

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (TONES.includes(body.coachTone)) patch.coachTone = body.coachTone;
  if (typeof body.coachNote === "string") patch.coachNote = body.coachNote.slice(0, 300);

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "nada pra mudar" }, { status: 400 });
  }

  await db.update(preferences).set(patch).where(eq(preferences.userId, session.viewing.id));
  await markDirty(session.viewing.id);
  return NextResponse.json({ ok: true });
}
