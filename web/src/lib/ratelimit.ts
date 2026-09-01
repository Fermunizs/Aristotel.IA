// Rate limit em memória (janela deslizante por chave). Zera no redeploy — ok:
// serve pra frear força bruta, não pra contabilidade. Processo único.

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

/** true = pode prosseguir · false = estourou o limite. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) sweep(now);
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

function sweep(now: number) {
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}

/** IP do cliente atrás do túnel Cloudflare. */
export function ipOf(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "desconhecido";
}
