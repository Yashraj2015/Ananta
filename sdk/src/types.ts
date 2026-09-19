export interface ClientOptions {
  projectId: string;
  apiKey: string;
  apiUrl?: string;
}

export interface AnantaClient {
  collection(name: string): CollectionClient;
  table(name: string): TableClient;
  auth: AuthClient;
  storage: StorageClient;
  channel(name: string): RealtimeChannel;
}

export interface CollectionClient {
  find(filter?: Record<string, any>, options?: any): Promise<any[]>;
  findOne(filter: Record<string, any>): Promise<any | null>;
  insert(doc: Record<string, any>): Promise<{ id: string }>;
  insertMany(docs: Record<string, any>[]): Promise<{ ids: string[] }>;
  update(filter: Record<string, any>, update: Record<string, any>): Promise<{ modified: number }>;
  updateById(id: string, update: Record<string, any>): Promise<{ modified: number }>;
  delete(filter: Record<string, any>): Promise<{ deleted: number }>;
  deleteById(id: string): Promise<{ deleted: number }>;
  search(query: string, options?: any): Promise<any[]>;
}

export interface TableClient {
  select(columns?: string): this;
  where(col: string, op: string, val: any): this;
  orderBy(col: string, dir?: 'asc' | 'desc'): this;
  limit(n: number): this;
  execute(): Promise<any[]>;
}

export interface AuthClient {
  signUp(creds: any): Promise<{ user: any; session: any }>;
  signIn(creds: any): Promise<{ user: any; session: any }>;
  signOut(): Promise<void>;
  getUser(): Promise<any | null>;
  onAuthStateChange(callback: Function): any;
}

export interface StorageClient {
  upload(file: any, path: string, options?: any): Promise<{ url: string }>;
  download(path: string): Promise<any>;
  remove(path: string): Promise<void>;
  getPublicUrl(path: string, quality?: 'original' | 'hd' | 'default'): string;
}

export interface RealtimeChannel {
  on(event: 'INSERT' | 'UPDATE' | 'DELETE' | '*', callback: Function): this;
  subscribe(): Promise<void>;
  unsubscribe(): void;
}
