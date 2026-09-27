import fs from 'fs'

const file = 'd:\\Smars\\Smars\\Ananta\\supabase\\apps\\studio\\pages\\admin\\index.tsx'
let content = fs.readFileSync(file, 'utf8')

// Fix missing imports for Recharts and useState
if (!content.includes('import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"')) {
  content = content.replace(
    /import Head from 'next\/head'/,
    "import Head from 'next/head'\nimport { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'\nimport { useState } from 'react'"
  )
}

// Generate dummy data for graph
const dummyGraphData = `
const MOCK_ANALYTICS = [
  { time: '00:00', requests: 120 },
  { time: '04:00', requests: 300 },
  { time: '08:00', requests: 850 },
  { time: '12:00', requests: 1400 },
  { time: '16:00', requests: 1100 },
  { time: '20:00', requests: 750 },
  { time: '24:00', requests: 350 },
]
`
if (!content.includes('const MOCK_ANALYTICS')) {
  content = content.replace('// --- Components ---', dummyGraphData + '\n// --- Components ---')
}

// Fix profile images (there are 3 in the file)
// 1. Top nav
content = content.replace(
  /\{user\.avatar && <img src=\{user\.avatar\} className="w-7 h-7 rounded-full border" alt="" \/>\}/g,
  `{user.avatar ? <img src={user.avatar} className="w-7 h-7 rounded-full border object-cover" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }} /> : null}<div className={cn("w-7 h-7 rounded-full bg-brand/20 items-center justify-center text-brand text-[10px] font-bold", user.avatar ? "hidden flex" : "flex")}>{user.email[0].toUpperCase()}</div>`
)

// 2. Sidebar bottom
content = content.replace(
  /\{user\.avatar\s*\?\s*<img src=\{user\.avatar\} className="w-6 h-6 rounded-full" alt="" \/>\s*:\s*<div className="w-6 h-6 rounded-full bg-brand\/20 flex items-center justify-center text-brand text-\[10px\] font-bold">\{user\.email\[0\]\.toUpperCase\(\)\}<\/div>\s*\}/g,
  `{user.avatar ? <img src={user.avatar} className="w-6 h-6 rounded-full object-cover" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }} /> : null}<div className={cn("w-6 h-6 rounded-full bg-brand/20 items-center justify-center text-brand text-[10px] font-bold", user.avatar ? "hidden flex" : "flex")}>{user.email[0].toUpperCase()}</div>`
)

// 3. Welcome section in OverviewTab
content = content.replace(
  /\{user\.avatar && <img src=\{user\.avatar\} className="w-10 h-10 rounded-full border" alt="" \/>\}/g,
  `{user.avatar ? <img src={user.avatar} className="w-10 h-10 rounded-full border object-cover" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }} /> : null}<div className={cn("w-10 h-10 rounded-full bg-brand/20 items-center justify-center text-brand text-sm font-bold", user.avatar ? "hidden flex" : "flex")}>{user.email[0].toUpperCase()}</div>`
)

// Fix StatCard values getting corrupted (replace em dashes or weird chars with just '0')
content = content.replace(/value=\{stats\?\.total_customers \?\? '.*?'\}/g, "value={stats?.total_customers ?? '0'}")
content = content.replace(/value=\{stats\?\.total_requests_today \?\? '.*?'\}/g, "value={stats?.total_requests_today ?? '0'}")

// Replace any leftover corrupted chars manually in the whole file
content = content.replace(/[^\x00-\x7F]/g, ''); // Nuke all non-ascii

// Add the Graph into OverviewTab
const graphJsx = `
        {/* Analytics Graph */}
        <div className="rounded-lg border bg-surface-100 p-5 mt-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Traffic Overview (24h)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_ANALYTICS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#24b47e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#24b47e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border-muted))" />
                <XAxis dataKey="time" stroke="hsl(var(--foreground-muted))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--foreground-muted))" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#24b47e" strokeWidth={2} fillOpacity={1} fill="url(#colorRequests)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
`
if (!content.includes('Traffic Overview (24h)')) {
  content = content.replace(
    /\{\/\* Node health summary \*\/\}/,
    graphJsx + '\n\n        {/* Node health summary */}'
  )
}

fs.writeFileSync(file, content, 'utf8')
console.log('Fixed admin/index.tsx')
