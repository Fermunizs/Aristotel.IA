import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { getSession } from "@/lib/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!["pending", "done", "skipped"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  await db
    .update(tasks)
    .set({
      status,
      doneVia: status === "done" ? "web" : null,
      doneAt: status === "done" ? new Date() : null,
    })
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.viewing.id)));

  return NextResponse.json({ ok: true });
}
