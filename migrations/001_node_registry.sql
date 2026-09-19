-- ================================================================
-- Ananta DB Control Plane — Migration 001
-- Node registry and runtime status tracking
-- Run on: Supabase Acct 1-A (node-s1)
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Node Registry ─────────────────────────────────────────────────
-- Stores all backend node configurations (credentials encrypted AES-256-GCM)
CREATE TABLE IF NOT EXISTS node_registry (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT NOT NULL UNIQUE,    -- e.g. 'node-a1', 'node-n2'
  type          TEXT NOT NULL,           -- 'mongo' | 'pg' | 'r2' | 'redis'
  region        TEXT NOT NULL,           -- 'ap-south-1' | 'us-east-1' etc
  status        TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'READ_ONLY' | 'OFFLINE' | 'STANDBY'
  priority      INTEGER NOT NULL DEFAULT 1,     -- lower = higher priority for writes
  storage_bytes_used   BIGINT DEFAULT 0,
  storage_bytes_max    BIGINT DEFAULT 536870912, -- 512MB default
  connection_count     INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Runtime Status ────────────────────────────────────────────────
-- Time-series status snapshots for circuit breaker history
CREATE TABLE IF NOT EXISTS node_status_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_code     TEXT NOT NULL REFERENCES node_registry(code) ON DELETE CASCADE,
  status        TEXT NOT NULL,
  storage_bytes BIGINT,
  connection_count INTEGER,
  sampled_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Circuit Breaker Events ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circuit_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_code     TEXT NOT NULL,
  event_type    TEXT NOT NULL,  -- 'TRIPPED' | 'RECOVERED' | 'PROMOTED' | 'DEMOTED'
  from_status   TEXT,
  to_status     TEXT,
  reason        TEXT,
  occurred_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Pinger Heartbeat Log ─────────────────────────────────────────
-- Minimal heartbeat record: codenames only, no vendor info
CREATE TABLE IF NOT EXISTS heartbeat_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_code     TEXT NOT NULL,
  latency_ms    INTEGER,
  success       BOOLEAN NOT NULL,
  logged_at     TIMESTAMPTZ DEFAULT NOW()
);
-- Auto-cleanup heartbeat log older than 7 days
CREATE INDEX IF NOT EXISTS hb_logged_at_idx ON heartbeat_log (logged_at);

-- ── Seed initial nodes (UPDATE values after deployment) ──────────
-- These have no credentials — credentials live ONLY in Kavacha env
INSERT INTO node_registry (code, type, region, status, priority, storage_bytes_max) VALUES
  ('node-a1', 'mongo', 'ap-south-1', 'ACTIVE',    1, 536870912),
  ('node-a2', 'mongo', 'us-east-1',  'READ_ONLY',  2, 536870912),
  ('node-a3', 'mongo', 'eu-west-1',  'STANDBY',    3, 536870912),
  ('node-n1', 'pg',    'ap-south-1', 'ACTIVE',     1, 524288000),
  ('node-n2', 'pg',    'ap-south-1', 'ACTIVE',     2, 524288000),
  ('node-n3', 'pg',    'us-east-1',  'ACTIVE',     1, 524288000),
  ('node-s1', 'pg',    'ap-south-1', 'ACTIVE',     1, 536870912),
  ('node-s2', 'pg',    'ap-south-1', 'ACTIVE',     2, 536870912),
  ('node-r2a','r2',    'auto',       'ACTIVE',     1, 10737418240),
  ('node-r2b','r2',    'auto',       'ACTIVE',     2, 10737418240),
  ('node-r2c','r2',    'auto',       'STANDBY',    3, 10737418240),
  ('node-vk1','redis', 'ap-south-1', 'ACTIVE',     1, 536870912),
  ('node-vk2','redis', 'ap-south-1', 'ACTIVE',     2, 536870912)
ON CONFLICT (code) DO NOTHING;

-- ── RLS: Only service role can read/write ─────────────────────────
ALTER TABLE node_registry       ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeat_log       ENABLE ROW LEVEL SECURITY;

-- Service role bypass (Ananta server uses service role via Kavacha)
CREATE POLICY "service_role_all" ON node_registry       FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON node_status_history FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON circuit_events      FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON heartbeat_log       FOR ALL TO service_role USING (true);
