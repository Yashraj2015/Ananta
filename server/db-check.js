const {Pool}=require('pg');
const p=new Pool({connectionString:'postgresql://postgres.zmegrjxbpsyvdtuhhvet:Supabase_Yashraj2010@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',ssl:{rejectUnauthorized:false}});
Promise.all([
  p.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename='customers'"),
  p.query("SELECT COUNT(*) FROM customers"),
  p.query("SELECT id, email, name, role, provider, created_at FROM customers LIMIT 10")
]).then(([idx, cnt, rows]) => {
  console.log('=== INDEXES ===');
  idx.rows.forEach(x=>console.log(JSON.stringify(x)));
  console.log('=== COUNT ===', cnt.rows[0].count);
  console.log('=== ROWS ===');
  rows.rows.forEach(x=>console.log(JSON.stringify(x)));
  p.end();
}).catch(e=>{console.error(e.message, e.code); p.end();});
