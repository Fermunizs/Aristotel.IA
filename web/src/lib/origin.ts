// A URL pública do painel — atrás do túnel Cloudflare o Node vê localhost:3000,
// então a fonte da verdade são os headers x-forwarded-* que o cloudflared põe.
export function publicOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  if (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    return `${proto}://${host}`;
  }
  return (process.env.PANEL_URL || new URL(req.url).origin).replace(/\/$/, "");
}
