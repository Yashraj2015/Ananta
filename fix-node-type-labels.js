/**
 * fix-node-type-labels.js
 * Makes NODE_TYPE_LABELS a derived map from NODE_TYPES_META so NodesTab
 * renders all 20+ node types (not just the 5 original ones).
 */
const fs = require('fs')
let src = fs.readFileSync('supabase/apps/studio/pages/admin/index.tsx', 'utf8')

// Remove the old static NODE_TYPE_LABELS block
const labelStart = src.indexOf('const NODE_TYPE_LABELS:')
const labelEnd = src.indexOf('\n}\n', labelStart) + 3
src = src.slice(0, labelStart) + src.slice(labelEnd)

// Find the end of NODE_CATEGORY_LABELS block, insert derived map after it
const catClose = src.indexOf('\n}\n', src.indexOf('const NODE_CATEGORY_LABELS:')) + 3
const derived = [
  '',
  '// Derived from NODE_TYPES_META — covers all 20+ node types for the Nodes tab',
  'const NODE_TYPE_LABELS: Record<string, { label: string; icon: string }> = Object.fromEntries(',
  '  Object.entries(NODE_TYPES_META).map(([k, v]) => [k, { label: v.label, icon: v.icon }])',
  ')',
  '',
].join('\n')

src = src.slice(0, catClose) + derived + src.slice(catClose)
fs.writeFileSync('supabase/apps/studio/pages/admin/index.tsx', src, 'utf8')
console.log('Done — NODE_TYPE_LABELS now derived from NODE_TYPES_META (20+ types)')
