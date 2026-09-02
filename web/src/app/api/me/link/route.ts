import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { rotateLoginToken } from "@/lib/webauth";

function linkFor(req: Request, token: string) {
  return `${new URL(req.url).origin}/entrar/link?k=${token}`;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const [u] = await db
    .select({ token: users.loginToken })
    .from(users)
    .where(eq(users.id, session.viewing.id))
    .limit(1);
  if (!u?.token) return NextResponse.json({ link: null }); // conta de Telegram, sem link pessoal
  return NextResponse.json({ link: linkFor(req, u.token) });
}

// rotaciona (o link antigo para de valer)
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const token = await rotateLoginToken(session.viewing.id);
  return NextResponse.json({ link: linkFor(req, token) });
}
