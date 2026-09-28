/**
 * patch-activity-section.js
 * Wires AnantaActivitySection to fetch real requests_by_hour from /v1/metrics
 */
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'supabase/apps/studio/components/interfaces/ProjectHome/AnantaActivitySection.tsx')
let src = fs.readFileSync(FILE, 'utf8')

// Add imports for useEffect and ANANTA_API_URL
if (!src.includes('useEffect')) {
  src = src.replace("import { useState, useRef, useCallback } from 'react'", "import { useState, useRef, useCallback, useEffect } from 'react'")
}
if (!src.includes('ANANTA_API_URL')) {
  src = src.replace("import { ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react'", "import { ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react'\nimport { ANANTA_API_URL } from '@/lib/ananta-config'")
}

// Replace the Main export
const mainStart = src.indexOf('export function AnantaActivitySection() {')
const newMain = `export function AnantaActivitySection() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [showPicker, setShowPicker] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [services, setServices] = useState<ServiceData[]>(INITIAL_DATA)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const r = await fetch(\`\${ANANTA_API_URL}/v1/metrics\`, { cache: 'no-store' })
        if (!r.ok) return
        const data = await r.json()
        if (!mounted) return
        
        // Map backend metrics to our ServiceData format
        // The backend returns requests_by_hour: { time: string, requests: number }[]
        const hourly = data.requests_by_hour || []
        
        // Build 32 bars out of the hourly data (we'll just use the 24 hours + pad)
        const bars: BarPoint[] = hourly.map((h: any) => ({
          ts: h.time,
          value: h.requests,
          type: 'normal'
        }))
        while (bars.length < 32) bars.push({ ts: '', value: 0, type: 'normal' })
        
        const totalReq = data.total_requests_today || 0

        setServices([
          { id: 'api-gateway',    label: 'API GATEWAY',    total: totalReq, warnings: 0, errors: 0, bars: bars, startLabel: '00:00', endLabel: '23:00' },
          { id: 'postgres',       label: 'POSTGRES',       total: totalReq, warnings: 0, errors: 0, bars: bars, startLabel: '00:00', endLabel: '23:00' },
          { id: 'storage',        label: 'STORAGE',        total: 0, warnings: 0, errors: 0, bars: makeBars(3, 0, 0, 0), startLabel: '00:00', endLabel: '23:00' },
          { id: 'realtime',       label: 'REALTIME',       total: 0, warnings: 0, errors: 0, bars: makeBars(4, 0, 0, 0), startLabel: '00:00', endLabel: '23:00' },
          { id: 'edge-functions', label: 'EDGE FUNCTIONS', total: 0, warnings: 0, errors: 0, bars: makeBars(5, 0, 0, 0), startLabel: '00:00', endLabel: '23:00' },
          { id: 'auth',           label: 'AUTH',           total: 0, warnings: 0, errors: 0, bars: makeBars(6, 0, 0, 0), startLabel: '00:00', endLabel: '23:00' },
        ])
      } catch (err) {}
      finally { if (mounted) setLoading(false) }
    }
    load()
    const id = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const total       = services.reduce((s, c) => s + c.total, 0)
  const totalErrors = services.reduce((s, c) => s + c.errors, 0)
  const successRate = total === 0 ? 100 : Math.round(((total - totalErrors) / total) * 1000) / 10

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 240 : -240, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-foreground font-semibold text-base tabular-nums">
            {loading ? '...' : total.toLocaleString()} Total Requests
          </span>
          <span className="text-brand font-semibold text-base">
            {loading ? '...' : successRate}% Success Rate
          </span>
        </div>`

if (mainStart !== -1) {
  const oldHeaderEnd = src.indexOf('        <div className="relative">', mainStart)
  if (oldHeaderEnd !== -1) {
    src = src.slice(0, mainStart) + newMain + '\n' + src.slice(oldHeaderEnd)
    fs.writeFileSync(FILE, src, 'utf8')
    console.log('✓ AnantaActivitySection.tsx — wired to real /v1/metrics')
  } else { console.error('Could not find relative header end') }
} else { console.error('Could not find mainStart') }
