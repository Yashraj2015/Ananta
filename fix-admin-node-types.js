/**
 * fix-admin-node-types.js
 * Injects NODE_TYPES_META and NODE_CATEGORY_LABELS at the module level
 * right after NODE_TYPE_LABELS, and removes the bad duplicate in AddNodeTab
 */
const fs   = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'supabase/apps/studio/pages/admin/index.tsx')
let src = fs.readFileSync(FILE, 'utf8')

// ── 1. Find NODE_TYPE_LABELS closing brace and inject META after it ────────────
// Find the end of NODE_TYPE_LABELS object
const labelsStart = src.indexOf('const NODE_TYPE_LABELS')
if (labelsStart === -1) { console.error('Cannot find NODE_TYPE_LABELS'); process.exit(1) }

// Find its closing brace: look for '}\n\n' or '}\n//' after the labels start
let depth = 0
let inObj = false
let closingIdx = -1
for (let i = labelsStart; i < src.length; i++) {
  if (src[i] === '{') { inObj = true; depth++ }
  else if (src[i] === '}' && inObj) {
    depth--
    if (depth === 0) { closingIdx = i; break }
  }
}

if (closingIdx === -1) { console.error('Cannot find closing brace of NODE_TYPE_LABELS'); process.exit(1) }

// Inject META definitions right after the closing brace of NODE_TYPE_LABELS
const injection = `

// ── Node types master registry (category + icon + label) ─────────────────────
const NODE_TYPES_META: Record<string, { category: string; label: string; icon: string }> = {
  // Relational / SQL
  neon:             { category: 'pg',     label: 'Neon (Serverless Postgres)',        icon: '⚡' },
  supabase:         { category: 'pg',     label: 'Supabase (Postgres + BaaS)',        icon: '🔷' },
  cockroach:        { category: 'pg',     label: 'CockroachDB (Distributed SQL)',     icon: '🪲' },
  turso:            { category: 'pg',     label: 'Turso (SQLite / LibSQL)',           icon: '⚪' },
  xata:             { category: 'pg',     label: 'Xata (Postgres + Branching)',       icon: '🐙' },
  d1:               { category: 'pg',     label: 'Cloudflare D1 (Serverless SQLite)', icon: '☁️' },
  // Document / NoSQL
  atlas:            { category: 'doc',    label: 'MongoDB Atlas (Document DB)',       icon: '🍃' },
  firestore:        { category: 'doc',    label: 'Firebase Firestore (NoSQL)',        icon: '🔥' },
  convex:           { category: 'doc',    label: 'Convex (Reactive Backend)',         icon: '🔄' },
  appwrite:         { category: 'doc',    label: 'Appwrite (Document + BaaS)',        icon: '🅰️' },
  // Vector / AI
  pinecone:         { category: 'vector', label: 'Pinecone (Vector DB)',              icon: '🌲' },
  qdrant:           { category: 'vector', label: 'Qdrant (Vector DB)',                icon: '🎯' },
  weaviate:         { category: 'vector', label: 'Weaviate (Hybrid Search)',          icon: '🕸️' },
  'upstash-vector': { category: 'vector', label: 'Upstash Vector',                   icon: '⬆️' },
  // Cache / KV
  'upstash-redis':  { category: 'cache',  label: 'Upstash Redis (Serverless)',        icon: '🔴' },
  valkey:           { category: 'cache',  label: 'Valkey (Redis-compatible)',         icon: '🔑' },
  // Object Storage
  r2:               { category: 'files',  label: 'Cloudflare R2',                    icon: '🗄️' },
  s3:               { category: 'files',  label: 'AWS S3',                           icon: '🪣' },
  'do-spaces':      { category: 'files',  label: 'DigitalOcean Spaces',              icon: '🌊' },
  // Internal
  'ctrl-plane':     { category: 'ctrl',   label: 'Control Plane (Internal)',         icon: '🎛️' },
}

const NODE_CATEGORY_LABELS: Record<string, string> = {
  pg:     'Relational / SQL',
  doc:    'Document / NoSQL',
  vector: 'Vector / AI',
  cache:  'Cache / KV',
  files:  'Object Storage',
  ctrl:   'Internal',
}
`

src = src.slice(0, closingIdx + 1) + injection + src.slice(closingIdx + 1)

// ── 2. Remove the duplicate block that was injected inside AddNodeTab ─────────
const badBlock = `// ── Node type master registry ─────────────────────────────────────────────────
// Each entry: category (pg/doc/vector/cache/files/ctrl), label, icon
const NODE_TYPES_META: Record<string, { category: string; icon: string }> = {`

// Find and remove from the bad block start to the closing of NODE_CATEGORY_LABELS
const badStart = src.indexOf('// ── Node type master registry ──')
if (badStart !== -1) {
  // Find where it ends (after NODE_CATEGORY_LABELS closing brace)
  const catLabelsEnd = src.indexOf('}', src.indexOf("NODE_CATEGORY_LABELS", badStart) + 50) + 1
  src = src.slice(0, badStart) + src.slice(catLabelsEnd + 1)
  console.log('Removed duplicate META block')
}

// Also remove the orphaned injection in AddNodeTab area (the one that was from the first patch)
const orphanStart = src.indexOf('// ── Node types master registry (category + icon + label) ─────────────────────\nconst NODE_TYPES_META')
if (orphanStart !== -1) {
  // Find end of NODE_CATEGORY_LABELS there
  const catEnd = src.indexOf('\n}\n', src.indexOf('NODE_CATEGORY_LABELS', orphanStart)) + 3
  src = src.slice(0, orphanStart) + src.slice(catEnd)
  console.log('Removed orphan META block')
}

// ── 3. Also remove the duplicate NODE_FIELD_DEFS that patch-admin-nodes.js added inside AddNodeTab
// It was appended before the const NODE_FIELD_DEFS
// Find the second occurrence of NODE_FIELD_DEFS
const firstFieldDefs  = src.indexOf('const NODE_FIELD_DEFS')
const secondFieldDefs = src.indexOf('const NODE_FIELD_DEFS', firstFieldDefs + 10)
if (secondFieldDefs !== -1) {
  // Remove from // Credential fields to the closing };
  // Find the "Add Node tab" section comment before it
  const sectionComment = src.lastIndexOf('//  Add Node tab', secondFieldDefs)
  // Find the end of the second NODE_FIELD_DEFS (closing };)
  let d = 0, inObjF = false, endF = -1
  for (let i = secondFieldDefs; i < src.length; i++) {
    if (src[i] === '{') { inObjF = true; d++ }
    else if (src[i] === '}' && inObjF) {
      d--
      if (d === 0) { endF = i; break }
    }
  }
  if (endF !== -1) {
    src = src.slice(0, sectionComment) + src.slice(endF + 1)
    console.log('Removed duplicate NODE_FIELD_DEFS in AddNodeTab')
  }
}

// Also remove the duplicate NODE_TYPES line in AddNodeTab
const nodeTypesInFn = src.indexOf('// All supported node types (from NODE_TYPES_META keys)\nconst NODE_TYPES')
if (nodeTypesInFn !== -1) {
  const lineEnd = src.indexOf('\n', src.indexOf('\n', nodeTypesInFn) + 1)
  src = src.slice(0, nodeTypesInFn) + src.slice(lineEnd + 1)
  console.log('Removed duplicate NODE_TYPES in AddNodeTab')
}

fs.writeFileSync(FILE, src, 'utf8')
console.log('✓ admin/index.tsx — NODE_TYPES_META and NODE_CATEGORY_LABELS injected at module level')
