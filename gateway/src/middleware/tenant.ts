import { Env } from '../index';

const TENANT_TTL_SECONDS = 300; // 5 minutes

export interface TenantConfig {
  tenantId: string;
  nodeCode: string;
  schemaName: string;
  plan: string;
  projectId: string;
}

/**
 * Extracts tenantId from the subdomain.
 * e.g. dave.db.ananta.io  →  'dave'
 *      api.ananta.io       →  null (no tenant subdomain)
 */
function extractTenantFromHost(host: string | null): string | null {
  if (!host) return null;
  // Match <tenantId>.db.ananta.io
  const match = host.match(/^([a-z0-9-]+)\.db\./i);
  return match ? match[1] : null;
}

/**
 * Fetch tenant config from upstream server and cache in KV.
 */
async function fetchAndCacheTenant(
  tenantId: string,
  env: Env
): Promise<TenantConfig | null> {
  try {
    const url = `${env.ANANTA_SERVER_URL}/v1/internal/tenant/${encodeURIComponent(tenantId)}`;
    const resp = await fetch(url, {
      headers: {
        'X-Ananta-Internal-Key': env.INTERNAL_BROKER_KEY ?? '',
      },
    });

    if (!resp.ok) {
      console.error(`[tenant] upstream returned ${resp.status} for tenant ${tenantId}`);
      return null;
    }

    const config: TenantConfig = await resp.json();

    // Cache in KV
    await env.TENANT_CACHE.put(
      `tenant:${tenantId}`,
      JSON.stringify(config),
      { expirationTtl: TENANT_TTL_SECONDS }
    );

    return config;
  } catch (err: any) {
    console.error(`[tenant] failed to fetch config for ${tenantId}:`, err?.message);
    return null;
  }
}

/**
 * Resolve tenant from KV cache or upstream.
 */
export async function resolveTenant(tenantId: string, env: Env): Promise<TenantConfig | null> {
  const cacheKey = `tenant:${tenantId}`;

  try {
    const cached = await env.TENANT_CACHE.get(cacheKey, { type: 'text' });
    if (cached) {
      return JSON.parse(cached) as TenantConfig;
    }
  } catch {
    // cache miss or parse error — fall through to upstream
  }

  return fetchAndCacheTenant(tenantId, env);
}

/**
 * Middleware: extracts tenantId from subdomain, resolves config, attaches to request.
 */
export async function tenantMiddleware(request: any, env: Env): Promise<Response | undefined> {
  const host: string | null = request.headers.get('host') ?? request.headers.get(':authority') ?? null;
  const tenantId = extractTenantFromHost(host);

  if (!tenantId) {
    // No tenant subdomain — pass through (handled by other routes)
    return undefined;
  }

  const config = await resolveTenant(tenantId, env);

  if (!config) {
    return new Response(
      JSON.stringify({ error: 'tenant-not-found', tenantId }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  request.tenantId = config.tenantId;
  request.tenantConfig = config;

  return undefined; // continue
}
