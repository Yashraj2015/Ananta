const fs = require('fs');

const projectsCode = `
import { NextApiRequest, NextApiResponse } from 'next'
import { apiWrapper } from '@/lib/api/apiWrapper'
import { DEFAULT_PROJECT } from '@/lib/constants/api'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({
      projects: [DEFAULT_PROJECT],
      pagination: {
        count: 1,
        offset: 0,
        limit: 100,
        total: 1
      }
    })
  }
  res.setHeader('Allow', ['GET'])
  res.status(405).json({ data: null, error: { message: 'Method Not Allowed' } })
}
`;

const membersCode = `
import { NextApiRequest, NextApiResponse } from 'next'
import { apiWrapper } from '@/lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json([])
  }
  res.setHeader('Allow', ['GET'])
  res.status(405).json({ data: null, error: { message: 'Method Not Allowed' } })
}
`;

const limitCode = `
import { NextApiRequest, NextApiResponse } from 'next'
import { apiWrapper } from '@/lib/api/apiWrapper'

export default (req: NextApiRequest, res: NextApiResponse) => apiWrapper(req, res, handler)

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json(false)
  }
  res.setHeader('Allow', ['GET'])
  res.status(405).json({ data: null, error: { message: 'Method Not Allowed' } })
}
`;

fs.writeFileSync('supabase/apps/studio/pages/api/platform/organizations/[slug]/projects.ts', projectsCode);
fs.writeFileSync('supabase/apps/studio/pages/api/platform/organizations/[slug]/members.ts', membersCode);
fs.writeFileSync('supabase/apps/studio/pages/api/platform/organizations/[slug]/roles.ts', membersCode);
fs.writeFileSync('supabase/apps/studio/pages/api/platform/organizations/[slug]/members/invitations.ts', membersCode);
fs.writeFileSync('supabase/apps/studio/pages/api/platform/organizations/[slug]/members/reached-free-project-limit.ts', limitCode);