import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reminders } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { KINDS, markDirty } from "@/lib/reminders";

const isKind = (k: unknown) => typeof k === "string" && k in KINDS;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const uid = session.viewing.id;

  const b = await req.json().catch(() => ({}));
  if (!isKind(b.kind)) return NextResponse.json({ error: "tipo inválido" }, { status: 400 });

  const [{ n }] = await db
    .select({ n: sql<number>`coalesce(max(sort_order),-1)::int` })
    .from(reminders)
    .where(eq(reminders.userId, uid));

  await db.insert(reminders).values({
    userId: uid,
    kind: b.kind,
    customText: b.kind === "livre" ? String(b.customText ?? "").slice(0, 200) : null,
    scheduleType: b.scheduleType === "periodo" ? "periodo" : "fixo",
    atTime: b.scheduleType === "periodo" ? null : (b.atTime ?? "09:00"),
    period: b.scheduleType === "periodo" ? (b.period ?? "manha") : null,
    days: Array.isArray(b.days) ? b.days : [0, 1, 2, 3, 4, 5, 6],
    channel: "telegram",
    enabled: true,
    sortOrder: n + 1,
  });
  await markDirty(uid);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const uid = session.viewing.id;

  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "sem id" }, { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  if (b.atTime) {
    patch.atTime = b.atTime;
    patch.scheduleType = "fixo";
    patch.period = null;
  }
  if (b.period) {
    patch.period = b.period;
    patch.scheduleType = "periodo";
    patch.atTime = null;
  }
  if (Array.isArray(b.days)) patch.days = b.days;
  if (typeof b.customText === "string") patch.customText = b.customText.slice(0, 200);
  if (["telegram", "push", "email"].includes(b.channel)) patch.channel = b.channel;

  await db
    .update(reminders)
    .set(patch)
    .where(and(eq(reminders.id, b.id), eq(reminders.userId, uid)));
  await markDirty(uid);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const uid = session.viewing.id;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "sem id" }, { status: 400 });

  await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, uid)));
  await markDirty(uid);
  return NextResponse.json({ ok: true });
}
