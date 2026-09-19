import { Env } from '../index';

interface PresignBody {
  filename: string;
  contentType: string;
  size: number;
  bucket?: string;
}

/**
 * POST /v1/files/presign
 *
 * Accepts { filename, contentType, size, bucket? } and forwards to the
 * Ananta server which returns a presigned URL for direct-to-R2 upload.
 */
export async function presign(request: any, env: Env): Promise<Response> {
  let body: PresignBody;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'bad-request', message: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { filename, contentType, size } = body;

  if (!filename || !contentType || size === undefined) {
    return new Response(
      JSON.stringify({
        error: 'bad-request',
        message: 'Body must include filename, contentType, and size',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Basic size guard (e.g. 5 GB limit)
  if (size > 5 * 1024 * 1024 * 1024) {
    return new Response(
      JSON.stringify({ error: 'payload-too-large', message: 'File size exceeds 5 GB' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const targetUrl = `${env.ANANTA_SERVER_URL}/v1/files/presign`;

  // Forward JWT/API key context so the server can authorize the bucket
  const forwardHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const authHeader: string | null = request.headers.get('Authorization');
  if (authHeader) forwardHeaders['Authorization'] = authHeader;
  const apiKey: string | null = request.headers.get('X-Ananta-Key');
  if (apiKey) forwardHeaders['X-Ananta-Key'] = apiKey;
  if (request.tenantId) forwardHeaders['X-Ananta-Tenant-Id'] = request.tenantId;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      return new Response(errBody, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await upstream.json<{ url: string; expiresAt: string; key: string }>();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[presign] upstream fetch failed:', err?.message);
    return new Response(
      JSON.stringify({ error: 'upstream-error', message: err?.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
