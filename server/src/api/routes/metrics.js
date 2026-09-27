/**
 * GET /v1/metrics
 * Real system metrics: CPU, RAM, disk, request counters (hourly buckets)
 */
const os = require('os')
const { execSync } = require('child_process')
const router = require('express').Router()

// ─── In-memory request counters (persisted per hour) ─────────────────────────
const hourlyBuckets = new Array(24).fill(0)   // index = hour of day
let todayStart = new Date().setHours(0, 0, 0, 0)

// Middleware to count every request hitting the API server (call from server.js)
function countRequest() {
  const now = new Date()
  // Reset daily counter if we crossed midnight
  if (now.getTime() > todayStart + 86400000) {
    hourlyBuckets.fill(0)
    todayStart = now.setHours(0, 0, 0, 0)
  }
  hourlyBuckets[now.getHours()]++
}

// ─── CPU sampling (compares two snapshots 200ms apart) ────────────────────────
function sampleCpu() {
  return new Promise(resolve => {
    const snap = (cpus) => cpus.map(c => ({ idle: c.times.idle, total: Object.values(c.times).reduce((a, b) => a + b, 0) }))
    const t1 = snap(os.cpus())
    setTimeout(() => {
      const t2 = snap(os.cpus())
      let totalIdle = 0, totalBusy = 0
      t2.forEach((c, i) => {
        totalIdle += c.idle - t1[i].idle
        totalBusy += (c.total - t1[i].total) - (c.idle - t1[i].idle)
      })
      const pct = totalBusy / (totalBusy + totalIdle + 0.001) * 100
      resolve(Math.round(pct * 10) / 10)
    }, 200)
  })
}

// ─── RAM ─────────────────────────────────────────────────────────────────────
function getRam() {
  const total = os.totalmem()
  const free  = os.freemem()
  const used  = total - free
  return {
    pct:      Math.round(used / total * 100 * 10) / 10,
    used_gb:  Math.round(used  / 1024 ** 3 * 100) / 100,
    total_gb: Math.round(total / 1024 ** 3 * 100) / 100,
  }
}

// ─── Disk (Windows: wmic; Linux/Mac: df) ─────────────────────────────────────
function getDisk() {
  try {
    const isWin = process.platform === 'win32'
    if (isWin) {
      const raw = execSync(
        'wmic logicaldisk where "DriveType=3" get FreeSpace,Size /format:csv 2>nul',
        { encoding: 'utf8', timeout: 3000 }
      )
      let totalFree = 0, totalSize = 0
      raw.split('\n').forEach(line => {
        const cols = line.trim().split(',')
        if (cols.length >= 3 && !isNaN(Number(cols[1])) && !isNaN(Number(cols[2]))) {
          totalFree += Number(cols[1])
          totalSize += Number(cols[2])
        }
      })
      if (totalSize === 0) return { pct: 0, used_gb: 0, total_gb: 0 }
      const used = totalSize - totalFree
      return {
        pct:      Math.round(used / totalSize * 100 * 10) / 10,
        used_gb:  Math.round(used     / 1024 ** 3 * 100) / 100,
        total_gb: Math.round(totalSize / 1024 ** 3 * 100) / 100,
      }
    } else {
      const raw = execSync("df -k / | tail -1", { encoding: 'utf8', timeout: 3000 })
      const cols = raw.trim().split(/\s+/)
      const total = Number(cols[1]) * 1024
      const used  = Number(cols[2]) * 1024
      return {
        pct:      Math.round(used / total * 100 * 10) / 10,
        used_gb:  Math.round(used  / 1024 ** 3 * 100) / 100,
        total_gb: Math.round(total / 1024 ** 3 * 100) / 100,
      }
    }
  } catch {
    return { pct: 0, used_gb: 0, total_gb: 0 }
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /v1/metrics — full system metrics
router.get('/', async (req, res) => {
  try {
    const [cpu, ram, disk] = await Promise.all([sampleCpu(), Promise.resolve(getRam()), Promise.resolve(getDisk())])
    const total_requests_today = hourlyBuckets.reduce((a, b) => a + b, 0)
    const requests_by_hour = hourlyBuckets.map((count, hour) => ({
      time: `${String(hour).padStart(2, '0')}:00`,
      requests: count,
    }))
    res.json({
      cpu:  { pct: cpu },
      ram,
      disk,
      uptime_secs: Math.floor(process.uptime()),
      total_requests_today,
      requests_by_hour,
      node_version: process.version,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /v1/metrics/live — lightweight ping (cpu + ram only, no disk exec)
router.get('/live', async (req, res) => {
  const cpu = await sampleCpu()
  const ram = getRam()
  res.json({ cpu: { pct: cpu }, ram, uptime_secs: Math.floor(process.uptime()) })
})

module.exports = { router, countRequest }
