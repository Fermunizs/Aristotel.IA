import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, pendingUpgrades, kiwifyEvents } from "@/lib/schema";

export const dynamic = "force-dynamic";

// Kiwify assina o corpo cru com HMAC-SHA1 (chave = token do webhook), no ?signature=.
// Doc é incompleta — a 1ª compra real calibra (kiwify_events guarda o raw).
const TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN ?? "";
const PRODUCT_TIER: Record<string, string> = {
  [process.env.KIWIFY_PRODUCT_SABIO ?? "__sabio__"]: "pro",
  [process.env.KIWIFY_PRODUCT_MESTRE ?? "__mestre__"]: "unlimited",
};

const APPROVE = new Set(["compra_aprovada", "subscription_renewed", "paid", "approved"]);
const REVOKE = new Set([
  "subscription_canceled", "compra_reembolsada", "chargeback",
  "refunded", "canceled", "chargedback",
]);

function verify(raw: string, sig: string | null): boolean {
  if (!TOKEN || !sig) return false;
  const expected = createHmac("sha1", TOKEN).update(raw).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

/** pega o 1º valor definido de uma lista de caminhos "a.b.c" no objeto */
function pick(obj: unknown, ...paths: string[]): string | undefined {
  for (const p of paths) {
    let cur: unknown = obj;
    for (const seg of p.split(".")) {
      if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur) return cur;
    if (typeof cur === "number") return String(cur);
  }
  return undefined;
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = new URL(req.url).searchParams.get("signature");
  const okSig = verify(raw, sig);

  let body: unknown = {};
  try {
    body = JSON.parse(raw);
  } catch {
    /* deixa {} */
  }

  const email = (pick(body, "Customer.email", "customer.email", "buyer.email", "email") ?? "")
    .trim().toLowerCase();
  const eventType = pick(
    body, "webhook_event_type", "event", "order_status", "Subscription.status", "status",
  ) ?? "";
  const orderId = pick(body, "order_id", "Order.id", "id", "Subscription.id");
  const productId = pick(body, "Product.product_id", "product.id", "product_id", "Product.id");
  const tier = productId ? PRODUCT_TIER[productId] : undefined;

  let matched: string | null = null;
  let applied = false;

  if (okSig && email) {
    const isApprove = APPROVE.has(eventType);
    const isRevoke = REVOKE.has(eventType);
    const newPlan = isRevoke ? "free" : isApprove ? (tier ?? "pro") : null;

    if (newPlan) {
      const [u] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (u) {
        await db.update(users).set({ plan: newPlan }).where(eq(users.id, u.id));
        matched = u.id;
        applied = true;
      } else if (isApprove) {
        // pagou antes de ter conta → aplica no cadastro
        await db
          .insert(pendingUpgrades)
          .values({ email, plan: newPlan, kiwifyOrder: orderId ?? null, createdAt: new Date() })
          .onConflictDoUpdate({ target: pendingUpgrades.email, set: { plan: newPlan } });
        applied = true;
      }
    }
  }

  await db.insert(kiwifyEvents).values({
    eventType: eventType || null,
    orderId: orderId ?? null,
    email: email || null,
    matchedUser: matched,
    ok: okSig && applied,
    raw: body as object,
    createdAt: new Date(),
  });

  // sempre 200 — não revela se a assinatura bateu (e o Kiwify não re-tenta à toa)
  return NextResponse.json({ received: true });
}
