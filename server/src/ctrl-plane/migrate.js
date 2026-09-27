const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Try poolers in order
const URIS = [
  'postgresql://postgres.zmegrjxbpsyvdtuhhvet:Supabase_Yashraj2010@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.zmegrjxbpsyvdtuhhvet:Supabase_Yashraj2010@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
];

async function tryConnect() {
  for (const uri of URIS) {
    const client = new Client({ connectionString: uri, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
    try {
      await client.connect();
      console.log('Connected via:', uri.split('@')[1]);
      return client;
    } catch(e) {
      console.log('Failed:', uri.split('@')[1], '-', e.message);
      await client.end().catch(() => {});
    }
  }
  throw new Error('All connection URIs failed');
}

async function run() {
  const client = await tryConnect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../../../migrations/003_nodes_credentials.sql'), 'utf8');
    // Split on ; and run each statement separately (pooler doesn't support multi-statement well)
    const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 5 && !s.startsWith('--'));
    for (const stmt of stmts) {
      try {
        await client.query(stmt);
        process.stdout.write('.');
      } catch(e) {
        if (e.message.includes('already exists') || e.message.includes('duplicate')) {
          process.stdout.write('s'); // skipped
        } else {
          console.log('\nWarn:', stmt.slice(0,60), '->', e.message);
        }
      }
    }
    console.log('\nStatements done.');

    const { rows } = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('node_registry','customers','usage_snapshots') ORDER BY tablename`);
    console.log('Tables:', rows.map(r => r.tablename).join(', ') || '(none yet - might need schema setup)');
  } finally {
    await client.end();
  }
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });