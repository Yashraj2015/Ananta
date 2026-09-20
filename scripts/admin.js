#!/usr/bin/env node
/**
 * scripts/admin.js — Ananta DB Admin CLI
 *
 * Usage:
 *   node scripts/admin.js add-account  --name "Acme Corp" --email admin@acme.com --plan pro
 *   node scripts/admin.js list-accounts
 *   node scripts/admin.js set-plan     --tenant TENANT_ID --plan enterprise
 *   node scripts/admin.js set-quota    --tenant TENANT_ID --storage-mb 10240 --db-rows 1000000
 *   node scripts/admin.js revoke       --tenant TENANT_ID --reason "payment_failure"
 *   node scripts/admin.js nodes        (list all registered nodes and their status)
 *   node scripts/admin.js add-node     --code node-a4 --type atlas --uri mongodb+srv://...
 */
'use strict';
require('dotenv').config({ path: __dirname + '/../server/.env' });

const crypto = require('crypto');
const https  = require('https');

const CTRL_PLANE_URL = process.env.CTRL_PLANE_URL;
const CTRL_PLANE_KEY = process.env.CTRL_PLANE_KEY;

const PLANS = {
  free:       { storageMb: 500,   dbRows: 50_000,    priceUsd: 0   },
  starter:    { storageMb: 5120,  dbRows: 500_000,   priceUsd: 10  },
  pro:        { storageMb: 51200, dbRows: 5_000_000, priceUsd: 49  },
  enterprise: { storageMb: -1,    dbRows: -1,         priceUsd: -1  }, // custom
};

// Helper: call Supabase REST (ctrl-plane) without knowing it's Supabase
async function ctrlRequest(method, path, body) {
  if (!CTRL_PLANE_URL || !CTRL_PLANE_KEY) {
    throw new Error('CTRL_PLANE_URL and CTRL_PLANE_KEY must be set in server/.env');
  }
  const url = new URL(CTRL_PLANE_URL + '/rest/v1' + path);
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey':          CTRL_PLANE_KEY,
        'Authorization':   'Bearer ' + CTRL_PLANE_KEY,
        'Content-Type':    'application/json',
        'Prefer':          'return=representation',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const args = process.argv.slice(2);
const cmd  = args[0];

function getArg(name) {
  const idx = args.indexOf('--' + name);
  return idx !== -1 ? args[idx + 1] : null;
}

async function main() {
  if (!cmd || cmd === 'help') {
    console.log(`
  ⬡  Ananta DB Admin CLI
  ──────────────────────────────────────────
  add-account  --name <name> --email <email> --plan <free|starter|pro|enterprise>
  list-accounts
  set-plan     --tenant <id> --plan <plan>
  set-quota    --tenant <id> --storage-mb <n> --db-rows <n>
  revoke       --tenant <id> --reason <reason>
  nodes        (list all nodes)
  add-node     --code <node-code> --type <atlas|pg-neon|r2|redis> --uri <uri>
  `);
    return;
  }

  if (cmd === 'add-account') {
    const name   = getArg('name')  || 'Unnamed';
    const email  = getArg('email') || 'admin@example.com';
    const plan   = getArg('plan')  || 'free';
    const quota  = PLANS[plan] || PLANS.free;
    const tenantId = 'tenant_' + crypto.randomBytes(8).toString('hex');

    console.log('\nCreating account...');
    const { status, data } = await ctrlRequest('POST', '/customers', {
      id: tenantId, name, email, plan,
      storage_quota_mb: quota.storageMb,
      db_row_quota: quota.dbRows,
      status: 'active'
    });
    if (status >= 300) { console.error('Error:', data); process.exit(1); }
    console.log('\n✅ Account created:');
    console.log('   Tenant ID:', tenantId);
    console.log('   Name:     ', name);
    console.log('   Plan:     ', plan);
    console.log('   Storage:  ', quota.storageMb === -1 ? 'custom' : quota.storageMb + ' MB');
    console.log('   DB Rows:  ', quota.dbRows === -1 ? 'custom' : quota.dbRows.toLocaleString());
    console.log('\n   Connection string:');
    console.log('   mongodb://TENANT_CONN_STRING@dave.db.ananta.io:27017/' + tenantId);
    return;
  }

  if (cmd === 'list-accounts') {
    const { status, data } = await ctrlRequest('GET', '/customers?select=id,name,email,plan,status,created_at&order=created_at.desc&limit=50');
    if (status >= 300) { console.error('Error:', data); process.exit(1); }
    if (!data?.length) { console.log('No accounts found.'); return; }
    console.log('\n  Tenant ID                        Name               Email                   Plan       Status');
    console.log('  ' + '-'.repeat(100));
    for (const c of data) {
      console.log('  ' + (c.id || '').padEnd(33) + (c.name || '').padEnd(19) + (c.email || '').padEnd(24) + (c.plan || '').padEnd(11) + (c.status || ''));
    }
    return;
  }

  if (cmd === 'set-plan') {
    const tenantId = getArg('tenant');
    const plan     = getArg('plan');
    if (!tenantId || !plan || !PLANS[plan]) { console.error('--tenant and --plan required (free|starter|pro|enterprise)'); process.exit(1); }
    const quota = PLANS[plan];
    const { status } = await ctrlRequest('PATCH', '/customers?id=eq.' + tenantId, {
      plan, storage_quota_mb: quota.storageMb, db_row_quota: quota.dbRows
    });
    if (status >= 300) process.exit(1);
    console.log('✅ Plan updated:', tenantId, '->', plan);
    return;
  }

  if (cmd === 'revoke') {
    const tenantId = getArg('tenant');
    const reason   = getArg('reason') || 'admin_revoke';
    if (!tenantId) { console.error('--tenant required'); process.exit(1); }
    const { status } = await ctrlRequest('PATCH', '/customers?id=eq.' + tenantId, { status: 'suspended', revoke_reason: reason });
    if (status >= 300) process.exit(1);
    console.log('✅ Account suspended:', tenantId, '| Reason:', reason);
    return;
  }

  if (cmd === 'nodes') {
    const { status, data } = await ctrlRequest('GET', '/node_registry?select=node_code,node_type,status,region,last_heartbeat&order=node_code');
    if (status >= 300) { console.error('Error:', data); process.exit(1); }
    if (!data?.length) { console.log('No nodes registered.'); return; }
    console.log('\n  Code          Type         Status      Region         Last Heartbeat');
    console.log('  ' + '-'.repeat(80));
    for (const n of data) {
      const hb = n.last_heartbeat ? new Date(n.last_heartbeat).toLocaleString() : 'never';
      console.log('  ' + (n.node_code||'').padEnd(14) + (n.node_type||'').padEnd(13) + (n.status||'').padEnd(12) + (n.region||'').padEnd(15) + hb);
    }
    return;
  }

  if (cmd === 'add-node') {
    const code = getArg('code'); const type = getArg('type'); const uri = getArg('uri');
    if (!code || !type) { console.error('--code and --type required'); process.exit(1); }
    const { status, data } = await ctrlRequest('POST', '/node_registry', { node_code: code, node_type: type, status: 'STANDBY', region: getArg('region') || 'auto' });
    if (status >= 300) { console.error('Error:', data); process.exit(1); }
    console.log('✅ Node registered:', code, '| Type:', type);
    if (uri) console.log('   Add to kavacha/.env:  NODE_' + code.replace('node-','').toUpperCase().replace('-','_') + '_URI=' + uri);
    return;
  }

  console.error('Unknown command:', cmd, '— run: node scripts/admin.js help');
  process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
