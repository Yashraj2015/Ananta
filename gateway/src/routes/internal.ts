export async function internalBroker(request: any, env: any) {
    const internalKey = request.headers.get('X-Ananta-Internal-Key');
    if (!internalKey) {
        return new Response('Unauthorized', { status: 401 });
    }
    
    return new Response(JSON.stringify({
        mongoUri: 'mongodb://localhost:27017/ananta',
        s3Endpoint: 'https://s3.ananta.io',
        s3Bucket: 'ananta-storage',
        s3Key: 'mock-key',
        s3Secret: 'mock-secret'
    }), { headers: { 'Content-Type': 'application/json' } });
}
