import { AnantaFetch } from './fetch';
import type { SignUpCredentials, SignInCredentials, AuthResponse, User, Session } from './types';

type AuthStateListener = (event: string, session: Session | null) => void;

export class AuthClient {
  private session: Session | null = null;
  private listeners: AuthStateListener[] = [];

  constructor(private baseUrl: string, private key: string, private fetcher: AnantaFetch) {}

  private notify(event: string, session: Session | null) {
    this.listeners.forEach(fn => fn(event, session));
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    const { data, error } = await this.fetcher.post<{ data: any }>('/v1/auth/signup', credentials);
    if (!error && data) {
      this.session = (data as any).session || null;
      if (this.session) { this.fetcher.setSession(this.session); this.notify('SIGNED_IN', this.session); }
    }
    return { data: error ? null : { user: (data as any)?.user ?? null, session: (data as any)?.session ?? null }, error };
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    const { data, error } = await this.fetcher.post<any>('/v1/auth/signin', credentials);
    if (!error && data) {
      this.session = data.session || data;
      if (this.session) { this.fetcher.setSession(this.session); this.notify('SIGNED_IN', this.session); }
    }
    return { data: error ? null : { user: data?.user ?? null, session: data?.session ?? data ?? null }, error };
  }

  async signOut() {
    await this.fetcher.post('/v1/auth/signout', {});
    this.session = null;
    this.fetcher.setSession({});
    this.notify('SIGNED_OUT', null);
    return { error: null };
  }

  async getUser() {
    if (!this.session?.access_token) return { data: { user: null }, error: null };
    const { data, error } = await this.fetcher.get<{ user: User }>('/v1/auth/user');
    return { data: { user: (data as any)?.user ?? null }, error };
  }

  async getSession() {
    return { data: { session: this.session }, error: null };
  }

  async refreshSession(refreshToken: string): Promise<AuthResponse> {
    const { data, error } = await this.fetcher.post<any>('/v1/auth/refresh', { refresh_token: refreshToken });
    if (!error && data?.session) {
      this.session = data.session;
      this.fetcher.setSession(this.session!);
      this.notify('TOKEN_REFRESHED', this.session);
    }
    return { data: error ? null : { user: data?.user ?? null, session: data?.session ?? null }, error };
  }

  onAuthStateChange(callback: AuthStateListener) {
    this.listeners.push(callback);
    return { data: { subscription: { unsubscribe: () => { this.listeners = this.listeners.filter(f => f !== callback); } } } };
  }
}
