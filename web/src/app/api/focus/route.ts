import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, focusSessions } from "@/lib/schema";
import { getSession } from "@/lib/session";

const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { minutes } = await req.json().catch(() => ({}));
  const m = Math.max(1, Math.min(90, Number(minutes) || 25));
  const uid = session.viewing.id;

  await db.insert(focusSessions).values({
    userId: uid,
    startedAt: new Date(Date.now() - m * 60_000),
    endedAt: new Date(),
    minutes: m,
    completed: true,
  });
  await db.insert(events).values({
    userId: uid,
    day: todayISO(),
    kind: "foco",
    payload: { minutos: m, via: "web" },
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
