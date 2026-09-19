import { AnantaFetch } from './fetch';
import type { QueryFilter, FindOptions } from './types';

export class Collection {
  constructor(private name: string, private fetcher: AnantaFetch, private auth: any) {}

  async find(filter: QueryFilter = {}, options: FindOptions = {}): Promise<{ data: any[]; error: { message: string } | null }> {
    const params = new URLSearchParams();
    if (Object.keys(filter).length) params.set('filter', JSON.stringify(filter));
    if (options.limit)  params.set('limit',  String(options.limit));
    if (options.skip)   params.set('skip',   String(options.skip));
    if (options.sort)   params.set('sort',   options.sort);
    if (options.order)  params.set('order',  options.order);
    const qs = params.toString();
    const { data, error } = await this.fetcher.get<{ data: any[] }>('/v1/data/' + this.name + (qs ? '?' + qs : ''));
    return { data: (data as any)?.data ?? [], error: error ? { message: error.message } : null };
  }

  async findOne(filter: QueryFilter = {}): Promise<{ data: any | null; error: { message: string } | null }> {
    const { data, error } = await this.find(filter, { limit: 1 });
    return { data: data?.[0] ?? null, error };
  }

  async insert(doc: Record<string, any>): Promise<{ data: any; error: { message: string } | null }> {
    const { data, error } = await this.fetcher.post<{ data: any }>('/v1/data/' + this.name, doc);
    return { data: (data as any)?.data ?? data, error: error ? { message: error.message } : null };
  }

  async update(id: string, updates: Record<string, any>): Promise<{ data: any; error: { message: string } | null }> {
    const { data, error } = await this.fetcher.patch<{ data: any }>('/v1/data/' + this.name + '/' + id, updates);
    return { data: (data as any)?.data ?? data, error: error ? { message: error.message } : null };
  }

  async delete(id: string): Promise<{ data: null; error: { message: string } | null }> {
    const { error } = await this.fetcher.delete('/v1/data/' + this.name + '/' + id);
    return { data: null, error: error ? { message: error.message } : null };
  }

  async count(filter: QueryFilter = {}): Promise<{ count: number; error: { message: string } | null }> {
    const { data, error } = await this.find(filter, { limit: 0 });
    return { count: (data as any)?.length ?? 0, error };
  }
}
