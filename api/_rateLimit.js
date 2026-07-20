/**
 * Rate limiter (M-01) with an optional cross-instance backend.
 *
 * Two tiers:
 *   1. Upstash Redis (REST) — a true GLOBAL fixed-window limit shared across all
 *      serverless instances, used when UPSTASH_REDIS_REST_URL +
 *      UPSTASH_REDIS_REST_TOKEN are configured. Uses fetch(), so no extra
 *      dependency is added.
 *   2. In-memory fallback — a per-instance first line of defence used when
 *      Upstash isn't configured, or if a Redis call fails (fail-open so a Redis
 *      outage can never block checkout).
 *
 * The leading underscore keeps this out of Vercel's /api routing.
 */

const buckets = new Map();

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisEnabled = Boolean(REDIS_URL && REDIS_TOKEN);

function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/** Per-instance fixed-window limiter (fallback / no-Redis path). */
function rateLimitMemory(id, limit, windowMs) {
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

/**
 * Global fixed-window limiter backed by Upstash Redis REST. One pipelined
 * round-trip: INCR the counter, set its TTL only on first hit (PEXPIRE NX), and
 * read the remaining TTL for Retry-After. Throws on any transport error so the
 * caller can fall back to memory.
 */
async function rateLimitRedis(id, limit, windowMs) {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', id],
      ['PEXPIRE', id, String(windowMs), 'NX'],
      ['PTTL', id],
    ]),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const out = await res.json();
  const count = Number(out?.[0]?.result ?? 0);
  const pttl = Number(out?.[2]?.result ?? windowMs);
  if (count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((pttl > 0 ? pttl : windowMs) / 1000)) };
  }
  return { ok: true, remaining: Math.max(0, limit - count) };
}

/**
 * Fixed-window limiter. Returns { ok, retryAfter } — on !ok, retryAfter is the
 * seconds until the window resets. Async because the Redis backend does I/O.
 */
export async function rateLimit(req, { key = 'default', limit = 30, windowMs = 60_000 } = {}) {
  const id = `rl:${key}:${clientIp(req)}`;
  if (redisEnabled) {
    try {
      return await rateLimitRedis(id, limit, windowMs);
    } catch (err) {
      // Fail open to the per-instance limiter — never block traffic on a Redis blip.
      console.error('rateLimit: Upstash unavailable, using in-memory fallback:', err?.message ?? err);
    }
  }
  return rateLimitMemory(id, limit, windowMs);
}

/** Applies a limit and, if exceeded, writes a 429 and returns false. */
export async function enforceRateLimit(req, res, opts) {
  const result = await rateLimit(req, opts);
  if (!result.ok) {
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    return false;
  }
  return true;
}

// Periodic cleanup so the in-memory map can't grow unbounded on a long-lived instance.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}, 5 * 60_000);
sweep.unref?.();
