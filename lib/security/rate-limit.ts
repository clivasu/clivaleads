// Limite de requisições por IP em janela fixa, na memória da instância.
// Limitação conhecida: em serverless cada instância conta separado, então é
// uma barreira contra abuso simples (scripts em loop), não contra ataque
// distribuído. Para isso: regra de rate limit no firewall da Vercel
// (documentado em docs/audit/DEPLOY_SAFE.md).
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  );
}

export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()): boolean {
  if (now - lastSweep > windowMs) {
    for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
    lastSweep = now;
  }
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
