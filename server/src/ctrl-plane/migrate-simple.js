const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.zmegrjxbpsyvdtuhhvet:Supabase_Yashraj2010@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000
});

async function run() {
  await client.connect();
  console.log('Connected');
  
  // Test creating a simple table
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS node_registry (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        node_code       TEXT NOT NULL UNIQUE,
        node_type       TEXT NOT NULL,
        label           TEXT NOT NULL DEFAULT '',
        region          TEXT NOT NULL DEFAULT 'auto',
        status          TEXT NOT NULL DEFAULT 'STANDBY',
        credentials     JSONB,
        metadata        JSONB DEFAULT '{}',
        last_heartbeat  TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('node_registry: created');
  } catch(e) { console.error('node_registry error:', e.message); }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        email           TEXT NOT NULL UNIQUE,
        plan            TEXT NOT NULL DEFAULT 'free',
        status          TEXT NOT NULL DEFAULT 'active',
        storage_quota_mb  BIGINT DEFAULT 500,
        db_row_quota      BIGINT DEFAULT 50000,
        assigned_mongo_node  TEXT,
        assigned_pg_node     TEXT,
        assigned_r2_node     TEXT,
        revoke_reason   TEXT,
        stripe_customer_id TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('customers: created');
  } catch(e) { console.error('customers error:', e.message); }

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_snapshots (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   TEXT,
        db_mb       NUMERIC DEFAULT 0,
        files_mb    NUMERIC DEFAULT 0,
        api_calls   BIGINT DEFAULT 0,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('usage_snapshots: created');
  } catch(e) { console.error('usage_snapshots error:', e.message); }

  // Verify
  const { rows } = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  console.log('All public tables:', rows.map(r=>r.tablename).join(', '));
  await client.end();
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });