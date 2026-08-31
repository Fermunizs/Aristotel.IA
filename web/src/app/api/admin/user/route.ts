import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getSession } from "@/lib/session";

const ROLES = ["user", "admin", "superadmin"];
const PLANS = ["free", "pro", "unlimited"];

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || session.account.role !== "superadmin") {
    return NextResponse.json({ error: "só superadmin" }, { status: 403 });
  }

  const { id, role, plan } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "sem id" }, { status: 400 });
  if (id === session.account.id && role && role !== "superadmin") {
    return NextResponse.json({ error: "não dá pra rebaixar você mesma" }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  if (ROLES.includes(role)) patch.role = role;
  if (PLANS.includes(plan)) patch.plan = plan;
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "nada pra mudar" }, { status: 400 });
  }

  // não mexe em outro superadmin (a não ser em si mesma, já barrado acima)
  await db
    .update(users)
    .set(patch)
    .where(and(eq(users.id, id), ne(users.role, "superadmin")));

  return NextResponse.json({ ok: true });
}
