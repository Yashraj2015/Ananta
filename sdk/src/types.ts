// ============================================================
// @ananta/js — Public Type Definitions
// ============================================================

export interface AnantaClientOptions {
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  realtime?: { timeout?: number };
}

// MongoDB-style filter operators
export type QueryFilter = Record<string, any | {
  $eq?: any; $ne?: any; $gt?: any; $gte?: any;
  $lt?: any; $lte?: any; $in?: any[]; $nin?: any[];
  $exists?: boolean; $regex?: string;
}>;

export interface FindOptions {
  limit?: number; skip?: number; sort?: string; order?: 'asc' | 'desc';
}

export interface InsertOptions { returning?: boolean; }
export interface UpdateOptions { returning?: boolean; }
export interface FetchOptions  { count?: 'exact' | 'planned' | 'estimated'; }

// User & Auth
export interface User {
  id: string; email?: string; phone?: string; role?: string;
  app_metadata?: Record<string, any>; user_metadata?: Record<string, any>;
  created_at: string;
}

export interface Session {
  access_token: string; refresh_token: string; expires_in: number;
  token_type: string; user: User;
}

export interface AuthResponse {
  data: { user: User | null; session: Session | null } | null;
  error: { message: string; code?: string } | null;
}

export interface SignInCredentials { email: string; password: string; }
export interface SignUpCredentials { email: string; password: string; options?: { data?: Record<string, any> }; }

// Storage
export interface StorageObject {
  id: string; name: string; bucket: string; size?: number;
  contentType?: string; url: string; createdAt?: string;
}

// Realtime
export interface RealtimeChannel {
  on(event: string, filter: any, callback: (payload: any) => void): RealtimeChannel;
  subscribe(callback?: (status: string) => void): RealtimeChannel;
  unsubscribe(): void;
  send(payload: any): void;
}

// Collection (MongoDB-style)
export interface Collection {
  find(filter?: QueryFilter, options?: FindOptions): Promise<{ data: any[]; error: null | { message: string } }>;
  findOne(filter?: QueryFilter): Promise<{ data: any | null; error: null | { message: string } }>;
  insert(doc: Record<string, any>, options?: InsertOptions): Promise<{ data: any; error: null | { message: string } }>;
  update(id: string, updates: Record<string, any>, options?: UpdateOptions): Promise<{ data: any; error: null | { message: string } }>;
  delete(id: string): Promise<{ data: null; error: null | { message: string } }>;
  count(filter?: QueryFilter): Promise<{ count: number; error: null | { message: string } }>;
}

// Table (Supabase/SQL-style — chainable builder)
export interface Table {
  select(columns?: string): Table;
  insert(rows: any | any[]): Table;
  update(values: Record<string, any>): Table;
  delete(): Table;
  eq(column: string, value: any): Table;
  neq(column: string, value: any): Table;
  gt(column: string, value: any): Table;
  gte(column: string, value: any): Table;
  lt(column: string, value: any): Table;
  lte(column: string, value: any): Table;
  like(column: string, pattern: string): Table;
  in(column: string, values: any[]): Table;
  order(column: string, options?: { ascending?: boolean }): Table;
  limit(count: number): Table;
  offset(count: number): Table;
  single(): Table;
  then(resolve: (value: { data: any; error: any; count?: number }) => any, reject?: (err: any) => any): Promise<any>;
}

// Auth client
export interface AuthClient {
  signUp(credentials: SignUpCredentials): Promise<AuthResponse>;
  signIn(credentials: SignInCredentials): Promise<AuthResponse>;
  signOut(): Promise<{ error: null | { message: string } }>;
  getUser(): Promise<{ data: { user: User | null }; error: null | { message: string } }>;
  getSession(): Promise<{ data: { session: Session | null }; error: null | { message: string } }>;
  refreshSession(refreshToken: string): Promise<AuthResponse>;
  onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: { unsubscribe: () => void } } };
}

// Storage client
export interface StorageClient {
  from(bucket: string): {
    upload(path: string, file: File | Blob | ArrayBuffer, options?: { contentType?: string; upsert?: boolean }): Promise<{ data: StorageObject | null; error: null | { message: string } }>;
    download(path: string): Promise<{ data: Blob | null; error: null | { message: string } }>;
    getPublicUrl(path: string, options?: { download?: boolean; transform?: { width?: number; height?: number; quality?: number } }): { data: { publicUrl: string } };
    remove(paths: string[]): Promise<{ data: any; error: null | { message: string } }>;
    list(prefix?: string, options?: { limit?: number; offset?: number }): Promise<{ data: StorageObject[]; error: null | { message: string } }>;
    createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: null | { message: string } }>;
  };
}

// Realtime client
export interface RealtimeClient {
  channel(name: string): RealtimeChannel;
  removeChannel(channel: RealtimeChannel): void;
  removeAllChannels(): void;
}

// Full client
export interface AnantaClient {
  collection(name: string): Collection;
  from(name: string): Table;
  table(name: string): Table;
  auth: AuthClient;
  storage: StorageClient;
  channel(name: string): RealtimeChannel;
  realtime: RealtimeClient;
}
