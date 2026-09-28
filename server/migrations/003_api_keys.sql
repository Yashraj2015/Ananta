-- Migration 003: API Keys table for tenant access tokens
-- Run once: node migrate.js

CREATE TABLE IF NOT EXISTS api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL UNIQUE,     -- SHA-256 hash of the actual key (never store plain)
  key_prefix  TEXT NOT NULL,            -- e.g. "ant_live_AbCd..." shown in UI
  scopes      TEXT[] DEFAULT '{read,write}',
  last_used   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,              -- NULL = no expiry
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_customer_id_idx ON api_keys (customer_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);

COMMENT ON TABLE api_keys IS 'Tenant API keys — key stored as SHA-256 hash only';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256(raw_key) — used for lookup during API auth';
COMMENT ON COLUMN api_keys.key_prefix IS 'First ~17 chars of the raw key shown in UI for identification';
