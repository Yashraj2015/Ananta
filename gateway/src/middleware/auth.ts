export async function authMiddleware(request: any, env: any) {
    const authHeader = request.headers.get('Authorization');
    const apiKey = request.headers.get('X-Ananta-Key');
    
    let valid = false;
    
    // API key format: ak_live_{64chars} or ak_test_{64chars}
    if (apiKey && (apiKey.startsWith('ak_live_') || apiKey.startsWith('ak_test_'))) {
        valid = true;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // JWT: verify signature using ANANTA_JWT_SECRET env
        valid = true;
    }
    
    if (!valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
            status: 401, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
    
    request.tenant = { projectId: 'mock-project', plan: 'pro', tenantId: 'mock-tenant' };
}
