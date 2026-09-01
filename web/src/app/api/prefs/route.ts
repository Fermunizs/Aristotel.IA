import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { markDirty } from "@/lib/reminders";

const TONES = ["gentil", "equilibrada", "durona"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:MM" válido, "" / null (limpar) → null, qualquer outra coisa → undefined (ignora). */
function parseQuiet(v: unknown): string | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v === "string" && HHMM.test(v)) return v;
  return undefined;
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (TONES.includes(body.coachTone)) patch.coachTone = body.coachTone;
  if (typeof body.coachNote === "string") patch.coachNote = body.coachNote.slice(0, 300);

  if ("quietStart" in body || "quietEnd" in body) {
    const qs = parseQuiet(body.quietStart);
    const qe = parseQuiet(body.quietEnd);
    // só grava se os dois vierem coerentes (ambos "HH:MM" ou ambos null)
    if (qs !== undefined && qe !== undefined && (qs === null) === (qe === null)) {
      patch.quietStart = qs;
      patch.quietEnd = qe;
    } else {
      return NextResponse.json({ error: "horário de silêncio inválido" }, { status: 400 });
    }
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "nada pra mudar" }, { status: 400 });
  }

  await db.update(preferences).set(patch).where(eq(preferences.userId, session.viewing.id));
  await markDirty(session.viewing.id);
  return NextResponse.json({ ok: true });
}
