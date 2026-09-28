/**
 * patch-connect-sheet.js
 * Rewrites the AnantaConnectionPanel in ConnectSheet.tsx:
 *  - Removes region selector entirely
 *  - Shows 4 categories: Relational, Document, Vector, Cache, Files, SDK
 *  - All connection strings use ananta.io domains only — zero vendor exposure
 *  - Fetches real connection strings from GET /v1/auth/me/connections
 */
const fs   = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'supabase/apps/studio/components/interfaces/ConnectSheet/ConnectSheet.tsx')
let src = fs.readFileSync(FILE, 'utf8')

// ── Find and replace everything from the Region type to the end of AnantaConnectionPanel ──
// We'll replace the entire AnantaConnectionPanel with the new clean version

// Identify the panel section boundaries
const PANEL_START = `// ─── Ananta Connection Panel`
const PANEL_START_ALT = `// ─── Ananta Connection Panel (top, always visible)`
const COMPONENT_START = `function AnantaConnectionPanel`

// Find the line that declares REGIONS
const newPanel = `// ─── Ananta Connection Panel (top, always visible, fetches real connections) ───────

type ConnCategory = 'relational' | 'document' | 'vector' | 'cache' | 'files' | 'rest' | 'sdk'

const CATEGORY_META: { id: ConnCategory; label: string; icon: string }[] = [
  { id: 'relational', label: 'SQL / Postgres',    icon: '🐘' },
  { id: 'document',   label: 'Document DB',        icon: '🍃' },
  { id: 'vector',     label: 'Vector / AI',        icon: '🧠' },
  { id: 'cache',      label: 'Cache / KV',         icon: '⚡' },
  { id: 'files',      label: 'File Storage',       icon: '🗄️' },
  { id: 'rest',       label: 'REST API',           icon: '🔌' },
  { id: 'sdk',        label: '@ananta/js SDK',     icon: '📦' },
]

// Connection row types returned by /v1/auth/me/connections
interface ConnectionStrings {
  relational?: { direct: string; pooled: string; session: string }
  document?:   { uri: string; database: string; port: number }
  vector?:     { endpoint: string; api_key: string; namespace: string }
  cache?:      { uri: string; host: string; port: number }
  files?:      { endpoint: string; access_key: string; secret_key: string; bucket: string }
  rest?:       { base_url: string; auth_header: string }
  sdk?:        { install: string; init: string }
}

function AnantaConnectionPanel({
  anonKey,
  projectRef,
}: {
  anonKey: string | null
  projectRef: string | undefined
}) {
  const [tab, setTab]               = useState<ConnCategory>('relational')
  const [connections, setConns]     = useState<ConnectionStrings | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Fetch real connection strings from the server (uses user's JWT)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ananta-token') : null
    if (!token) return

    setLoading(true)
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
    fetch(\`\${API_URL}/v1/auth/me/connections\`, {
      headers: { Authorization: \`Bearer \${token}\` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setConns(d.connections ?? {}))
      .catch(() => setError('Could not load connection strings'))
      .finally(() => setLoading(false))
  }, [])

  // Figure out which tabs have data
  const availableTabs = CATEGORY_META.filter(c => {
    if (!connections) return c.id === 'rest' || c.id === 'sdk'
    return connections[c.id as keyof ConnectionStrings] !== undefined
  })

  // Connection rows per tab
  function getRows(cat: ConnCategory): { label: string; value: string; code?: boolean }[] {
    if (!connections) return []
    switch (cat) {
      case 'relational':
        if (!connections.relational) return []
        return [
          { label: 'Direct URI',      value: connections.relational.direct   },
          { label: 'Pooled (txn)',     value: connections.relational.pooled   },
          { label: 'Session URI',      value: connections.relational.session  },
          { label: 'SSL Mode',         value: 'require'                       },
        ]
      case 'document':
        if (!connections.document) return []
        return [
          { label: 'Connection URI',   value: connections.document.uri      },
          { label: 'Database',         value: connections.document.database  },
          { label: 'Port',             value: String(connections.document.port) },
        ]
      case 'vector':
        if (!connections.vector) return []
        return [
          { label: 'Endpoint',         value: connections.vector.endpoint    },
          { label: 'API Key',          value: connections.vector.api_key     },
          { label: 'Namespace',        value: connections.vector.namespace   },
        ]
      case 'cache':
        if (!connections.cache) return []
        return [
          { label: 'Redis URI',        value: connections.cache.uri          },
          { label: 'Host',             value: connections.cache.host         },
          { label: 'Port',             value: String(connections.cache.port) },
        ]
      case 'files':
        if (!connections.files) return []
        return [
          { label: 'Endpoint',         value: connections.files.endpoint    },
          { label: 'Access Key',       value: connections.files.access_key  },
          { label: 'Secret Key',       value: connections.files.secret_key  },
          { label: 'Bucket',           value: connections.files.bucket      },
        ]
      case 'rest':
        if (!connections.rest) return []
        return [
          { label: 'Base URL',         value: connections.rest.base_url      },
          { label: 'Auth header',      value: connections.rest.auth_header   },
        ]
      case 'sdk':
        if (!connections.sdk) return []
        return [
          { label: 'Install',          value: connections.sdk.install,  code: true },
          { label: 'Init',             value: connections.sdk.init,     code: true },
        ]
      default:
        return []
    }
  }

  const rows = getRows(tab)

  return (
    <div className="p-6 border-b">
      {/* Header */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-foreground">Your connection strings</p>
        <p className="text-xs text-foreground-muted mt-0.5">
          Use these in your app. All traffic is routed through Ananta's infrastructure.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CATEGORY_META.map(c => {
          const hasData = connections ? connections[c.id as keyof ConnectionStrings] !== undefined : (c.id === 'rest' || c.id === 'sdk')
          if (!hasData && !loading) return null
          return (
            <button key={c.id} onClick={() => setTab(c.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                tab === c.id
                  ? 'border-foreground bg-surface-200 text-foreground'
                  : 'border-border text-foreground-muted hover:text-foreground hover:border-foreground-muted'
              )}>
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          )
        })}
      </div>

      {/* Connection string rows */}
      {loading ? (
        <div className="rounded-md bg-surface-100 border px-4 py-6 text-center">
          <p className="text-xs text-foreground-muted">Loading connection details…</p>
        </div>
      ) : error ? (
        <div className="rounded-md bg-surface-100 border px-4 py-3">
          <p className="text-xs text-foreground-muted">Sign in to view your connection strings.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md bg-surface-100 border px-4 py-4 text-center">
          <p className="text-xs text-foreground-muted">
            This service is not yet activated on your account.
          </p>
          <p className="text-[11px] text-foreground-muted mt-1">
            It will be activated automatically as your usage grows.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(row => (
            <ConnRow key={row.label} label={row.label} value={row.value} mono />
          ))}
        </div>
      )}
    </div>
  )
}
`

// Now replace the old panel section in the source
// Strategy: find from the type Region = line to the closing of AnantaConnectionPanel

const regionTypeIdx = src.indexOf('type Region = {')
const connectPanelCloseSearch = '\nexport const ConnectSheet'
const panelEndIdx = src.indexOf(connectPanelCloseSearch, regionTypeIdx)

if (regionTypeIdx === -1 || panelEndIdx === -1) {
  // Fallback: find old panel by function declaration
  const fnIdx = src.indexOf('function AnantaConnectionPanel(')
  const fnEndIdx = src.indexOf('\nfunction ConnectSheet', fnIdx)
  if (fnIdx !== -1 && fnEndIdx !== -1) {
    // Cut from type Region to function ConnectSheet
    const before = src.slice(0, fnIdx)
    const after  = src.slice(fnEndIdx)
    src = before + newPanel + after
    console.log('Replaced via AnantaConnectionPanel function search')
  } else {
    console.error('Could not find panel boundaries. Manual intervention needed.')
    process.exit(1)
  }
} else {
  const before = src.slice(0, regionTypeIdx)
  const after  = src.slice(panelEndIdx)
  src = before + newPanel + after
  console.log('Replaced via type Region boundary')
}

fs.writeFileSync(FILE, src, 'utf8')
console.log('✓ ConnectSheet.tsx — AnantaConnectionPanel rewritten (no regions, real API, all categories)')
