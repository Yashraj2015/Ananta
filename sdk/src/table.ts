import { AnantaFetch } from './fetch';

type Condition = { column: string; op: string; value: any };

export class Table {
  private _select: string = '*';
  private _conditions: Condition[] = [];
  private _order: { column: string; asc: boolean } | null = null;
  private _limit:  number | null = null;
  private _offset: number | null = null;
  private _single: boolean = false;
  private _method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private _body:   any = undefined;

  constructor(private name: string, private fetcher: AnantaFetch, private auth: any) {}

  select(columns = '*'): this { this._select = columns; return this; }
  insert(rows: any | any[]): this { this._method = 'POST'; this._body = Array.isArray(rows) ? rows : [rows]; return this; }
  update(values: Record<string, any>): this { this._method = 'PATCH'; this._body = values; return this; }
  delete(): this { this._method = 'DELETE'; return this; }
  single(): this { this._single = true; return this; }
  limit(n: number): this { this._limit = n; return this; }
  offset(n: number): this { this._offset = n; return this; }
  order(col: string, opts?: { ascending?: boolean }): this { this._order = { column: col, asc: opts?.ascending ?? true }; return this; }

  private _addFilter(col: string, op: string, val: any): this { this._conditions.push({ column: col, op, value: val }); return this; }
  eq(col: string, val: any): this   { return this._addFilter(col, '$eq',  val); }
  neq(col: string, val: any): this  { return this._addFilter(col, '$ne',  val); }
  gt(col: string, val: any): this   { return this._addFilter(col, '$gt',  val); }
  gte(col: string, val: any): this  { return this._addFilter(col, '$gte', val); }
  lt(col: string, val: any): this   { return this._addFilter(col, '$lt',  val); }
  lte(col: string, val: any): this  { return this._addFilter(col, '$lte', val); }
  like(col: string, pat: string): this { return this._addFilter(col, '$regex', pat.replace(/%/g, '.*')); }
  in(col: string, vals: any[]): this   { return this._addFilter(col, '$in', vals); }

  then(resolve: (value: any) => any, reject?: (err: any) => any): Promise<any> {
    return this._execute().then(resolve, reject);
  }

  private async _execute(): Promise<{ data: any; error: any; count?: number }> {
    if (this._method === 'POST') {
      const results = [];
      for (const row of this._body) {
        const { data, error } = await this.fetcher.post('/v1/data/' + this.name, row);
        if (error) return { data: null, error };
        results.push((data as any)?.data ?? data);
      }
      return { data: this._body.length === 1 ? results[0] : results, error: null };
    }
    if (this._method === 'PATCH') {
      const idCond = this._conditions.find(c => c.column === 'id');
      const id = idCond?.value;
      const { data, error } = await this.fetcher.patch('/v1/data/' + this.name + (id ? '/' + id : ''), this._body);
      return { data: (data as any)?.data ?? data, error };
    }
    if (this._method === 'DELETE') {
      const idCond = this._conditions.find(c => c.column === 'id');
      const id = idCond?.value;
      const { data, error } = await this.fetcher.delete('/v1/data/' + this.name + (id ? '/' + id : ''));
      return { data, error };
    }
    // GET with filters
    const filter: Record<string, any> = {};
    for (const c of this._conditions) filter[c.column] = { [c.op]: c.value };
    const params = new URLSearchParams();
    if (Object.keys(filter).length) params.set('filter', JSON.stringify(filter));
    if (this._limit)  params.set('limit',  String(this._limit));
    if (this._offset) params.set('skip',   String(this._offset));
    if (this._order)  { params.set('sort', this._order.column); params.set('order', this._order.asc ? 'asc' : 'desc'); }
    const qs = params.toString();
    const { data, error } = await this.fetcher.get('/v1/data/' + this.name + (qs ? '?' + qs : ''));
    const rows = (data as any)?.data ?? data ?? [];
    return { data: this._single ? (rows[0] ?? null) : rows, error };
  }
}
