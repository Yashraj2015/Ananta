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
    
    // Exact schema response
    if (key === 'schemas' || query.includes('pg_namespace')) {
      return res.status(200).json([{ id: 1, name: 'public', owner: 'postgres' }])
    }
    
    // Universal mock object for everything else that might expect result[0] properties
    // This covers disk-breakdown, entity-types, exposed-functions, exposed-tables, default-privileges, etc.
    const universalMockObject = {
      // entity-types & exposed-functions & exposed-tables
      data: {
        entities: [],
        functions: [],
        tables: [],
        count: 0
      },
      // default-privileges
      grant_count: 3,
      // exposed-function-counts & exposed-table-counts
      total_count: 0,
      grants_count: 0,
      // disk-breakdown
      db_size_bytes: 1048576,
      wal_size_bytes: 1048576,
    }
    
    // Most other queries expect an array of results. We can return an array with one universal mock object.
    // If they expect an empty array, returning an array with one object might cause issues if they map over it,
    // but the keys check should cover the most common issues.
    
    if (
      key === 'entity-types' ||
      key === 'default-privileges-state' ||
      key === 'exposed-function-counts' ||
      key === 'exposed-table-counts' ||
      key === 'exposed-functions' ||
      key === 'exposed-tables' ||
      query.includes('pg_ls_waldir')
    ) {
      return res.status(200).json([universalMockObject])
    }
    
    // For tables, views, vault-secrets, etc. that expect arrays of items, return []
    return res.status(200).json([])
  }
  
  res.setHeader('Allow', ['POST'])
  res.status(405).json({ error: { message: 'Method Not Allowed' } })
}
`

fs.writeFileSync('supabase/apps/studio/pages/api/platform/pg-meta/[ref]/query/index.ts', code);