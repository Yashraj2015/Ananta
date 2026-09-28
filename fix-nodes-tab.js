/**
 * fix-nodes-tab.js
 * 1. Fixes Node interface to match API response (node_code, node_type, last_heartbeat)
 * 2. Fixes grouping and all render references
 * 3. Fixes status/delete PATCH endpoint to use node_code
 * 4. Adds toast notifications for Add Node, Status change, Delete
 */
const fs = require('fs')
let src = fs.readFileSync('supabase/apps/studio/pages/admin/index.tsx', 'utf8')

// ── 1. Fix Node interface ──────────────────────────────────────────────────────
src = src.replace(
  `interface Node {\n  id: string; code: string; type: string; status: string; region?: string\n  label?: string; storage_used_mb?: number; storage_max_mb?: number\n  last_ping?: string; created_at: string\n}`,
  `interface Node {\n  id: string; node_code: string; node_type: string; status: string; region?: string\n  label?: string; storage_used_mb?: number; storage_max_mb?: number\n  last_heartbeat?: string | null; created_at: string\n}`
)

// ── 2. Fix grouping field n.type → n.node_type ─────────────────────────────────
src = src.replace(
  `nodes.forEach(n => { (grouped[n.type] ??= []).push(n) })`,
  `nodes.forEach(n => { (grouped[n.node_type] ??= []).push(n) })`
)

// ── 3. Fix render: node.code → node.node_code ──────────────────────────────────
src = src.replace(/{node\.code}/g, '{node.node_code}')
src = src.replace(/node\.code/g, 'node.node_code')

// ── 4. Fix render: node.last_ping → node.last_heartbeat ────────────────────────
src = src.replace(/node\.last_ping/g, 'node.last_heartbeat')

// ── 5. Fix PATCH endpoint — was /nodes/:id, now should use node_code ───────────
// The PATCH /v1/admin/nodes/:code/status uses node_code (the string code, not UUID)
src = src.replace(
  'await fetch(`${API}/v1/admin/nodes/${nodeId}`, {\n        method: \'PATCH\',\n        headers: { \'x-ananta-admin-key\': ADMIN_KEY, \'Content-Type\': \'application/json\' },\n        body: JSON.stringify({ status }),\n      })\n      refetch()',
  'await fetch(`${API}/v1/admin/nodes/${nodeId}/status`, {\n        method: \'PATCH\',\n        headers: { \'x-ananta-admin-key\': ADMIN_KEY, \'Content-Type\': \'application/json\' },\n        body: JSON.stringify({ status }),\n      })\n      showToast(`Node status updated to ${status}`, \'ok\')\n      refetch()'
)

// ── 6. Fix delete endpoint ─────────────────────────────────────────────────────
src = src.replace(
  'await fetch(`${API}/v1/admin/nodes/${nodeId}`, {\n        method: \'DELETE\',\n        headers: { \'x-ananta-admin-key\': ADMIN_KEY },\n      })\n      refetch()',
  'const dr = await fetch(`${API}/v1/admin/nodes/${nodeId}`, {\n        method: \'DELETE\',\n        headers: { \'x-ananta-admin-key\': ADMIN_KEY },\n      })\n      if (dr.ok) showToast(`Node ${code} deleted`, \'ok\')\n      else showToast(\'Delete failed\', \'err\')\n      refetch()'
)

// ── 7. Fix setStatus call — pass node.node_code not node.id as the identifier ──
// The PATCH endpoint uses /nodes/:code/status (code = "node-s1" etc)
// actionLoading tracks by id for isLoading spinner — keep that
// But the fetch path needs node_code
src = src.replace(
  'const setStatus = async (nodeId: string, status: string) => {',
  'const setStatus = async (nodeCode: string, status: string) => {'
)
src = src.replace(
  'setActionLoading(nodeId)\n    try {\n      await fetch(`${API}/v1/admin/nodes/${nodeId}/status`',
  'setActionLoading(nodeCode)\n    try {\n      await fetch(`${API}/v1/admin/nodes/${nodeCode}/status`'
)
// Fix actionLoading check back to use node_code for spinner
src = src.replace(
  'const isLoading = actionLoading === node.id',
  'const isLoading = actionLoading === node.node_code'
)

// ── 8. Add showToast to Add Node submit ────────────────────────────────────────
src = src.replace(
  `setResult({ ok: true, msg: \`Node \${code} added successfully!\` })`,
  `setResult({ ok: true, msg: \`Node \${code} added successfully!\` })\n      showToast(\`Node \${code} added!\`, 'ok')`
)

// ── 9. Add showToast helper and toast state to the file ────────────────────────
// Insert at top of the component (after ADMIN_KEY const, before function OverviewTab)
const toastHelper = `
// ── Toast notification helper (shared) ────────────────────────────────────────
let _toastTimeout: ReturnType<typeof setTimeout> | null = null
let _setToast: ((t: { msg: string; kind: 'ok' | 'err' } | null) => void) | null = null

function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
  if (!_setToast) return
  if (_toastTimeout) clearTimeout(_toastTimeout)
  _setToast({ msg, kind })
  _toastTimeout = setTimeout(() => _setToast?.(null), 3500)
}

function ToastContainer() {
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  useEffect(() => { _setToast = setToast; return () => { _setToast = null } }, [])
  if (!toast) return null
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 rounded-lg border px-4 py-3 shadow-lg text-sm font-medium transition-all',
      toast.kind === 'ok'
        ? 'bg-brand/10 border-brand/30 text-brand'
        : 'bg-destructive/10 border-destructive/30 text-destructive'
    )}>
      {toast.kind === 'ok' ? '✓' : '✗'} {toast.msg}
    </div>
  )
}

`

// Find insertion point: before function OverviewTab
const overviewIdx = src.indexOf('\nfunction OverviewTab(')
src = src.slice(0, overviewIdx) + toastHelper + src.slice(overviewIdx)

// ── 10. Add <ToastContainer /> to the main AdminPage render ───────────────────
// Find the main return statement in AdminPage
src = src.replace(
  '<div className="flex h-full flex-col">',
  '<div className="flex h-full flex-col">\n      <ToastContainer />'
)

// ── 11. Fix setStatus call site in JSX — pass node_code not node.id ───────────
// The JSX calls setStatus(node.id, ...) — fix to node.node_code
src = src.replace(/setStatus\(node\.id,/g, 'setStatus(node.node_code,')
// Also deleteNode(node.id, node.code) → deleteNode(node.id, node.node_code)  (id is for loading spinner)
src = src.replace(/deleteNode\(node\.id,\s*node\.code\)/g, 'deleteNode(node.id, node.node_code)')

fs.writeFileSync('supabase/apps/studio/pages/admin/index.tsx', src, 'utf8')
console.log('✓ Nodes tab fixed: API field names corrected, toast notifications added')
