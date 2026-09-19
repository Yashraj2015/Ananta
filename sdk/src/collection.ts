import { CollectionClient } from './types';
import { anantaFetch } from './fetch';

export class CollectionClientImpl implements CollectionClient {
  constructor(private baseUrl: string, private headers: Record<string, string>, private name: string) {}

  async find(filter?: Record<string, any>, options?: any) { return []; }
  async findOne(filter: Record<string, any>) { return null; }
  async insert(doc: Record<string, any>) { return { id: 'mock-id' }; }
  async insertMany(docs: Record<string, any>[]) { return { ids: ['mock-id'] }; }
  async update(filter: Record<string, any>, update: Record<string, any>) { return { modified: 1 }; }
  async updateById(id: string, update: Record<string, any>) { return { modified: 1 }; }
  async delete(filter: Record<string, any>) { return { deleted: 1 }; }
  async deleteById(id: string) { return { deleted: 1 }; }
  async search(query: string, options?: any) { return []; }
}
