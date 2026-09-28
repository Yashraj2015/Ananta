'use strict';
/**
 * /v1/billing/* — Razorpay billing integration
 *
 * POST /v1/billing/order        — create a Razorpay order for a plan upgrade
 * POST /v1/billing/verify       — verify payment signature, upgrade plan in DB
 * GET  /v1/billing/plans        — return all available plans + pricing (INR)
 * POST /v1/billing/webhook      — Razorpay webhook for async events (subscription renewal etc.)
 */
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

// ── Config ────────────────────────────────────────────────────────────────────

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID     || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

let Razorpay;
try { Razorpay = require('razorpay'); } catch { Razorpay = null; }

function getRazorpay() {
  if (!Razorpay || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
}

// ── Plans definition (INR pricing) ────────────────────────────────────────────

const PLANS = {
  free: {
    name:       'Free',
    price_inr:  0,
    price_label: '₹0 / month',
    db_mb:      500,
    file_mb:    1024,
    db_rows:    50_000,
    vector_records: 10_000,
    cache_mb:   32,
    features:   ['1 SQL DB (500MB)', '1 Document DB', '10k vector records', '1GB file storage', 'Community support'],
  },
  starter: {
    name:       'Starter',
    price_inr:  49900,      // ₹499/month in paise
    price_label: '₹499 / month',
    db_mb:      5_000,
    file_mb:    10_240,
    db_rows:    1_000_000,
    vector_records: 100_000,
    cache_mb:   256,
    features:   ['5GB SQL DB', '5GB Document DB', '100k vector records', '10GB file storage', 'Email support'],
  },
  pro: {
    name:       'Pro',
    price_inr:  199900,     // ₹1,999/month in paise
    price_label: '₹1,999 / month',
    db_mb:      50_000,
    file_mb:    102_400,
    db_rows:    10_000_000,
    vector_records: 1_000_000,
    cache_mb:   1024,
    features:   ['50GB SQL DB', '50GB Document DB', '1M vector records', '100GB file storage', 'Priority support', 'Dedicated nodes'],
  },
  enterprise: {
    name:       'Enterprise',
    price_inr:  null,
    price_label: 'Custom pricing',
    db_mb:      null,
    file_mb:    null,
    db_rows:    null,
    vector_records: null,
    cache_mb:   null,
    features:   ['Unlimited resources', 'Custom SLA', 'Dedicated infrastructure', 'Phone support', '99.99% uptime SLA'],
  },
};

// ── Shared helpers ────────────────────────────────────────────────────────────

function parseJWT(token) {
  try {
    const b = token.split('.')[1];
    const base64 = b.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '==='.slice(0, (4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: { message: 'Authorization required' } });
  const payload = parseJWT(token);
  if (!payload?.email) return res.status(401).json({ error: { message: 'Invalid token' } });
  if (payload.exp < Date.now() / 1000) return res.status(401).json({ error: { message: 'Token expired' } });
  req.user = payload;
  next();
}

let _pool = null;
function getPool() {
  if (_pool) return _pool;
  const { Pool } = require('pg');
  _pool = new Pool({
    connectionString: process.env.CTRL_PLANE_POOLER_URL || process.env.CTRL_PLANE_DIRECT,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return _pool;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /v1/billing/plans — public, no auth needed
router.get('/plans', (req, res) => {
  const publicPlans = Object.entries(PLANS).map(([id, p]) => ({
    id,
    name:           p.name,
    price_label:    p.price_label,
    price_inr_paise: p.price_inr,
    features:       p.features,
    db_mb:          p.db_mb,
    file_mb:        p.file_mb,
    vector_records: p.vector_records,
  }));
  res.json({ plans: publicPlans });
});

// POST /v1/billing/order — create Razorpay order for plan upgrade
router.post('/order', requireAuth, express.json(), async (req, res) => {
  const { plan } = req.body || {};
  if (!plan || !PLANS[plan]) return res.status(400).json({ error: { message: 'Invalid plan' } });
  if (plan === 'free')       return res.status(400).json({ error: { message: 'No payment needed for free plan' } });
  if (plan === 'enterprise') return res.status(400).json({ error: { message: 'Contact sales for enterprise pricing' } });

  const rzp = getRazorpay();
  if (!rzp) {
    return res.status(503).json({ error: { message: 'Billing is not configured yet. Contact support.' } });
  }

  const planDef = PLANS[plan];

  try {
    const order = await rzp.orders.create({
      amount:   planDef.price_inr,  // in paise
      currency: 'INR',
      receipt:  `ananta_${req.user.email}_${plan}_${Date.now()}`,
      notes: {
        email:    req.user.email,
        plan,
      },
    });

    // Store order ID in DB for verification step
    const p = getPool();
    await p.query(
      `UPDATE customers SET razorpay_customer_id = $1 WHERE email = $2`,
      [order.id, req.user.email]
    );

    res.json({
      order_id:  order.id,
      amount:    order.amount,
      currency:  order.currency,
      key_id:    RAZORPAY_KEY_ID,
      plan,
      plan_name: planDef.name,
    });
  } catch (err) {
    console.error('[billing] order creation failed:', err.message);
    res.status(500).json({ error: { message: 'Failed to create payment order' } });
  }
});

// POST /v1/billing/verify — verify Razorpay signature + upgrade plan
router.post('/verify', requireAuth, express.json(), async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
    return res.status(400).json({ error: { message: 'Missing payment verification fields' } });
  }
  if (!PLANS[plan] || plan === 'free') {
    return res.status(400).json({ error: { message: 'Invalid plan' } });
  }

  // Verify the HMAC-SHA256 signature from Razorpay
  const body       = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected   = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(body).digest('hex');
  const isValid    = expected === razorpay_signature;

  if (!isValid) {
    console.warn('[billing] invalid signature for', req.user.email);
    return res.status(400).json({ error: { message: 'Payment verification failed' } });
  }

  // Upgrade plan in DB
  const p = getPool();
  const cycleEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  try {
    await p.query(
      `UPDATE customers
       SET plan = $1, billing_plan = $1, billing_cycle_end = $2,
           storage_quota_mb = $3, db_row_quota = $4, updated_at = NOW()
       WHERE email = $5`,
      [plan, cycleEnd, PLANS[plan].db_mb, PLANS[plan].db_rows, req.user.email]
    );

    // Audit log
    try {
      const { writeAuditLog } = require('../provisioner');
      await writeAuditLog(req.user.email, 'plan_upgraded', {
        plan,
        payment_id: razorpay_payment_id,
        order_id:   razorpay_order_id,
      });
    } catch {}

    res.json({
      message:    `Successfully upgraded to ${PLANS[plan].name}`,
      plan,
      cycle_end:  cycleEnd.toISOString(),
    });
  } catch (err) {
    console.error('[billing] plan upgrade failed:', err.message);
    res.status(500).json({ error: { message: 'Plan upgrade failed' } });
  }
});

// POST /v1/billing/webhook — Razorpay async webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Verify webhook signature
  const sig  = req.headers['x-razorpay-signature'] || '';
  const body = req.body?.toString?.() || '';

  if (RAZORPAY_WEBHOOK_SECRET) {
    const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
    if (expected !== sig) {
      return res.status(400).json({ error: { message: 'Invalid webhook signature' } });
    }
  }

  let event;
  try { event = JSON.parse(body); } catch {
    return res.status(400).json({ error: { message: 'Invalid JSON' } });
  }

  // Handle subscription events (for future monthly subscription support)
  if (event.event === 'subscription.charged') {
    const email = event.payload?.subscription?.entity?.notes?.email;
    const plan  = event.payload?.subscription?.entity?.notes?.plan;
    if (email && plan && PLANS[plan]) {
      const p = getPool();
      const cycleEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await p.query(
        `UPDATE customers SET billing_cycle_end = $1, updated_at = NOW() WHERE email = $2`,
        [cycleEnd, email]
      ).catch(e => console.error('[billing] webhook renewal failed:', e.message));
    }
  }

  res.json({ received: true });
});

module.exports = router;
