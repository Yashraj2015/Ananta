-- Migration 004: Flexible node assignment system
-- Replaces 3 separate assignment columns with one unified JSONB column
-- Also expands node_registry to support all provider types

-- ── 1. Add the new flexible column ──────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS assigned_nodes JSONB DEFAULT '{}';

-- ── 2. Migrate existing data into the new column ─────────────────────────────
UPDATE customers
SET assigned_nodes = (
  COALESCE(assigned_nodes, '{}')::jsonb
  || CASE WHEN assigned_mongo_node IS NOT NULL
     THEN jsonb_build_object('doc', assigned_mongo_node) ELSE '{}'::jsonb END
  || CASE WHEN assigned_pg_node IS NOT NULL
     THEN jsonb_build_object('pg', assigned_pg_node)  ELSE '{}'::jsonb END
  || CASE WHEN assigned_r2_node IS NOT NULL
     THEN jsonb_build_object('files', assigned_r2_node) ELSE '{}'::jsonb END
)
WHERE assigned_mongo_node IS NOT NULL
   OR assigned_pg_node    IS NOT NULL
   OR assigned_r2_node    IS NOT NULL;

-- ── 3. Add Razorpay billing columns ──────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_plan         TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS billing_cycle_end    TIMESTAMPTZ;

-- ── 4. Expand node_registry to handle all provider types ─────────────────────
-- Add a category column so we can query "give me a pg node" or "give me a vector node"
ALTER TABLE node_registry
  ADD COLUMN IF NOT EXISTS category TEXT GENERATED ALWAYS AS (
    CASE node_type
      WHEN 'neon'          THEN 'pg'
      WHEN 'supabase'      THEN 'pg'
      WHEN 'cockroach'     THEN 'pg'
      WHEN 'turso'         THEN 'pg'
      WHEN 'xata'          THEN 'pg'
      WHEN 'd1'            THEN 'pg'
      WHEN 'atlas'         THEN 'doc'
      WHEN 'firestore'     THEN 'doc'
      WHEN 'convex'        THEN 'doc'
      WHEN 'appwrite'      THEN 'doc'
      WHEN 'pinecone'      THEN 'vector'
      WHEN 'qdrant'        THEN 'vector'
      WHEN 'weaviate'      THEN 'vector'
      WHEN 'upstash-vector' THEN 'vector'
      WHEN 'upstash-redis' THEN 'cache'
      WHEN 'valkey'        THEN 'cache'
      WHEN 'r2'            THEN 'files'
      WHEN 's3'            THEN 'files'
      WHEN 'do-spaces'     THEN 'files'
      WHEN 'ctrl-plane'    THEN 'ctrl'
      ELSE 'other'
    END
  ) STORED;

-- ── 5. Add tenant_count to node_registry for load balancing ──────────────────
ALTER TABLE node_registry
  ADD COLUMN IF NOT EXISTS tenant_count INTEGER DEFAULT 0;

-- Update tenant_count from current assignments
UPDATE node_registry nr SET tenant_count = (
  SELECT COUNT(*) FROM customers c
  WHERE c.assigned_nodes->'pg'     = to_jsonb(nr.node_code)
     OR c.assigned_nodes->'doc'    = to_jsonb(nr.node_code)
     OR c.assigned_nodes->'vector' = to_jsonb(nr.node_code)
     OR c.assigned_nodes->'cache'  = to_jsonb(nr.node_code)
     OR c.assigned_nodes->'files'  = to_jsonb(nr.node_code)
);

-- ── 6. Audit log table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  email       TEXT,
  action      TEXT NOT NULL,   -- 'login', 'token_created', 'token_revoked', 'profile_updated', 'plan_upgraded'
  metadata    JSONB DEFAULT '{}',
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_customer_id_idx ON audit_log (customer_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx  ON audit_log (created_at DESC);

COMMENT ON TABLE audit_log IS 'Immutable audit trail of user actions';

-- NOTE: We intentionally keep the old columns (assigned_mongo_node etc.)
-- for backward compat. They can be dropped in migration 005 once all
-- server code has been updated to use assigned_nodes.
