import { Env } from '../index';

const DEFAULT_LIMIT_PER_MINUTE = 1000;
const PAID_LIMIT_PER_MINUTE = 10_000;

function getCurrentMinuteBucket(): string {
  return Math.floor(Date.now() / 60_000).toString();
}

function getPlanLimit(plan?: string): number {
  switch (plan) {
    case 'pro':
    case 'team':
    case 'enterprise':
      return PAID_LIMIT_PER_MINUTE;
    default:
      return DEFAULT_LIMIT_PER_MINUTE;
  }
}

export async function rateLimitMiddleware(request: any, env: Env): Promise<Response | undefined> {
  // Use CF-Connecting-IP; fall back to a generic key
  const ip: string =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ??
    'unknown';

  const minute = getCurrentMinuteBucket();
  const kvKey = `rl:${ip}:${minute}`;

  const plan: string | undefined = request.jwtPayload?.plan;
  const limit = getPlanLimit(plan);

  try {
    const kv: KVNamespace = env.TENANT_CACHE; // reuse TENANT_CACHE for rate limiting
    const raw = await kv.get(kvKey, { type: 'text' });
    const count = raw ? parseInt(raw, 10) : 0;

    if (count >= limit) {
      const retryAfter = 60 - (Math.floor(Date.now() / 1000) % 60);
      return new Response(
        JSON.stringify({
          error: 'rate-limit-exceeded',
          message: `Limit of ${limit} requests/min exceeded`,
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 60_000) * 60),
          },
        }
      );
    }

    // Increment — TTL = 120s so key auto-expires even if something goes wrong
    await kv.put(kvKey, String(count + 1), { expirationTtl: 120 });

    // Attach rate limit info to request for downstream headers
    request.rateLimit = { limit, remaining: limit - count - 1 };
  } catch (err: any) {
    // On KV error, allow the request through (fail open) but log it
    console.error('[rate-limit] KV error, failing open:', err?.message);
  }

  return undefined; // continue
}
