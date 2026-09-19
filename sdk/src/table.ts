import { TableClient } from './types';
import { anantaFetch } from './fetch';

export class TableClientImpl implements TableClient {
  constructor(private baseUrl: string, private headers: Record<string, string>, private name: string) {}

  select(columns?: string) { return this; }
  where(col: string, op: string, val: any) { return this; }
  orderBy(col: string, dir?: 'asc' | 'desc') { return this; }
  limit(n: number) { return this; }
  async execute() { return []; }
}
