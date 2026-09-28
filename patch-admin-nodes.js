/**
 * patch-admin-nodes.js
 * Rewrites the node type definitions and AddNodeTab in admin/index.tsx
 * using Node.js fs to avoid PowerShell Unicode corruption.
 */
const fs   = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'supabase/apps/studio/pages/admin/index.tsx')
let src = fs.readFileSync(FILE, 'utf8')

// ── 1. Replace NODE_TYPE_LABELS ───────────────────────────────────────────────
const OLD_LABELS = `const NODE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  mongo:      { label: 'Document DB (MongoDB wire)',  icon: '🍃' },
  pg:         { label: 'Relational DB (PostgreSQL)',  icon: '🐘' },
  ctrl:       { label: 'Control Plane (Supabase)',    icon: '🎛️' },
  r2:         { label: 'Object Storage (R2)',          icon: '🗄️⚡' },
  valkey:     { label: 'Cache / Queue (Valkey)',       icon: '⚡' },
}`

const NEW_LABELS = `// ── Node type master registry ─────────────────────────────────────────────────
// Each entry: category (pg/doc/vector/cache/files/ctrl), label, icon
const NODE_TYPES_META: Record<string, { category: string; label: string; icon: string }> = {
  // ── Relational / SQL ──────────────────────────────────────────────────────
  neon:           { category: 'pg',     label: 'Neon (Serverless Postgres)',       icon: '⚡' },
  supabase:       { category: 'pg',     label: 'Supabase (Postgres + BaaS)',       icon: '🔷' },
  cockroach:      { category: 'pg',     label: 'CockroachDB (Distributed SQL)',    icon: '🪲' },
  turso:          { category: 'pg',     label: 'Turso (SQLite / LibSQL)',          icon: '⚪' },
  xata:           { category: 'pg',     label: 'Xata (Postgres + Branching)',      icon: '🐙' },
  d1:             { category: 'pg',     label: 'Cloudflare D1 (Serverless SQLite)', icon: '☁️' },
  // ── Document / NoSQL ──────────────────────────────────────────────────────
  atlas:          { category: 'doc',    label: 'MongoDB Atlas (Document DB)',      icon: '🍃' },
  firestore:      { category: 'doc',    label: 'Firebase Firestore (NoSQL)',       icon: '🔥' },
  convex:         { category: 'doc',    label: 'Convex (Reactive Backend)',        icon: '🔄' },
  appwrite:       { category: 'doc',    label: 'Appwrite (Document + BaaS)',       icon: '🅰️' },
  // ── Vector / AI ───────────────────────────────────────────────────────────
  pinecone:       { category: 'vector', label: 'Pinecone (Vector DB)',             icon: '🌲' },
  qdrant:         { category: 'vector', label: 'Qdrant (Vector DB)',               icon: '🎯' },
  weaviate:       { category: 'vector', label: 'Weaviate (Hybrid Search)',         icon: '🕸️' },
  'upstash-vector': { category: 'vector', label: 'Upstash Vector',                icon: '⬆️' },
  // ── Cache / KV ────────────────────────────────────────────────────────────
  'upstash-redis':  { category: 'cache',  label: 'Upstash Redis (Serverless)',     icon: '🔴' },
  valkey:           { category: 'cache',  label: 'Valkey (Redis-compatible)',      icon: '🔑' },
  // ── Object Storage ────────────────────────────────────────────────────────
  r2:             { category: 'files',  label: 'Cloudflare R2 (Object Storage)',  icon: '🗄️' },
  s3:             { category: 'files',  label: 'AWS S3 (Object Storage)',         icon: '🪣' },
  'do-spaces':    { category: 'files',  label: 'DigitalOcean Spaces',             icon: '🌊' },
  // ── Internal ──────────────────────────────────────────────────────────────
  'ctrl-plane':   { category: 'ctrl',   label: 'Control Plane (Internal)',        icon: '🎛️' },
}

// Backward-compat alias for existing display code
const NODE_TYPE_LABELS: Record<string, { label: string; icon: string }> = Object.fromEntries(
  Object.entries(NODE_TYPES_META).map(([k, v]) => [k, { label: v.label, icon: v.icon }])
)

const NODE_CATEGORY_LABELS: Record<string, string> = {
  pg:     'Relational / SQL',
  doc:    'Document / NoSQL',
  vector: 'Vector / AI',
  cache:  'Cache / KV',
  files:  'Object Storage',
  ctrl:   'Internal',
}`

src = src.replace(OLD_LABELS, NEW_LABELS)

// ── 2. Replace the NODE_TYPES constant and NODE_FIELD_DEFS ────────────────────
const OLD_TYPES = `const NODE_TYPES = ['mongo', 'pg', 'ctrl', 'r2', 'valkey'] as const
type NodeType = typeof NODE_TYPES[number]

const NODE_FIELD_DEFS: Record<NodeType, { id: string; label: string; placeholder: string; secret?: boolean }[]> = {
  mongo:  [{ id: 'uri', label: 'Connection URI', placeholder: 'mongodb+srv://...', secret: true }],
  pg:     [{ id: 'uri', label: 'Connection URI', placeholder: 'postgresql://...', secret: true }],
  ctrl:   [
    { id: 'url', label: 'Supabase URL', placeholder: 'https://xxx.supabase.co' },
    { id: 'key', label: 'Service Role Key', placeholder: 'eyJ...', secret: true },
  ],
  r2:     [
    { id: 'endpoint',   label: 'Endpoint',       placeholder: 'https://xxx.r2.cloudflarestorage.com' },
    { id: 'access_key', label: 'Access Key ID',  placeholder: 'R2_ACCESS_KEY_ID' },
    { id: 'secret_key', label: 'Secret Key',     placeholder: 'R2_SECRET_KEY', secret: true },
    { id: 'bucket',     label: 'Bucket Name',    placeholder: 'ananta-files' },
  ],
  valkey: [{ id: 'uri', label: 'Connection URL', placeholder: 'rediss://:password@host:6379', secret: true }],
}`

const NEW_TYPES = `// All supported node types (from NODE_TYPES_META keys)
const NODE_TYPES = Object.keys(NODE_TYPES_META) as string[]

// Credential fields per node type
const NODE_FIELD_DEFS: Record<string, { id: string; label: string; placeholder: string; secret?: boolean }[]> = {
  // Relational
  neon:           [{ id: 'uri', label: 'Connection URI', placeholder: 'postgresql://user:pass@ep-xxx.neon.tech/neondb', secret: true }],
  supabase:       [
    { id: 'url', label: 'Project URL',       placeholder: 'https://xxx.supabase.co' },
    { id: 'key', label: 'Service Role Key',  placeholder: 'eyJ...', secret: true },
    { id: 'uri', label: 'Postgres URI',      placeholder: 'postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres', secret: true },
  ],
  cockroach:      [{ id: 'uri', label: 'Connection URI', placeholder: 'postgresql://user:pass@cluster.cockroachdb.cloud:26257/defaultdb?sslmode=verify-full', secret: true }],
  turso:          [
    { id: 'url',   label: 'Database URL',  placeholder: 'libsql://xxx.turso.io' },
    { id: 'token', label: 'Auth Token',    placeholder: 'eyJ...', secret: true },
  ],
  xata:           [
    { id: 'uri', label: 'Postgres URI',     placeholder: 'postgresql://xxx.xata.sh:5432/db', secret: true },
    { id: 'key', label: 'API Key',          placeholder: 'xau_...', secret: true },
  ],
  d1:             [
    { id: 'account_id',   label: 'Account ID',   placeholder: 'Cloudflare Account ID' },
    { id: 'database_id',  label: 'Database ID',  placeholder: 'D1 Database ID' },
    { id: 'token',        label: 'API Token',    placeholder: 'Cloudflare API Token', secret: true },
  ],
  // Document
  atlas:          [{ id: 'uri', label: 'Connection URI', placeholder: 'mongodb+srv://user:pass@cluster.mongodb.net', secret: true }],
  firestore:      [
    { id: 'project_id',      label: 'Project ID',       placeholder: 'my-firebase-project' },
    { id: 'service_account', label: 'Service Account JSON', placeholder: '{"type":"service_account",...}', secret: true },
  ],
  convex:         [
    { id: 'url',       label: 'Deployment URL',  placeholder: 'https://xxx.convex.cloud' },
    { id: 'deploy_key', label: 'Deploy Key',     placeholder: 'convex-deploy-xxx', secret: true },
  ],
  appwrite:       [
    { id: 'endpoint', label: 'Endpoint',    placeholder: 'https://cloud.appwrite.io/v1' },
    { id: 'project',  label: 'Project ID',  placeholder: 'xxx' },
    { id: 'key',      label: 'API Key',     placeholder: 'xxx', secret: true },
  ],
  // Vector
  pinecone:       [
    { id: 'api_key',     label: 'API Key',     placeholder: 'pcsk_...', secret: true },
    { id: 'index_name',  label: 'Index Name',  placeholder: 'ananta-vectors' },
  ],
  qdrant:         [
    { id: 'url',     label: 'Cluster URL', placeholder: 'https://xxx.qdrant.io:6333' },
    { id: 'api_key', label: 'API Key',     placeholder: 'qdrant-api-key', secret: true },
  ],
  weaviate:       [
    { id: 'url',     label: 'Cluster URL', placeholder: 'https://xxx.weaviate.network' },
    { id: 'api_key', label: 'API Key',     placeholder: 'weaviate-api-key', secret: true },
  ],
  'upstash-vector': [
    { id: 'url',   label: 'REST URL',   placeholder: 'https://xxx-vector.upstash.io' },
    { id: 'token', label: 'REST Token', placeholder: 'AXxx...', secret: true },
  ],
  // Cache
  'upstash-redis': [
    { id: 'url',      label: 'Redis URL',   placeholder: 'rediss://default:xxx@xxx.upstash.io:6379', secret: true },
    { id: 'rest_url', label: 'REST URL',    placeholder: 'https://xxx.upstash.io' },
    { id: 'rest_token', label: 'REST Token', placeholder: 'AXxx...', secret: true },
  ],
  valkey:          [{ id: 'uri', label: 'Connection URL', placeholder: 'redis://:password@host:6379', secret: true }],
  // Files
  r2:              [
    { id: 'endpoint',   label: 'Endpoint',       placeholder: 'https://xxx.r2.cloudflarestorage.com' },
    { id: 'access_key', label: 'Access Key ID',  placeholder: 'R2_ACCESS_KEY_ID' },
    { id: 'secret_key', label: 'Secret Key',     placeholder: 'R2_SECRET_KEY', secret: true },
    { id: 'bucket',     label: 'Bucket Name',    placeholder: 'ananta-files' },
  ],
  s3:              [
    { id: 'access_key', label: 'Access Key ID',  placeholder: 'AKIAIOSFODNN7EXAMPLE' },
    { id: 'secret_key', label: 'Secret Key',     placeholder: 'wJalrXUtnFEMI/...', secret: true },
    { id: 'bucket',     label: 'Bucket Name',    placeholder: 'ananta-prod-files' },
    { id: 'region',     label: 'AWS Region',     placeholder: 'ap-south-1' },
  ],
  'do-spaces':     [
    { id: 'endpoint',   label: 'Spaces Endpoint', placeholder: 'https://nyc3.digitaloceanspaces.com' },
    { id: 'access_key', label: 'Access Key',      placeholder: 'DO_ACCESS_KEY' },
    { id: 'secret_key', label: 'Secret Key',      placeholder: 'DO_SECRET_KEY', secret: true },
    { id: 'bucket',     label: 'Space Name',      placeholder: 'ananta-files' },
  ],
  'ctrl-plane':    [
    { id: 'url', label: 'Supabase URL',        placeholder: 'https://xxx.supabase.co' },
    { id: 'key', label: 'Service Role Key',    placeholder: 'eyJ...', secret: true },
  ],
}`

src = src.replace(OLD_TYPES, NEW_TYPES)

// ── 3. Update AddNodeTab — group types by category, remove region field ────────
const OLD_REGION_FIELD = `      {/* Core fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">Node Code *</label>
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="node-a1"
            className="rounded-md border bg-surface-200 px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-foreground" />
          <p className="text-[10px] text-foreground-muted">e.g. node-a1, node-n1, node-r2a</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground-muted">Region</label>
          <input value={region} onChange={e => setRegion(e.target.value)} placeholder="ap-south-1"
            className="rounded-md border bg-surface-200 px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-foreground" />
        </div>
      </div>`

const NEW_CORE_FIELDS = `      {/* Core fields — no region, Ananta routes internally */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground-muted">Node Code *</label>
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="node-a1"
          className="rounded-md border bg-surface-200 px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-foreground" />
        <p className="text-[10px] text-foreground-muted">Unique identifier — e.g. node-neon-1, node-atlas-1, node-pinecone-1</p>
      </div>`

src = src.replace(OLD_REGION_FIELD, NEW_CORE_FIELDS)

// ── 4. Update the node type tiles to group by category ────────────────────────
// Replace the flat grid with a categorised layout
const OLD_TILES = `        <div className="grid grid-cols-5 gap-2">
          {NODE_TYPES.map(t => (
            <button key={t} onClick={() => { setType(t); setFields({}) }}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-all',
                type === t ? 'border-foreground bg-surface-200 text-foreground' : 'border-border text-foreground-muted hover:border-foreground-muted'
              )}>
              <span className="text-base">{NODE_TYPE_LABELS[t]?.icon}</span>
              <span className="uppercase text-[10px] tracking-wide">{t}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-foreground-muted">{NODE_TYPE_LABELS[type]?.label}</p>`

const NEW_TILES = `        {/* Grouped by category */}
        {(['pg','doc','vector','cache','files','ctrl'] as const).map(cat => {
          const typesInCat = NODE_TYPES.filter(t => NODE_TYPES_META[t]?.category === cat)
          if (!typesInCat.length) return null
          return (
            <div key={cat} className="flex flex-col gap-1.5">
              <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-widest">
                {NODE_CATEGORY_LABELS[cat]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {typesInCat.map(t => (
                  <button key={t} onClick={() => { setType(t as any); setFields({}) }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                      type === t
                        ? 'border-foreground bg-surface-200 text-foreground'
                        : 'border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground'
                    )}>
                    <span>{NODE_TYPE_LABELS[t]?.icon}</span>
                    <span>{t}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {type && <p className="text-[11px] text-foreground-muted mt-1">{NODE_TYPE_LABELS[type as string]?.label}</p>}`

src = src.replace(OLD_TILES, NEW_TILES)

// ── 5. Update the submit payload — remove region ──────────────────────────────
src = src.replace(
  `body: JSON.stringify({ code: code.trim(), type, region: region.trim(), label: label.trim(), credentials: fields, status: 'active' }),`,
  `body: JSON.stringify({ code: code.trim(), type, label: label.trim(), credentials: fields, status: 'ACTIVE' }),`
)

// ── 6. Remove the region useState and clear region on submit ──────────────────
src = src.replace(
  `  const [region, setRegion] = useState('')\n`,
  ''
)
src = src.replace(
  `setCode(''); setRegion(''); setLabel(''); setFields({})`,
  `setCode(''); setLabel(''); setFields({})`
)

fs.writeFileSync(FILE, src, 'utf8')
console.log('✓ admin/index.tsx — node types and AddNodeTab updated')
