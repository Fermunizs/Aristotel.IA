import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { markDirty } from "@/lib/reminders";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "inscrição inválida" }, { status: 400 });
  }

  await db
    .insert(pushSubscriptions)
    .values({
      userId: session.viewing.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      label: (sub.label as string | undefined)?.slice(0, 60) ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: session.viewing.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });

  await markDirty(session.viewing.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.userId, session.viewing.id),
        ),
      );
  }
  return NextResponse.json({ ok: true });
}
