import { NextResponse } from "next/server";
import { getSession, setImpersonation } from "@/lib/session";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.account.role !== "superadmin") {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }
  const { userId } = await req.json().catch(() => ({}));
  await setImpersonation(userId || null);
  return NextResponse.json({ ok: true });
}
