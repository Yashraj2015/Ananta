export async function presign(request: any, env: any) {
    try {
        const body = await request.json();
        // Body: { key, contentType, operation: 'put'|'get' }
        // Proxies to Ananta server → Kavacha → R2 presigned URL
        
        return new Response(JSON.stringify({
            url: 'https://storage.ananta.io/mock-presigned-url',
            expiresAt: new Date(Date.now() + 3600000).toISOString()
        }), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
        return new Response('Bad Request', { status: 400 });
    }
}
