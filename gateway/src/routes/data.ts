import { Env } from '../index';

// Headers that clients must never be able to spoof to the upstream server
const STRIPPED_HEADERS = new Set([
  'x-ananta-internal-key',
  'x-ananta-tenant-id',    // we re-set this from verified context
  'x-ananta-user-id',
  'x-ananta-plan',
  'x-ananta-project-id',
]);

/**
 * Handler for all /v1/data/* routes.
 *
 * Applied after: rateLimitMiddleware → authMiddleware → tenantMiddleware
 *
 * - Strips any internal headers the client may have injected
 * - Injects verified context headers (tenant, user, plan)
 * - Proxies to ANANTA_SERVER_URL with full body/method/headers
 */
export async function dataRouter(request: any, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = `${env.ANANTA_SERVER_URL}${url.pathname}${url.search}`;

  // Build a clean headers object
  const outHeaders = new Headers();

  for (const [key, value] of request.headers.entries()) {
    if (!STRIPPED_HEADERS.has(key.toLowerCase())) {
      outHeaders.set(key, value);
    }
  }

  // Inject verified context
  if (request.tenantId) {
    outHeaders.set('X-Ananta-Tenant-Id', request.tenantId);
  }
  if (request.tenantConfig?.nodeCode) {
    outHeaders.set('X-Ananta-Node-Code', request.tenantConfig.nodeCode);
  }
  if (request.jwtPayload?.sub) {
    outHeaders.set('X-Ananta-User-Id', request.jwtPayload.sub);
  }
  if (request.jwtPayload?.plan) {
    outHeaders.set('X-Ananta-Plan', request.jwtPayload.plan);
  }
  if (request.rateLimit) {
    outHeaders.set('X-RateLimit-Limit', String(request.rateLimit.limit));
    outHeaders.set('X-RateLimit-Remaining', String(request.rateLimit.remaining));
  }

  const isBodyless = ['GET', 'HEAD', 'DELETE'].includes(request.method.toUpperCase());

  try {
    const upstream = await fetch(
      new Request(targetUrl, {
        method: request.method,
        headers: outHeaders,
        body: isBodyless ? undefined : request.body,
        // @ts-ignore - duplex needed for streaming bodies in some runtimes
        duplex: isBodyless ? undefined : 'half',
      })
    );

    // Stream response back to client
    const responseHeaders = new Headers(upstream.headers);
    // Add CORS headers so browser SDKs work
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Ananta-Key,X-Ananta-Project');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error('[data-router] upstream fetch failed:', err?.message);
    return new Response(
      JSON.stringify({ error: 'upstream-unavailable', message: err?.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
