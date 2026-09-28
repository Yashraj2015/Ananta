const fs = require('fs');

const code = `
import { NextApiRequest, NextApiResponse } from 'next'
import { apiWrapper } from '@/lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) =>
  apiWrapper(req, res, handler, { withAuth: false })

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const key = req.query.key || ''
    
    if (key === 'schemas') {
      return res.status(200).json([{ id: 1, name: 'public', owner: 'postgres' }])
    }
    
    return res.status(200).json([])
  }
  
  res.setHeader('Allow', ['POST'])
  res.status(405).json({ error: { message: 'Method Not Allowed' } })
}
`

fs.writeFileSync('supabase/apps/studio/pages/api/platform/pg-meta/[ref]/query/index.ts', code);