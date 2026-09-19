import { Collection } from './collection';
import { Table }      from './table';
import { AuthClient } from './auth';
import { StorageClient } from './storage';
import { RealtimeClient } from './realtime';
import { AnantaFetch } from './fetch';
import type { AnantaClientOptions, AnantaClient } from './types';

/**
 * createClient(url, key, options?)
 *
 * Creates an Ananta DB client. Fully compatible with Supabase SDK surface.
 *
 * @example
 * const ananta = createClient('https://dave.db.ananta.io', 'your-anon-key');
 * const { data } = await ananta.collection('users').find({ name: 'Alice' });
 * const { data } = await ananta.from('users').select('*').eq('name', 'Alice');
 */
export function createClient(url: string, key: string, options: AnantaClientOptions = {}): AnantaClient {
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  const fetcher = new AnantaFetch(baseUrl, key, options.fetch);
  const auth    = new AuthClient(baseUrl, key, fetcher);
  const storage = new StorageClient(baseUrl, key, fetcher);
  const realtime = new RealtimeClient(baseUrl, key);

  return {
    // MongoDB-style: ananta.collection('users').find(...)
    collection: (name: string) => new Collection(name, fetcher, auth),
    // Supabase-style alias: ananta.from('users').select('*')
    from:       (name: string) => new Table(name, fetcher, auth),
    auth,
    storage,
    channel:    (name: string) => realtime.channel(name),
    realtime,
    // Direct table access alias for SQL users
    table:      (name: string) => new Table(name, fetcher, auth),
  } as unknown as AnantaClient;
}
