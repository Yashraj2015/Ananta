#!/usr/bin/env node
/**
 * replace-localhost.js
 * Replaces all localhost:8080 hardcodes in Studio .tsx/.ts files
 * with the centralized ANANTA_API_URL import from @/lib/ananta-config
 */
const fs = require('fs')
const path = require('path')

const STUDIO = 'd:\\Smars\\Smars\\Ananta\\supabase\\apps\\studio'

// ── Helper ────────────────────────────────────────────────────────────────────
function patch(relPath, fn) {
  const fullPath = path.join(STUDIO, relPath)
  let content = fs.readFileSync(fullPath, 'utf8')
  const updated = fn(content)
  if (updated === content) {
    console.log(`  ~ unchanged: ${relPath}`)
    return
  }
  fs.writeFileSync(fullPath, updated, 'utf8')
  console.log(`  ✓ patched:   ${relPath}`)
}

// ── pages/sign-in.tsx ─────────────────────────────────────────────────────────
patch('pages/sign-in.tsx', content => {
  // Add import if not already there
  if (!content.includes('ananta-config')) {
    content = content.replace(
      `import Head from 'next/head'`,
      `import Head from 'next/head'\nimport { ANANTA_API_URL } from '@/lib/ananta-config'`
    )
  }
  // Replace the hardcoded URL
  content = content.replace(
    `window.location.href = 'http://localhost:8080/v1/auth/google'`,
    `window.location.href = \`\${ANANTA_API_URL}/v1/auth/google\``
  )
  return content
})

// ── pages/account/me.tsx ──────────────────────────────────────────────────────
patch('pages/account/me.tsx', content => {
  // Add import if not already there
  if (!content.includes('ananta-config')) {
    content = content.replace(
      `import { useAnantaAuth } from '@/hooks/useAnantaAuth'`,
      `import { useAnantaAuth } from '@/hooks/useAnantaAuth'\nimport { ANANTA_API_URL } from '@/lib/ananta-config'`
    )
  }
  // Replace the const
  content = content.replace(
    `const API = 'http://localhost:8080'`,
    `const API = ANANTA_API_URL`
  )
  return content
})

// ── pages/admin/index.tsx ─────────────────────────────────────────────────────
patch('pages/admin/index.tsx', content => {
  // Add import if not already there
  if (!content.includes('ananta-config')) {
    // Insert after the first import block
    content = content.replace(
      `import { cn } from 'ui'`,
      `import { cn } from 'ui'\nimport { ANANTA_API_URL, ANANTA_ADMIN_KEY } from '@/lib/ananta-config'`
    )
  }
  // Replace const API and ADMIN_KEY declarations
  content = content.replace(
    `const API      = 'http://localhost:8080'`,
    `const API      = ANANTA_API_URL`
  )
  content = content.replace(
    /const ADMIN_KEY\s*=\s*'dev-broker-key-change-in-production'/g,
    `const ADMIN_KEY = ANANTA_ADMIN_KEY`
  )
  // Replace any remaining inline localhost:8080 in fetch calls (e.g. in OverviewTab metrics fetch)
  content = content.replace(
    /fetch\('http:\/\/localhost:8080\/v1\/metrics'\)/g,
    "fetch(`${ANANTA_API_URL}/v1/metrics`)"
  )
  content = content.replace(
    /fetch\('http:\/\/localhost:8080\/v1\/metrics\/live'\)/g,
    "fetch(`${ANANTA_API_URL}/v1/metrics/live`)"
  )
  return content
})

// ── components/interfaces/ProjectHome/TopSection.tsx ─────────────────────────
patch('components/interfaces/ProjectHome/TopSection.tsx', content => {
  if (!content.includes('ananta-config')) {
    content = content.replace(
      `import { useEffect, useState } from 'react'`,
      `import { useEffect, useState } from 'react'\nimport { ANANTA_API_URL } from '@/lib/ananta-config'`
    )
  }
  content = content.replace(
    /const ANANTA_METRICS_URL\s*=\s*'http:\/\/localhost:8080\/v1\/metrics'/g,
    `const ANANTA_METRICS_URL = \`\${ANANTA_API_URL}/v1/metrics\``
  )
  // Also replace any direct inline fetch with localhost
  content = content.replace(
    /fetch\('http:\/\/localhost:8080\/v1\/metrics'\)/g,
    "fetch(`${ANANTA_API_URL}/v1/metrics`)"
  )
  return content
})

console.log('\nAll localhost:8080 hardcodes replaced in Studio.\n')
console.log('NEXT_PUBLIC_API_URL env var now controls all API URLs.')
console.log('Add to .env.local: NEXT_PUBLIC_API_URL=http://localhost:8080 (dev)')
console.log('Add to production: NEXT_PUBLIC_API_URL=https://api.yourdomain.com\n')
