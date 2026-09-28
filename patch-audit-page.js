/**
 * patch-audit-page.js
 * Rewrites pages/account/audit.tsx to fetch real events from /v1/audit
 */
const fs   = require('fs')
const path = require('path')

const newContent = `/**
 * /account/audit — Audit Logs (wired to real /v1/audit API)
 */
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, LogIn, User, Key, ArrowUpCircle, Trash2 } from 'lucide-react'
import { AnantaAccountLayout } from '@/components/layouts/AnantaAccountLayout'
import { useAnantaAuth } from '@/hooks/useAnantaAuth'
import { ANANTA_API_URL } from '@/lib/ananta-config'
import { cn } from 'ui'

interface AuditEvent {
  id:          string
  action:      string
  action_code: string
  details:     Record<string, unknown>
  created_at:  string
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'Signed in':       <LogIn    size={13} className="text-brand" />,
  'Signed out':      <LogIn    size={13} className="text-foreground-muted rotate-180" />,
  'Profile updated': <User     size={13} className="text-blue-400" />,
  'API token created': <Key    size={13} className="text-green-400" />,
  'API token revoked': <Trash2 size={13} className="text-destructive" />,
  'Plan upgraded':   <ArrowUpCircle size={13} className="text-brand" />,
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return \`\${s}s ago\`
  const m = Math.floor(s / 60)
  if (m < 60)  return \`\${m}m ago\`
  const h = Math.floor(m / 60)
  if (h < 24)  return \`\${h}h ago\`
  return new Date(iso).toLocaleDateString()
}

export default function AuditLogsPage() {
  const { user, state } = useAnantaAuth({ require: true })
  const [events, setEvents]     = useState<AuditEvent[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const fetchEvents = useCallback(async (isRefresh = false) => {
    const token = localStorage.getItem('ananta-token')
    if (!token) return
    isRefresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const r = await fetch(\`\${ANANTA_API_URL}/v1/audit?limit=100\`, {
        headers: { Authorization: \`Bearer \${token}\` },
      })
      if (!r.ok) throw new Error(\`HTTP \${r.status}\`)
      const d = await r.json()
      setEvents(d.events ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log')
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  if (state === 'loading' || !user) return null

  return (
    <AnantaAccountLayout title="Audit Logs">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Audit Logs</h2>
          <p className="text-sm text-foreground-muted">Account activity and authentication events.</p>
        </div>
        <button
          onClick={() => fetchEvents(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-surface-100 transition-colors text-foreground-muted disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-lg border bg-surface-100 p-8 text-center">
          <p className="text-sm text-foreground-muted">Loading events…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-surface-100 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border bg-surface-100 p-8 text-center">
          <p className="text-sm text-foreground-muted">No audit events yet.</p>
          <p className="text-xs text-foreground-muted mt-1">Events appear here after account activity.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {events.map((ev, i) => (
            <div key={ev.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm',
                i !== events.length - 1 && 'border-b'
              )}
            >
              {/* Icon */}
              <div className="shrink-0 w-5 flex justify-center">
                {ACTION_ICONS[ev.action] ?? <div className="w-2 h-2 rounded-full bg-foreground-muted/40" />}
              </div>

              {/* Action */}
              <span className="flex-1 text-foreground text-sm">{ev.action}</span>

              {/* Extra details */}
              {ev.details?.services_activated != null && (
                <span className="text-xs text-foreground-muted bg-surface-200 rounded px-2 py-0.5">
                  {ev.details.services_activated as number} service{(ev.details.services_activated as number) !== 1 ? 's' : ''} activated
                </span>
              )}
              {ev.details?.plan && (
                <span className="text-xs text-brand bg-brand/10 rounded px-2 py-0.5 capitalize">
                  {ev.details.plan as string}
                </span>
              )}

              {/* Timestamp */}
              <span className="text-xs text-foreground-muted shrink-0 ml-2">
                {relativeTime(ev.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-foreground-muted">
        Showing last 100 events. Audit logs are retained for 90 days.
      </p>
    </AnantaAccountLayout>
  )
}
`

const FILE = path.join(__dirname, 'supabase/apps/studio/pages/account/audit.tsx')
fs.writeFileSync(FILE, newContent, 'utf8')
console.log('✓ audit.tsx — wired to real /v1/audit API')
