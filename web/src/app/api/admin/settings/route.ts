import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/schema";
import { getSession } from "@/lib/session";

const KEYS = ["identidade", "objetivo", "tom", "sempre"] as const;

async function guard() {
  const session = await getSession();
  if (!session || session.account.role !== "superadmin") return null;
  return session;
}

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  const rows = await db.select().from(appSettings);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return NextResponse.json(out);
}

export async function PUT(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  for (const k of KEYS) {
    if (typeof body[k] !== "string") continue;
    const value = body[k].slice(0, 2000);
    await db
      .insert(appSettings)
      .values({ key: k, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}
