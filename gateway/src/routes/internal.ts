import { Env } from '../index';

/**
 * GET /v1/internal/broker
 *
 * Returns broker connection details from the upstream server.
 * Requires X-Ananta-Internal-Key header matching INTERNAL_BROKER_KEY env var.
 */
export async function internalBroker(request: any, env: Env): Promise<Response> {
  const internalKey: string | null = request.headers.get('X-Ananta-Internal-Key');

  if (!internalKey) {
    return new Response(
      JSON.stringify({ error: 'unauthorized', message: 'Missing internal key' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const expectedKey = env.INTERNAL_BROKER_KEY;
  if (!expectedKey || internalKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: 'forbidden', message: 'Invalid internal key' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Forward to upstream Ananta server
  const targetUrl = `${env.ANANTA_SERVER_URL}/v1/internal/broker`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-Ananta-Internal-Key': internalKey,
        'Content-Type': 'application/json',
      },
    });

    // Relay upstream response verbatim
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (err: any) {
    console.error('[internal-broker] upstream fetch failed:', err?.message);
    return new Response(
      JSON.stringify({ error: 'upstream-error', message: err?.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
