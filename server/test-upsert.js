const {Pool}=require('pg');
const crypto=require('crypto');
const p=new Pool({connectionString:'postgresql://postgres.zmegrjxbpsyvdtuhhvet:Supabase_Yashraj2010@aws-0-ap-south-1.pooler.supabase.com:6543/postgres',ssl:{rejectUnauthorized:false}});

const email='test@ananta.io', name='Test User', avatar=null, googleSub='test-sub-123', role='admin';
const newId=crypto.randomUUID();

p.query(`
  INSERT INTO customers (id, email, name, avatar, google_sub, provider, role, plan, status, created_at, updated_at)
  VALUES ($6, $1, $2, $3, $4, 'google', $5, 'free', 'active', NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET
    name=EXCLUDED.name, avatar=EXCLUDED.avatar, google_sub=EXCLUDED.google_sub,
    role=CASE WHEN customers.role='admin' THEN 'admin' ELSE EXCLUDED.role END,
    updated_at=NOW()
`, [email, name, avatar, googleSub, role, newId])
.then(()=>{ console.log('INSERT OK'); return p.query('SELECT * FROM customers WHERE email=$1',[email]); })
.then(r=>{ console.log('ROW:', JSON.stringify(r.rows[0])); p.end(); })
.catch(e=>{ console.error('ERROR:', e.message, '\nDETAIL:', e.detail, '\nCODE:', e.code); p.end(); });
