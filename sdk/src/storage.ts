import { AnantaFetch } from './fetch';
import type { StorageObject } from './types';

export class StorageClient {
  constructor(private baseUrl: string, private key: string, private fetcher: AnantaFetch) {}

  from(bucket: string) {
    const fetcher = this.fetcher;
    const baseUrl = this.baseUrl;
    return {
      async upload(path: string, file: File | Blob | ArrayBuffer, options?: { contentType?: string; upsert?: boolean }) {
        const form = new FormData();
        form.append('file', file instanceof ArrayBuffer ? new Blob([file]) : file, path.split('/').pop());
        form.append('bucket', bucket);
        form.append('path', path);
        try {
          const res = await fetch(baseUrl + '/v1/files/upload', {
            method: 'POST', body: form,
            headers: { 'Authorization': 'Bearer ' + fetcher['key'] }
          });
          if (!res.ok) return { data: null, error: { message: 'Upload failed' } };
          const data = await res.json();
          return { data: { ...data, name: path, bucket } as StorageObject, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err?.message || 'Upload failed' } };
        }
      },

      async download(path: string) {
        const { data, error } = await fetcher.get<Blob>('/v1/files/' + bucket + '/' + path);
        return { data: data as unknown as Blob, error };
      },

      getPublicUrl(path: string, options?: { download?: boolean }) {
        const url = baseUrl + '/v1/files/' + bucket + '/' + path + (options?.download ? '?download=1' : '');
        return { data: { publicUrl: url } };
      },

      async createSignedUrl(path: string, expiresIn: number) {
        const { data, error } = await fetcher.post('/v1/files/presign', { filename: path, contentType: 'application/octet-stream', expiresIn });
        return { data: data ? { signedUrl: (data as any).uploadUrl } : null, error };
      },

      async remove(paths: string[]) {
        const results = await Promise.all(paths.map(p => fetcher.delete('/v1/files/' + bucket + '/' + p)));
        return { data: results, error: null };
      },

      async list(prefix = '', options?: { limit?: number; offset?: number }) {
        const { data, error } = await fetcher.get<{ data: StorageObject[] }>('/v1/files/list?prefix=' + prefix);
        return { data: (data as any)?.data ?? [], error };
      }
    };
  }
}
