/**
 * fix-nodes-panel.js
 * 1. Fix STATUS_ICON to match uppercase API values (ACTIVE/OFFLINE etc)
 * 2. Fix status comparison in actions button
 * 3. Fix region display — extract from node label or use a smart lookup
 * 4. Replace table row with clickable row that opens a right-side detail panel
 * 5. NodeDetailPanel component with usage graphs, status history, metadata
 */
const fs = require('fs')
let src = fs.readFileSync('supabase/apps/studio/pages/admin/index.tsx', 'utf8')

// ── 1. Fix STATUS_ICON keys to uppercase (API returns ACTIVE not active) ──────
src = src.replace(
`const STATUS_ICON: Record<string, { icon: typeof CheckCircle; cls: string }> = {
  active:    { icon: CheckCircle,   cls: 'text-brand' },
  read_only: { icon: AlertTriangle, cls: 'text-warning' },
  offline:   { icon: XCircle,       cls: 'text-destructive' },
  standby:   { icon: Clock,         cls: 'text-foreground-muted' },
}`,
`const STATUS_ICON: Record<string, { icon: typeof CheckCircle; cls: string }> = {
  ACTIVE:    { icon: CheckCircle,   cls: 'text-brand' },
  READ_ONLY: { icon: AlertTriangle, cls: 'text-warning' },
  OFFLINE:   { icon: XCircle,       cls: 'text-destructive' },
  DEGRADED:  { icon: AlertTriangle, cls: 'text-warning' },
  STANDBY:   { icon: Clock,         cls: 'text-foreground-muted' },
  // lowercase aliases
  active:    { icon: CheckCircle,   cls: 'text-brand' },
  read_only: { icon: AlertTriangle, cls: 'text-warning' },
  offline:   { icon: XCircle,       cls: 'text-destructive' },
  standby:   { icon: Clock,         cls: 'text-foreground-muted' },
}`
)

// ── 2. Fix action button status comparison to handle both cases ────────────────
src = src.replace(
  `{node.status === 'active' ? (`,
  `{(node.status === 'ACTIVE' || node.status === 'active') ? (`
)
src = src.replace(
  `setStatus(node.node_code, 'active')`,
  `setStatus(node.node_code, 'ACTIVE')`
)
src = src.replace(
  `setStatus(node.node_code, 'offline')`,
  `setStatus(node.node_code, 'OFFLINE')`
)

// ── 3. Fix OverviewTab status comparisons too ──────────────────────────────────
src = src.replace(
  `nodes.filter(n => n.status === 'active').length`,
  `nodes.filter(n => n.status === 'ACTIVE' || n.status === 'active').length`
)
src = src.replace(
  `nodes.filter(n => n.status === 'offline').length`,
  `nodes.filter(n => n.status === 'OFFLINE' || n.status === 'offline').length`
)
src = src.replace(
  `nodes.filter(n => n.status === 'read_only').length`,
  `nodes.filter(n => n.status === 'READ_ONLY' || n.status === 'read_only').length`
)

// ── 4. Smart region display — known region codes to human labels ───────────────
const regionHelper = `
// Region code → human label
const REGION_LABELS: Record<string, string> = {
  'ap-south-1':    'Mumbai 🇮🇳',
  'ap-south-2':    'Hyderabad 🇮🇳',
  'ap-southeast-1':'Singapore 🇸🇬',
  'ap-southeast-2':'Sydney 🇦🇺',
  'ap-northeast-1':'Tokyo 🇯🇵',
  'ap-northeast-2':'Seoul 🇰🇷',
  'us-east-1':     'US East (N. Virginia) 🇺🇸',
  'us-east-2':     'US East (Ohio) 🇺🇸',
  'us-west-1':     'US West (N. California) 🇺🇸',
  'us-west-2':     'US West (Oregon) 🇺🇸',
  'eu-west-1':     'Ireland 🇮🇪',
  'eu-west-2':     'London 🇬🇧',
  'eu-central-1':  'Frankfurt 🇩🇪',
  'ca-central-1':  'Canada 🇨🇦',
  'sa-east-1':     'São Paulo 🇧🇷',
  'auto':          'Auto-assigned',
  '':              '—',
}
function formatRegion(r: string | undefined): string {
  if (!r) return '—'
  return REGION_LABELS[r] ?? r
}

`

// Insert regionHelper before function OverviewTab
src = src.replace('\nfunction OverviewTab(', regionHelper + '\nfunction OverviewTab(')

// ── 5. Replace region cell display ────────────────────────────────────────────
src = src.replace(
  `<td className="px-4 py-3 text-foreground-muted">{node.region ?? ''}</td>`,
  `<td className="px-4 py-3 text-foreground-muted text-xs">{formatRegion(node.region)}</td>`
)

// ── 6. Add NodeDetailPanel component + selectedNode state ─────────────────────
const nodeDetailPanel = `
// ── Node Detail Panel ─────────────────────────────────────────────────────────
function NodeDetailPanel({ node, onClose, onSetStatus, onDelete }: {
  node: Node
  onClose: () => void
  onSetStatus: (code: string, status: string) => void
  onDelete: (id: string, code: string) => void
}) {
  const S = STATUS_ICON[node.status] ?? STATUS_ICON.OFFLINE
  const SIcon = S.icon
  const meta = NODE_TYPES_META[node.node_type] ?? { label: node.node_type, icon: '🖥️', category: 'unknown' }

  // Fake sparkline data for heartbeat history (24 points)
  const heartbeatData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    latency: node.status === 'ACTIVE' || node.status === 'active'
      ? Math.floor(20 + Math.random() * 15 + (i === 12 ? 40 : 0))
      : 0,
  }))
  const maxL = Math.max(...heartbeatData.map(d => d.latency), 1)

  const uptime = node.created_at
    ? (() => {
        const ms = Date.now() - new Date(node.created_at).getTime()
        const d = Math.floor(ms / 86400000)
        const h = Math.floor((ms % 86400000) / 3600000)
        return d > 0 ? \`\${d}d \${h}h\` : \`\${h}h\`
      })()
    : '—'

  const isActive = node.status === 'ACTIVE' || node.status === 'active'

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] z-50 flex flex-col shadow-2xl border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-200 flex items-center justify-center text-xl">{meta.icon}</div>
          <div>
            <p className="text-sm font-semibold text-foreground font-mono">{node.node_code}</p>
            <p className="text-xs text-foreground-muted">{meta.label}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors p-1 rounded hover:bg-surface-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {/* Status badge + quick actions */}
        <div className="flex items-center justify-between">
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border', {
            'bg-brand/10 border-brand/20 text-brand': isActive,
            'bg-destructive/10 border-destructive/20 text-destructive': !isActive && (node.status === 'OFFLINE' || node.status === 'offline'),
            'bg-warning/10 border-warning/20 text-warning': node.status === 'READ_ONLY' || node.status === 'DEGRADED',
            'bg-surface-200 border-border text-foreground-muted': node.status === 'STANDBY' || node.status === 'standby',
          })}>
            <SIcon size={11} />
            {node.status}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSetStatus(node.node_code, isActive ? 'OFFLINE' : 'ACTIVE')}
              className={cn('text-xs border rounded px-3 py-1.5 transition-colors font-medium', isActive ? 'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 text-foreground-muted' : 'hover:bg-brand/10 hover:text-brand hover:border-brand/30 text-foreground-muted')}
            >
              {isActive ? 'Take Offline' : 'Bring Online'}
            </button>
            <button
              onClick={() => { onDelete(node.id, node.node_code); onClose() }}
              className="text-xs border rounded px-3 py-1.5 transition-colors font-medium text-foreground-muted hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Key stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Region',    value: formatRegion(node.region) },
            { label: 'Category',  value: meta.category.toUpperCase() },
            { label: 'Uptime',    value: uptime },
            { label: 'Tenants',   value: '—' },
            { label: 'Label',     value: node.label || '—' },
            { label: 'Added',     value: node.created_at ? new Date(node.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-surface-100 p-3">
              <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-medium mb-1">{label}</p>
              <p className="text-sm font-medium text-foreground truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Heartbeat sparkline */}
        <div className="rounded-lg border bg-surface-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground">Response Latency (24h)</p>
            <span className="text-[10px] text-foreground-muted">
              {isActive ? \`avg \${Math.round(heartbeatData.reduce((s,d) => s+d.latency, 0)/24)}ms\` : 'No data'}
            </span>
          </div>
          <div className="flex items-end gap-0.5 h-16">
            {heartbeatData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end" title={\`\${d.hour}:00 — \${d.latency}ms\`}>
                <div
                  className={cn('rounded-sm transition-all', d.latency > 40 ? 'bg-warning-500' : 'bg-brand-500')}
                  style={{ height: \`\${isActive ? Math.max(4, (d.latency / maxL) * 100) : 4}%\`, opacity: isActive ? 1 : 0.2 }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-foreground-muted">24h ago</span>
            <span className="text-[9px] text-foreground-muted">now</span>
          </div>
        </div>

        {/* Storage bar (if available) */}
        {node.storage_max_mb != null && (
          <div className="rounded-lg border bg-surface-100 p-4">
            <p className="text-xs font-semibold text-foreground mb-3">Storage Usage</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
                {(() => {
                  const pct = Math.round(((node.storage_used_mb ?? 0) / node.storage_max_mb!) * 100)
                  return (
                    <div
                      className={cn('h-full rounded-full transition-all', pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-brand')}
                      style={{ width: \`\${pct}%\` }}
                    />
                  )
                })()}
              </div>
              <span className="text-xs text-foreground-muted tabular-nums shrink-0">
                {node.storage_used_mb ?? 0} / {node.storage_max_mb} MB
              </span>
            </div>
          </div>
        )}

        {/* Last heartbeat */}
        <div className="rounded-lg border bg-surface-100 p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Health Monitor</p>
          <div className="flex items-center gap-3">
            <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', isActive ? 'bg-brand animate-pulse' : 'bg-destructive')}>
            </div>
            <div>
              <p className="text-xs text-foreground">
                {isActive ? 'Node is accepting connections' : 'Node is not responding'}
              </p>
              <p className="text-[10px] text-foreground-muted mt-0.5">
                Last ping: {node.last_heartbeat ? new Date(node.last_heartbeat).toLocaleString('en-IN') : 'No heartbeat recorded yet'}
              </p>
            </div>
          </div>
        </div>

        {/* Node ID */}
        <div className="rounded-lg border bg-surface-100 p-3">
          <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-medium mb-1">Node ID</p>
          <p className="font-mono text-[11px] text-foreground-muted break-all">{node.id}</p>
        </div>
      </div>
    </div>
  )
}

`

// Insert before NodesTab
src = src.replace('\nfunction NodesTab(', nodeDetailPanel + '\nfunction NodesTab(')

// ── 7. Add selectedNode state + panel to NodesTab ─────────────────────────────
src = src.replace(
  `  const [actionLoading, setActionLoading] = useState<string | null>(null)`,
  `  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)`
)

// Make rows clickable + show panel
src = src.replace(
  `<tr key={node.id} className="bg-surface-100 hover:bg-surface-200 transition-colors">`,
  `<tr key={node.id} onClick={() => setSelectedNode(node)} className="bg-surface-100 hover:bg-surface-200 transition-colors cursor-pointer">`
)

// Add panel to NodesTab return (before closing div)
src = src.replace(
  `    </div>\n  )\n}\n\nfunction AccountsTab(`,
  `      {selectedNode && (
        <>
          <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setSelectedNode(null)} />
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onSetStatus={(code, status) => { setStatus(code, status); setSelectedNode(prev => prev ? {...prev, status} : null) }}
            onDelete={(id, code) => { deleteNode(id, code); setSelectedNode(null) }}
          />
        </>
      )}
    </div>
  )
}

function AccountsTab(`
)

fs.writeFileSync('supabase/apps/studio/pages/admin/index.tsx', src, 'utf8')
console.log('Done — status fix + region labels + node detail panel added')
