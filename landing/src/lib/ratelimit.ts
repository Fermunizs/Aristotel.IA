// Rate limit em memória (janela deslizante). Na Vercel isso é POR INSTÂNCIA e
// some em cold start — suficiente pra uma landing de baixo tráfego. Se o volume
// crescer, trocar por Upstash Redis (@upstash/ratelimit).

type Hit = number[];
const buckets = new Map<string, Hit>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) {
    // poda simples
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}
