import { AnantaClient, ClientOptions } from './types';
import { CollectionClientImpl } from './collection';
import { TableClientImpl } from './table';
import { AuthClientImpl } from './auth';
import { StorageClientImpl } from './storage';
import { RealtimeChannelImpl } from './realtime';

export function createClient(options: ClientOptions): AnantaClient {
  const baseUrl = options.apiUrl || 'https://api.ananta.io';
  const headers = {
    'X-Ananta-Key': options.apiKey,
    'X-Ananta-Project': options.projectId,
    'Content-Type': 'application/json'
  };
  return {
    collection: (name) => new CollectionClientImpl(baseUrl, headers, name),
    table: (name) => new TableClientImpl(baseUrl, headers, name),
    auth: new AuthClientImpl(baseUrl, headers),
    storage: new StorageClientImpl(baseUrl, headers),
    channel: (name) => new RealtimeChannelImpl(baseUrl, options.apiKey, name)
  };
}
