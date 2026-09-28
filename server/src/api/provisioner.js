'use strict';
/**
 * Tenant Provisioner
 * Called after a new user signs in for the first time.
 * Picks the least-loaded nodes from node_registry and assigns them to the customer.
 */
const { Pool } = require('pg');

let pool = null;
function getPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

/**
 * Pick least-loaded active node of a given type from node_registry.
 * Returns node_code or null if none available.
 */
async function pickNode(type) {
  try {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT node_code FROM node_registry
       WHERE node_type = $1 AND status = 'active'
       ORDER BY last_heartbeat DESC NULLS LAST
       LIMIT 1`,
      [type]
    );
    return rows[0]?.node_code ?? null;
  } catch { return null; }
}

/**
 * Provision a new tenant:
 *  1. Pick best available mongo, pg, r2 nodes
 *  2. Write assignment back to customers table
 *  3. Return the assigned nodes (or null if unavailable)
 *
 * Safe to call multiple times — skips if already provisioned.
 */
async function provisionTenant(email) {
  try {
    const p = getPool();

    // Check if already provisioned
    const { rows } = await p.query(
      'SELECT assigned_mongo_node, assigned_pg_node FROM customers WHERE email = $1',
      [email]
    );
    if (!rows.length) return null;
    if (rows[0].assigned_mongo_node || rows[0].assigned_pg_node) {
      return { alreadyProvisioned: true };
    }

    // Pick nodes (these may be null if no nodes registered yet)
    const [mongoNode, pgNode, r2Node] = await Promise.all([
      pickNode('atlas'),
      pickNode('pg-neon'),
      pickNode('r2'),
    ]);

    // Write assignment (only set non-null values)
    const updates = {};
    if (mongoNode) updates.assigned_mongo_node = mongoNode;
    if (pgNode)    updates.assigned_pg_node    = pgNode;
    if (r2Node)    updates.assigned_r2_node    = r2Node;

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = [email, ...Object.values(updates)];
      await p.query(
        `UPDATE customers SET ${setClauses}, updated_at = NOW() WHERE email = $1`,
        values
      );
    }

    console.log(`[provision] tenant ${email} assigned: mongo=${mongoNode}, pg=${pgNode}, r2=${r2Node}`);
    return { mongoNode, pgNode, r2Node };
  } catch (err) {
    console.error('[provision] error for', email, err.message);
    return null;
  }
}

module.exports = { provisionTenant };
