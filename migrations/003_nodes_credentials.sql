-- 003_nodes_credentials.sql
-- Stores all backend node credentials in the ctrl-plane DB
-- Encrypted at rest (AES-256-GCM via server before insert)
-- Kavacha reads from this table dynamically (no restart needed)

CREATE TABLE IF NOT EXISTS node_registry (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_code       TEXT NOT NULL UNIQUE,   -- e.g. node-a1, node-n1, node-r2a
  node_type       TEXT NOT NULL,          -- atlas | pg-neon | ctrl-plane | r2 | redis
  label           TEXT NOT NULL DEFAULT '', -- human label e.g. "Atlas M0 - Mumbai"
  region          TEXT NOT NULL DEFAULT 'auto',
  status          TEXT NOT NULL DEFAULT 'STANDBY', -- ACTIVE | STANDBY | DEGRADED | OFFLINE
  credentials     JSONB,                 -- AES-256-GCM encrypted blob: { iv, tag, data }
  metadata        JSONB DEFAULT '{}',    -- extra info (group_id for Atlas Admin API, etc.)
  last_heartbeat  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Customers / Tenants
CREATE TABLE IF NOT EXISTS customers (
  id              TEXT PRIMARY KEY,       -- tenant_xxxxxxxx
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  plan            TEXT NOT NULL DEFAULT 'free',
  status          TEXT NOT NULL DEFAULT 'active', -- active | suspended | deleted
  storage_quota_mb  BIGINT DEFAULT 500,
  db_row_quota      BIGINT DEFAULT 50000,
  assigned_mongo_node  TEXT REFERENCES node_registry(node_code),
  assigned_pg_node     TEXT REFERENCES node_registry(node_code),
  assigned_r2_node     TEXT REFERENCES node_registry(node_code),
  revoke_reason   TEXT,
  stripe_customer_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Usage snapshots (written by server every hour)
CREATE TABLE IF NOT EXISTS usage_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT REFERENCES customers(id),
  db_mb       NUMERIC DEFAULT 0,
  files_mb    NUMERIC DEFAULT 0,
  api_calls   BIGINT DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_node_registry_type ON node_registry(node_type);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_usage_tenant ON usage_snapshots(tenant_id, recorded_at DESC);

-- RLS: only service_role can read/write (public access forbidden)
ALTER TABLE node_registry   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_snapshots  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON node_registry   USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON customers        USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only" ON usage_snapshots  USING (auth.role() = 'service_role');