import { Router } from 'itty-router';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { internalBroker } from './routes/internal';
import { presign } from './routes/presign';

const router = Router();

// GET  /healthz           → { ok: true }
router.get('/healthz', () => new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }));

// GET  /v1/internal/broker → internal broker
router.get('/v1/internal/broker', internalBroker);

// POST /v1/files/presign  → R2 presigned URL
router.post('/v1/files/presign', presign);

// *    /v1/*              → proxy to Ananta server
router.all('/v1/*', rateLimitMiddleware, authMiddleware, async (request: any, env: any) => {
    const url = new URL(request.url);
    const targetUrl = `${env.ANANTA_SERVER_URL}${url.pathname}${url.search}`;
    const newReq = new Request(targetUrl, request);
    return fetch(newReq);
});

router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
    fetch: router.handle
};
