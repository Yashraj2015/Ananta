-- ================================================================
-- Ananta DB Control Plane — Migration 002
-- Customer accounts, billing, and project assignments
-- Run on: Supabase Acct 1-B (node-s2)
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Customer Accounts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT NOT NULL UNIQUE,
  plan            TEXT NOT NULL DEFAULT 'FREE',   -- 'FREE'|'STARTER'|'PRO'|'SCALE'|'ENTERPRISE'
  stripe_customer_id TEXT,
  storage_quota_bytes BIGINT DEFAULT 524288000,   -- 500MB free
  api_key_hash    TEXT,                           -- bcrypt hash of API key
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Customer Projects ─────────────────────────────────────────────
-- Each customer can have multiple projects. Each project maps to a Neon schema.
CREATE TABLE IF NOT EXISTS customer_projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  project_name    TEXT NOT NULL,
  tenant_id       TEXT NOT NULL UNIQUE,           -- used in JWT sub and schema name
  neon_node_code  TEXT NOT NULL,                  -- which Neon node hosts this project
  schema_name     TEXT NOT NULL,                  -- ananta_proj_{tenant_id}
  status          TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE'|'SUSPENDED'|'DELETED'
  region          TEXT NOT NULL DEFAULT 'ap-south-1',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usage Metrics ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       TEXT NOT NULL,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  db_reads        BIGINT DEFAULT 0,
  db_writes       BIGINT DEFAULT 0,
  storage_bytes   BIGINT DEFAULT 0,
  api_calls       BIGINT DEFAULT 0,
  file_uploads    INTEGER DEFAULT 0,
  file_bandwidth  BIGINT DEFAULT 0,
  recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Billing Records ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  period          TEXT NOT NULL,                  -- '2026-09'
  amount_cents    INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING'|'PAID'|'FAILED'
  stripe_invoice_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Quota Alerts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quota_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       TEXT NOT NULL,
  alert_type      TEXT NOT NULL,   -- 'STORAGE_80'|'STORAGE_95'|'API_80'|'API_95'
  alerted_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

-- ── Seed a test customer ──────────────────────────────────────────
INSERT INTO customers (email, plan, storage_quota_bytes) VALUES
  ('admin@ananta.io', 'ENTERPRISE', 107374182400)  -- 100GB for internal use
ON CONFLICT (email) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_alerts       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON customers         FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON customer_projects FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON usage_metrics     FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON billing_records   FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON quota_alerts      FOR ALL TO service_role USING (true);
