const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://postgres.zmegrjxbpsyvdtuhhvet:Supabase_Yashraj2010@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', ssl:{rejectUnauthorized:false} });
p.query('SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position', ['customers'])
  .then(r => { r.rows.forEach(row => console.log(JSON.stringify(row))); p.end(); })
  .catch(e => { console.error(e.message); p.end(); });
