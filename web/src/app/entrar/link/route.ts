import { NextResponse } from "next/server";
import { findUserByLoginToken } from "@/lib/webauth";
import { createSession } from "@/lib/session";
import { ipOf, rateLimit } from "@/lib/ratelimit";

// Link pessoal: /entrar/link?k=<token> -> troca por cookie de sessão e some com o ?k
export async function GET(req: Request) {
  const url = new URL(req.url);
  const k = url.searchParams.get("k") ?? "";

  if (!rateLimit(`link:${ipOf(req)}`, 20, 10 * 60_000)) {
    return NextResponse.redirect(new URL("/entrar?e=rate", url));
  }

  const user = await findUserByLoginToken(k);
  if (!user) {
    return NextResponse.redirect(new URL("/entrar?e=link", url));
  }

  await createSession(user.id);
  const dest = user.status === "onboarding" ? "/onboarding" : "/";
  return NextResponse.redirect(new URL(dest, url)); // sem o ?k
}
