const fs = require('fs')
const path = require('path')

const content = `'use strict'
/**
 * GET /v1/metrics  - full system metrics: CPU, RAM, disk, request counters
 * GET /v1/metrics/live - lightweight: cpu + ram only
 */
const os = require('os')
const { exec } = require('child_process')
const router = require('express').Router()

// In-memory hourly request buckets (index = hour 0-23)
const hourlyBuckets = new Array(24).fill(0)
let todayStart = new Date().setHours(0, 0, 0, 0)

// Express middleware - MUST have (req, res, next) signature
function countRequest(req, res, next) {
  const now = new Date()
  // Reset on midnight crossing
  if (now.getTime() > todayStart + 86400000) {
    hourlyBuckets.fill(0)
    todayStart = new Date().setHours(0, 0, 0, 0)
  }
  hourlyBuckets[now.getHours()]++
  next()
}

// CPU: compare two snapshots 200ms apart
function sampleCpu() {
  return new Promise(resolve => {
    const snap = cpus => cpus.map(c => ({
      idle: c.times.idle,
      total: Object.values(c.times).reduce((a, b) => a + b, 0)
    }))
    const t1 = snap(os.cpus())
    setTimeout(() => {
      const t2 = snap(os.cpus())
      let idle = 0, busy = 0
      t2.forEach((c, i) => {
        const dIdle = c.idle - t1[i].idle
        const dTotal = c.total - t1[i].total
        idle += dIdle
        busy += dTotal - dIdle
      })
      const pct = busy / (busy + idle + 0.001) * 100
      resolve(Math.round(pct * 10) / 10)
    }, 200)
  })
}

// RAM: synchronous, from os module
function getRam() {
  const total = os.totalmem()
  const free  = os.freemem()
  const used  = total - free
  return {
    pct:      Math.round(used / total * 1000) / 10,
    used_gb:  Math.round(used  / 1073741824 * 100) / 100,
    total_gb: Math.round(total / 1073741824 * 100) / 100
  }
}

// Disk: async via exec so we don't block the event loop
function getDisk() {
  return new Promise(resolve => {
    const fallback = { pct: 0, used_gb: 0, total_gb: 0 }
    const cmd = process.platform === 'win32'
      ? 'wmic logicaldisk where "DriveType=3" get FreeSpace,Size /format:csv'
      : "df -k / | tail -1"

    exec(cmd, { timeout: 3000, encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve(fallback)
      try {
        if (process.platform === 'win32') {
          let totalFree = 0, totalSize = 0
          stdout.split('\\n').forEach(line => {
            const cols = line.trim().split(',')
            if (cols.length >= 3 && /^\\d+$/.test(cols[1]) && /^\\d+$/.test(cols[2])) {
              totalFree += Number(cols[1])
              totalSize += Number(cols[2])
            }
          })
          if (!totalSize) return resolve(fallback)
          const used = totalSize - totalFree
          resolve({
            pct:      Math.round(used / totalSize * 1000) / 10,
            used_gb:  Math.round(used      / 1073741824 * 100) / 100,
            total_gb: Math.round(totalSize / 1073741824 * 100) / 100
          })
        } else {
          const cols = stdout.trim().split(/\\s+/)
          const total = Number(cols[1]) * 1024
          const used  = Number(cols[2]) * 1024
          resolve({
            pct:      Math.round(used / total * 1000) / 10,
            used_gb:  Math.round(used  / 1073741824 * 100) / 100,
            total_gb: Math.round(total / 1073741824 * 100) / 100
          })
        }
      } catch { resolve(fallback) }
    })
  })
}

// GET /v1/metrics
router.get('/', async (req, res) => {
  try {
    const [cpu, ram, disk] = await Promise.all([sampleCpu(), Promise.resolve(getRam()), getDisk()])
    const total_requests_today = hourlyBuckets.reduce((a, b) => a + b, 0)
    const requests_by_hour = hourlyBuckets.map((count, hour) => ({
      time: String(hour).padStart(2, '0') + ':00',
      requests: count
    }))
    res.json({
      cpu:  { pct: cpu },
      ram,
      disk,
      uptime_secs: Math.floor(process.uptime()),
      total_requests_today,
      requests_by_hour,
      node_version: process.version
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /v1/metrics/live - lightweight, no disk exec
router.get('/live', async (req, res) => {
  const [cpu, ram] = await Promise.all([sampleCpu(), Promise.resolve(getRam())])
  res.json({ cpu: { pct: cpu }, ram, uptime_secs: Math.floor(process.uptime()) })
})

module.exports = { router, countRequest }
`

const file = path.join('d:\\\\Smars\\\\Smars\\\\Ananta\\\\server\\\\src\\\\api\\\\routes\\\\metrics.js')
fs.writeFileSync(file, content, { encoding: 'utf8', flag: 'w' })
console.log('Written', file)
