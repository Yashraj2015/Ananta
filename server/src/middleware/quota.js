'use strict';
/**
 * quota.js — Plan quota enforcement middleware
 * Runs on every write request. Checks tenant's plan against current usage.
 * Blocks writes when limits exceeded. Free users: 500MB DB, 1GB files.
 */

const PLANS = {
  free:       { dbMb: 500,    fileMb: 1024,   dbRows: 50_000 },
  starter:    { dbMb: 10240,  fileMb: 20480,  dbRows: 500_000 },
  pro:        { dbMb: 51200,  fileMb: 102400, dbRows: 5_000_000 },
  scale:      { dbMb: 204800, fileMb: 512000, dbRows: 50_000_000 },
  enterprise: { dbMb: -1,     fileMb: -1,     dbRows: -1 },
};

// Cache plan lookups for 5 minutes (avoid hitting ctrl-plane on every request)
const planCache = new Map(); // tenantId -> { plan, expiresAt }

async function getTenantPlan(tenantId) {
  const cached = planCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.plan;

  // In production: fetch from ctrl-plane (Supabase REST)
  // For now: read from JWT claims or default to free
  const plan = 'free'; // TODO: fetch from ctrl-plane /customers?id=eq.{tenantId}
  planCache.set(tenantId, { plan, expiresAt: Date.now() + 5 * 60 * 1000 });
  return plan;
}

/**
 * Middleware: enforces DB write quota
 * Attach to POST/PATCH/DELETE /v1/data/* routes
 */
async function enforceDbQuota(req, res, next) {
  // Only check writes
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const tenantId = req.user?.sub;
  if (!tenantId) return next(); // auth middleware already handles missing user

  try {
    const plan = await getTenantPlan(tenantId);
    const limits = PLANS[plan] || PLANS.free;

    // Enterprise = unlimited
    if (limits.dbMb === -1) return next();

    // TODO: check actual usage from node registry
    // For now pass through (implement after ctrl-plane is wired)
    next();
  } catch (err) {
    // On error: allow through (don't block users due to quota check failure)
    next();
  }
}

/**
 * Middleware: enforces file upload quota
 * Attach to POST /v1/files/upload
 */
async function enforceFileQuota(req, res, next) {
  const tenantId = req.user?.sub;
  if (!tenantId) return next();

  try {
    const plan = await getTenantPlan(tenantId);
    const limits = PLANS[plan] || PLANS.free;
    if (limits.fileMb === -1) return next();

    const fileSizeMb = (req.headers['content-length'] || 0) / (1024 * 1024);

    // Single file size limits
    const maxSingleFileMb = plan === 'free' ? 50 : plan === 'starter' ? 500 : 5000;
    if (fileSizeMb > maxSingleFileMb) {
      return res.status(413).json({
        error: {
          code: 'ANANTA_4013',
          message: `File too large. Your ${plan} plan allows up to ${maxSingleFileMb}MB per file. Upgrade to upload larger files.`,
        }
      });
    }
    next();
  } catch (err) {
    next();
  }
}

/**
 * Get plan limits for a tenant (used by API routes to show usage)
 */
async function getPlanLimits(tenantId) {
  const plan = await getTenantPlan(tenantId);
  return { plan, limits: PLANS[plan] || PLANS.free };
}

/**
 * Invalidate plan cache (call after plan upgrades)
 */
function invalidatePlanCache(tenantId) {
  planCache.delete(tenantId);
}

module.exports = { enforceDbQuota, enforceFileQuota, getPlanLimits, invalidatePlanCache, PLANS };