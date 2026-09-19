import { AuthClient } from './types';

export class AuthClientImpl implements AuthClient {
  constructor(private baseUrl: string, private headers: Record<string, string>) {}

  async signUp(creds: any) { return { user: null, session: null }; }
  async signIn(creds: any) { return { user: null, session: null }; }
  async signOut() {}
  async getUser() { return null; }
  onAuthStateChange(callback: Function) { return { unsubscribe: () => {} }; }
}
