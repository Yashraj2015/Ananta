// ─── Ananta DB JS/TS SDK ─── types.ts ─────────────────────────────────────

export interface ClientOptions {
  /** Project ID (required) */
  projectId: string;
  /** API key — format: ak_live_<64chars> or ak_test_<64chars> */
  apiKey: string;
  /** Override the default API base URL */
  apiUrl?: string;
}

// ─── MongoDB-style query operators ────────────────────────────────────────

export type QueryOperator<T = any> =
  | { $eq: T }
  | { $ne: T }
  | { $gt: T }
  | { $gte: T }
  | { $lt: T }
  | { $lte: T }
  | { $in: T[] }
  | { $nin: T[] }
  | { $exists: boolean }
  | { $regex: string; $options?: string };

export type QueryFilter<T extends Record<string, any> = Record<string, any>> =
  | { [K in keyof T]?: T[K] | QueryOperator<T[K]> }
  | { $and: QueryFilter<T>[] }
  | { $or: QueryFilter<T>[] }
  | { $nor: QueryFilter<T>[] };

export interface FindOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  projection?: Record<string, 0 | 1>;
}

export interface SearchOptions {
  /** Max results */
  limit?: number;
  /** Offset */
  skip?: number;
  /** Fields to search in */
  fields?: string[];
  /** Minimum score threshold 0–1 */
  minScore?: number;
}

// ─── Collection ───────────────────────────────────────────────────────────

export interface CollectionClient<T extends Record<string, any> = Record<string, any>> {
  find(filter?: QueryFilter<T>, options?: FindOptions): Promise<T[]>;
  findOne(filter?: QueryFilter<T>): Promise<T | null>;
  insert(doc: Omit<T, '_id'>): Promise<{ id: string }>;
  insertMany(docs: Omit<T, '_id'>[]): Promise<{ ids: string[] }>;
  update(filter: QueryFilter<T>, update: Partial<T> | Record<string, any>): Promise<{ modified: number }>;
  updateById(id: string, update: Partial<T> | Record<string, any>): Promise<{ modified: number }>;
  delete(filter: QueryFilter<T>): Promise<{ deleted: number }>;
  deleteById(id: string): Promise<{ deleted: number }>;
  search(query: string, options?: SearchOptions): Promise<T[]>;
}

// ─── SQL-style Table ──────────────────────────────────────────────────────

export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';

export interface TableQueryBuilder<T = any> extends Promise<T[]> {
  select(columns?: string): this;
  eq(column: string, value: any): this;
  neq(column: string, value: any): this;
  gt(column: string, value: any): this;
  gte(column: string, value: any): this;
  lt(column: string, value: any): this;
  lte(column: string, value: any): this;
  like(column: string, pattern: string): this;
  ilike(column: string, pattern: string): this;
  in(column: string, values: any[]): this;
  is(column: string, value: null | boolean): this;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this;
  limit(count: number): this;
  offset(count: number): this;
  single(): Promise<T | null>;
}

export interface TableClient {
  select(columns?: string): TableQueryBuilder;
  insert(rows: Record<string, any> | Record<string, any>[]): Promise<{ data: any[]; count: number }>;
  update(values: Record<string, any>): TableQueryBuilder;
  delete(): TableQueryBuilder;
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
}

export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';

export interface AuthStateSubscription {
  unsubscribe(): void;
}

export interface AuthClient {
  signUp(credentials: AuthCredentials): Promise<{ user: AuthUser | null; session: AuthSession | null }>;
  signIn(credentials: AuthCredentials): Promise<{ user: AuthUser | null; session: AuthSession | null }>;
  signOut(): Promise<void>;
  getUser(): Promise<AuthUser | null>;
  refreshToken(): Promise<AuthSession | null>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: AuthSession | null) => void
  ): AuthStateSubscription;
}

// ─── Storage ──────────────────────────────────────────────────────────────

export interface UploadOptions {
  /** MIME type override */
  contentType?: string;
  /** Cache-Control header */
  cacheControl?: string;
  /** Upsert existing file */
  upsert?: boolean;
  /** For paid plans: request original quality stream */
  quality?: 'original' | 'hd' | 'default';
}

export interface StorageFileObject {
  key: string;
  size: number;
  lastModified: string;
  contentType: string;
  url?: string;
}

export interface StorageClient {
  upload(
    bucket: string,
    path: string,
    file: File | Blob | ArrayBuffer | ReadableStream,
    options?: UploadOptions
  ): Promise<{ url: string; key: string }>;
  download(bucket: string, path: string): Promise<Response>;
  getPublicUrl(bucket: string, path: string, options?: { quality?: 'original' | 'hd' | 'default' }): string;
  remove(bucket: string, path: string): Promise<void>;
  list(bucket: string, prefix?: string): Promise<StorageFileObject[]>;
}

// ─── Realtime ─────────────────────────────────────────────────────────────

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimePayload<T = any> {
  event: Exclude<RealtimeEvent, '*'>;
  collection: string;
  record: T;
  oldRecord?: T;
}

export interface RealtimeChannel {
  on(event: RealtimeEvent, callback: (payload: RealtimePayload) => void): this;
  subscribe(): Promise<void>;
  unsubscribe(): void;
}

// ─── Top-level client ─────────────────────────────────────────────────────

export interface AnantaClient {
  /** MongoDB-style collection access */
  collection<T extends Record<string, any> = Record<string, any>>(name: string): CollectionClient<T>;
  /** Alias for collection() — Supabase-compat */
  from<T extends Record<string, any> = Record<string, any>>(name: string): CollectionClient<T>;
  /** SQL-style table access */
  table(name: string): TableClient;
  /** Auth operations */
  auth: AuthClient;
  /** File storage */
  storage: StorageClient;
  /** Realtime channel */
  channel(name: string): RealtimeChannel;
}
