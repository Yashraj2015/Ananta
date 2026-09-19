import { Router } from 'itty-router';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { tenantMiddleware } from './middleware/tenant';
import { internalBroker } from './routes/internal';
import { presign } from './routes/presign';
import { dataRouter } from './routes/data';

export interface Env {
  TENANT_CACHE: KVNamespace;
  ANANTA_KV: KVNamespace;
  ANANTA_SERVER_URL: string;
  ANANTA_JWT_SECRET: string;
  INTERNAL_BROKER_KEY: string;
  RATE_LIMIT_NAMESPACE: string;
  ANANTA_DOMAIN: string;
}

const router = Router();

// Health check
router.get('/healthz', () =>
  new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    headers: { 'Content-Type': 'application/json' },
  })
);

// Internal broker endpoint (no auth middleware — uses internal key)
router.get('/v1/internal/broker', internalBroker);

// Presign endpoint — auth required
router.post('/v1/files/presign', authMiddleware, presign);

// All data routes — full middleware stack
router.all('/v1/data/*', rateLimitMiddleware, authMiddleware, tenantMiddleware, dataRouter);

// All other /v1/* routes — auth + tenant only
router.all('/v1/*', rateLimitMiddleware, authMiddleware, tenantMiddleware, async (request: any, env: Env) => {
  const url = new URL(request.url);
  const targetUrl = `${env.ANANTA_SERVER_URL}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  // Strip any client-side internal headers before proxying
  headers.delete('X-Ananta-Internal-Key');
  // Forward tenant context
  if (request.tenantId) {
    headers.set('X-Ananta-Tenant-Id', request.tenantId);
  }
  if (request.jwtPayload) {
    headers.set('X-Ananta-User-Id', request.jwtPayload.sub ?? '');
    headers.set('X-Ananta-Plan', request.jwtPayload.plan ?? 'free');
  }

  const proxied = new Request(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  });

  try {
    const resp = await fetch(proxied);
    return resp;
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'upstream-unavailable', message: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

router.all('*', () => new Response(JSON.stringify({ error: 'not-found' }), {
  status: 404,
  headers: { 'Content-Type': 'application/json' },
}));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx).catch((err: any) => {
      console.error('[gateway] unhandled error', err?.message);
      return new Response(
        JSON.stringify({ error: 'internal-error', message: err?.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    });
  },
};
