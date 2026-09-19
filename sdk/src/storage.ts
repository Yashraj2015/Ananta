import { StorageClient } from './types';

export class StorageClientImpl implements StorageClient {
  constructor(private baseUrl: string, private headers: Record<string, string>) {}

  async upload(file: any, path: string, options?: any) { return { url: '' }; }
  async download(path: string) { return new Response(); }
  async remove(path: string) {}
  getPublicUrl(path: string, quality?: 'original' | 'hd' | 'default') { return ''; }
}
