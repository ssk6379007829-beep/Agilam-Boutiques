/**
 * Best-effort in-memory rate limiter (M-01).
 *
 * Serverless instances are ephemeral and run in parallel, so this is a
 * per-instance first line of defence against a single client hammering an
 * endpoint — NOT a global quota. For hard, cross-instance limits, front this
 * with Upstash/Redis and key on the same IP. Documented as partial on purpose.
 *
 * The leading underscore keeps this out of Vercel's /api routing.
 */

const buckets = new Map();

function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Fixed-window limiter. Returns { ok, retryAfter } — on !ok, retryAfter is the
 * seconds until the window resets.
 */
export function rateLimit(req, { key = 'default', limit = 30, windowMs = 60_000 } = {}) {
  const id = `${key}:${clientIp(req)}`;
  const now = Date.now();
  const entry = buckets.get(id);

  if (!entry || now > entry.reset) {
    buckets.set(id, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((entry.reset - now) / 1000)) };
  }
  return { ok: true, remaining: limit - entry.count };
}

/** Applies a limit and, if exceeded, writes a 429 and returns false. */
export function enforceRateLimit(req, res, opts) {
  const result = rateLimit(req, opts);
  if (!result.ok) {
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    return false;
  }
  return true;
}

// Periodic cleanup so the map can't grow unbounded on a long-lived instance.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}, 5 * 60_000);
sweep.unref?.();
