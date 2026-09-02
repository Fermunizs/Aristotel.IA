import { NextResponse } from "next/server";
import { createWebUser } from "@/lib/webauth";
import { createSession } from "@/lib/session";
import { ipOf, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const ip = ipOf(req);
  if (!rateLimit(`signup:${ip}`, 6, 30 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Espera uns minutos." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const result = await createWebUser(body.name, body.email);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await createSession(result.id);
  // o token vai pro cliente só aqui, uma vez — a tela de onboarding mostra pra pessoa salvar
  return NextResponse.json({ ok: true, token: result.token });
}
