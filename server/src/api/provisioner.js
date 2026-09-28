'use strict';
/**
 * Tenant Provisioner
 * ──────────────────
 * Called after every user login (idempotent — skips if already fully provisioned).
 * Picks the least-loaded active node in each category from node_registry and
 * writes the assignment into customers.assigned_nodes (JSONB).
 *
 * Categories:
 *   pg      — Relational/SQL  (neon, supabase, cockroach, turso, xata, d1)
 *   doc     — Document/NoSQL  (atlas, firestore, convex, appwrite)
 *   vector  — Vector DB       (pinecone, qdrant, weaviate, upstash-vector)
 *   cache   — Cache/KV        (upstash-redis, valkey)
 *   files   — Object storage  (r2, s3, do-spaces)
 */
const { Pool } = require('pg');

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  _pool = new Pool({
    connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return _pool;
}

/**
 * Pick the least-loaded active node in a given category.
 * Uses tenant_count for load balancing — the node with fewest tenants wins.
 * Returns { node_code, node_type } or null.
 */
async function pickNode(category) {
  try {
    const { rows } = await getPool().query(
      `SELECT node_code, node_type
       FROM node_registry
       WHERE category = $1
         AND status   = 'ACTIVE'
       ORDER BY tenant_count ASC NULLS LAST, last_heartbeat DESC NULLS LAST
       LIMIT 1`,
      [category]
    );
    return rows[0] ?? null;
  } catch (err) {
    console.warn(`[provision] pickNode(${category}) failed:`, err.message);
    return null;
  }
}

/**
 * Increment tenant_count on a node after assignment.
 */
async function incrementTenantCount(nodeCode) {
  try {
    await getPool().query(
      `UPDATE node_registry SET tenant_count = COALESCE(tenant_count, 0) + 1
       WHERE node_code = $1`,
      [nodeCode]
    );
  } catch {}
}

/**
 * Write an audit log entry.
 */
async function writeAuditLog(email, action, metadata = {}) {
  try {
    await getPool().query(
      `INSERT INTO audit_log (customer_id, email, action, metadata)
       SELECT id, $1, $2, $3 FROM customers WHERE email = $1`,
      [email, action, JSON.stringify(metadata)]
    );
  } catch {}
}

/**
 * Main entrypoint.
 * Provisions a tenant by assigning nodes in all available categories.
 * Safe to call multiple times — skips categories already assigned.
 */
async function provisionTenant(email) {
  const p = getPool();
  try {
    // Fetch current state
    const { rows } = await p.query(
      `SELECT id, assigned_nodes FROM customers WHERE email = $1`,
      [email]
    );
    if (!rows.length) return null;

    const existing   = rows[0].assigned_nodes || {};
    const newAssigned = { ...existing };
    const assigned   = [];

    // Provision each category (skip if already assigned)
    const CATEGORIES = ['pg', 'doc', 'vector', 'cache', 'files'];
    await Promise.all(CATEGORIES.map(async (cat) => {
      if (newAssigned[cat]) return; // already set
      const node = await pickNode(cat);
      if (!node) return;
      newAssigned[cat] = node.node_code;
      assigned.push({ cat, code: node.node_code, type: node.node_type });
    }));

    // Only write to DB if something actually changed
    if (assigned.length > 0) {
      await p.query(
        `UPDATE customers SET assigned_nodes = $1, updated_at = NOW() WHERE email = $2`,
        [JSON.stringify(newAssigned), email]
      );
      // Increment tenant_count for each newly assigned node
      await Promise.all(assigned.map(n => incrementTenantCount(n.code)));

      console.log(
        `[provision] ${email} → assigned: ` +
        assigned.map(n => `${n.cat}:${n.code}(${n.type})`).join(', ')
      );
    }

    // Log the login event (always)
    await writeAuditLog(email, 'login', {
      assigned_nodes: newAssigned,
      newly_provisioned: assigned.map(n => n.cat),
    });

    return { assigned: newAssigned, newly: assigned };
  } catch (err) {
    console.error('[provision] error for', email, '—', err.message);
    return null;
  }
}

module.exports = { provisionTenant, writeAuditLog };
