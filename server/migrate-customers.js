const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.zmegrjxbpsyvdtuhhvet:Supabase_Yashraj2010@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
const stmts = [
  'ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_sub TEXT',
  'ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar TEXT',
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'google'",
  "ALTER TABLE customers ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'",
  'ALTER TABLE customers ADD COLUMN IF NOT EXISTS name TEXT',
  'CREATE UNIQUE INDEX IF NOT EXISTS customers_email_idx ON customers(email)',
];
(async () => {
  for (const s of stmts) {
    try { await pool.query(s); console.log('OK:', s.substring(0,60)); }
    catch(e) { console.log('SKIP:', e.message.substring(0,80)); }
  }
  await pool.end();
  console.log('Migration done');
})();