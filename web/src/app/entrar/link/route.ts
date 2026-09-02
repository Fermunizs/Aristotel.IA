import { NextResponse } from "next/server";
import { findUserByLoginToken } from "@/lib/webauth";
import { createSession } from "@/lib/session";
import { ipOf, rateLimit } from "@/lib/ratelimit";
import { publicOrigin } from "@/lib/origin";

// Link pessoal: /entrar/link?k=<token> -> troca por cookie de sessão e some com o ?k
export async function GET(req: Request) {
  const origin = publicOrigin(req);
  const k = new URL(req.url).searchParams.get("k") ?? "";

  if (!rateLimit(`link:${ipOf(req)}`, 20, 10 * 60_000)) {
    return NextResponse.redirect(new URL("/entrar?e=rate", origin));
  }

  const user = await findUserByLoginToken(k);
  if (!user) {
    return NextResponse.redirect(new URL("/entrar?e=link", origin));
  }

  await createSession(user.id);
  const dest = user.status === "onboarding" ? "/onboarding" : "/";
  return NextResponse.redirect(new URL(dest, origin)); // sem o ?k
}
