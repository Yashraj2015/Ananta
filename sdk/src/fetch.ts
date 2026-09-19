export class AnantaFetch {
  private baseUrl: string;
  private key: string;
  private customFetch: typeof fetch;
  private session: { access_token?: string } = {};

  constructor(baseUrl: string, key: string, customFetch?: typeof fetch) {
    this.baseUrl     = baseUrl;
    this.key         = key;
    this.customFetch = customFetch || fetch;
  }

  setSession(session: { access_token?: string }) { this.session = session; }

  async request<T = any>(method: string, path: string, body?: any, headers: Record<string,string> = {}): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
    const url = this.baseUrl + path;
    const token = this.session.access_token || this.key;
    const reqHeaders: Record<string, string> = {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token,
      'X-Ananta-Key':  this.key,
      ...headers
    };
    try {
      const res = await this.customFetch(url, {
        method,
        headers: reqHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      if (!res.ok) {
        let errMsg = 'Request failed';
        try { const j = await res.json(); errMsg = j.error?.message || j.message || errMsg; } catch {}
        return { data: null, error: { message: errMsg, code: String(res.status) } };
      }
      if (res.status === 204) return { data: null, error: null };
      const data = await res.json();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'Network error', code: 'NETWORK_ERR' } };
    }
  }

  get<T>(path: string, headers?: Record<string,string>) { return this.request<T>('GET', path, undefined, headers); }
  post<T>(path: string, body: any, headers?: Record<string,string>) { return this.request<T>('POST', path, body, headers); }
  patch<T>(path: string, body: any, headers?: Record<string,string>) { return this.request<T>('PATCH', path, body, headers); }
  delete<T>(path: string, headers?: Record<string,string>) { return this.request<T>('DELETE', path, undefined, headers); }
}
