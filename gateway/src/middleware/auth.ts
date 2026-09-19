import { Env } from '../index';

// ---- minimal JWT verification (HMAC-SHA256) without external libraries ----
// CF Workers supports SubtleCrypto natively.

function base64urlDecode(str: string): Uint8Array {
  // Pad to multiple of 4
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const b64 = padded + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;

  try {
    // Import key
    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify signature
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = base64urlDecode(sigB64);
    const valid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signature,
      enc.encode(signingInput)
    );

    if (!valid) return null;

    // Decode payload
    const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // expired
    }

    return payload;
  } catch {
    return null;
  }
}

export async function authMiddleware(request: any, env: Env): Promise<Response | undefined> {
  const authHeader: string | null = request.headers.get('Authorization');
  const apiKey: string | null = request.headers.get('X-Ananta-Key');

  // --- API key path ---
  if (apiKey) {
    if (!apiKey.startsWith('ak_live_') && !apiKey.startsWith('ak_test_')) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid API key format' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // API keys are pre-validated by format; attach synthetic payload
    request.jwtPayload = {
      sub: 'api-key-user',
      plan: apiKey.startsWith('ak_live_') ? 'pro' : 'free',
      type: 'api-key',
    };
    return undefined; // continue
  }

  // --- Bearer JWT path ---
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const secret = env.ANANTA_JWT_SECRET;

    if (!secret) {
      console.error('[auth] ANANTA_JWT_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'server-misconfigured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const payload = await verifyJWT(token, secret);
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    request.jwtPayload = payload;
    return undefined; // continue
  }

  return new Response(
    JSON.stringify({ error: 'unauthorized', message: 'Missing Authorization header or X-Ananta-Key' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );
}
