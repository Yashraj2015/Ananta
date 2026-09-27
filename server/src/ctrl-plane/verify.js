const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.zmegrjxbpsyvdtuhhvet:Supabase_Yashraj2010@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
async function run() {
  await client.connect();
  // Test insert into node_registry
  await client.query(`
    INSERT INTO node_registry (node_code, node_type, label, region, status)
    VALUES ('node-s1', 'ctrl-plane', 'Ctrl-Plane (Supabase) - ap-south-1', 'ap-south-1', 'ACTIVE')
    ON CONFLICT (node_code) DO UPDATE SET status='ACTIVE', updated_at=NOW()
  `);
  console.log('node-s1 upserted into node_registry');
  const { rows } = await client.query('SELECT node_code, node_type, status FROM node_registry');
  console.log('Nodes:', JSON.stringify(rows));
  await client.end();
}
run().catch(e => console.error(e.message));