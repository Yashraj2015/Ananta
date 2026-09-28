const fs = require('fs');

const code = `
import { NextApiRequest, NextApiResponse } from 'next'
import { apiWrapper } from '@/lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: false })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const key = req.query.key || ''
    const query = req.body.query || ''
    
    if (key.startsWith('schemas') || query.includes('pg_namespace')) {
      return res.status(200).json([{ id: 1, name: 'public', owner: 'postgres' }])
    }
    
    const universalMockObject = {
      data: {
        entities: [],
        functions: [],
        tables: [],
        count: 0
      },
      grant_count: 3,
      total_count: 0,
      grants_count: 0,
      db_size_bytes: 1048576,
      wal_size_bytes: 1048576,
    }
    
    if (
      key.startsWith('entity-types') ||
      key.startsWith('default-privileges-state') ||
      key.startsWith('exposed-function-counts') ||
      key.startsWith('exposed-table-counts') ||
      key.startsWith('exposed-functions') ||
      key.startsWith('exposed-tables') ||
      query.includes('pg_ls_waldir')
    ) {
      return res.status(200).json([universalMockObject])
    }
    
    return res.status(200).json([])
  }
  
  res.setHeader('Allow', ['POST'])
  res.status(405).json({ error: { message: 'Method Not Allowed' } })
}
`

fs.writeFileSync('supabase/apps/studio/pages/api/platform/pg-meta/[ref]/query/index.ts', code);