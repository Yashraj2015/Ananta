require('dotenv').config({path:'.env'});
const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.CTRL_PLANE_POOLER_URL,ssl:{rejectUnauthorized:false},max:2});
const id=require('crypto').randomUUID();
const sql=`INSERT INTO customers (id,email,name,avatar,google_sub,provider,role,plan,status,created_at,updated_at)
VALUES ($6,$1,$2,$3,$4,'google',$5,'free','active',NOW(),NOW())
ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name,updated_at=NOW()
RETURNING email,role`;
p.query(sql,['live-test@ananta.io','Live Test',null,null,'user',id])
.then(r=>{console.log('OK',JSON.stringify(r.rows));p.end();})
.catch(e=>{console.error('FAIL',e.message,e.code);p.end();});
