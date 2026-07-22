import { serviceClient } from './_supabase.js';
import { enforceRateLimit } from './_rateLimit.js';

/**
 * Vercel serverless function: is checkout actually able to work right now?
 *
 * This exists because of a failure that was invisible from the outside. The
 * browser talks to Supabase with the anon key, so the catalogue, product pages
 * and the whole shop kept rendering perfectly — while /api/place-order, which
 * uses the SERVICE-ROLE key, could not read a single row. Every checkout ended
 * on "Could not place the order. Please try again.", and nothing on the site
 * distinguished that from a transient glitch.
 *
 * The two credentials are configured in different places (the anon key is baked
 * into the build, the service-role key lives only in the Vercel project's
 * environment variables), so one can rot without the other. This endpoint is the
 * cheapest way to tell them apart: hit it after any deploy or key rotation and
 * it says, in one line, whether orders can be written.
 *
 * Deliberately returns no secrets — only whether each dependency is configured,
 * whether the round-trip worked, and the provider's own error text when it
 * didn't ("Invalid API key" and friends, which is the part you need).
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

function configured(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return v !== '' && v !== 'undefined' && v !== 'null';
}

/**
 * Round-trip the service-role client against a table every order write needs.
 * `head: true` fetches no rows — this is a permission and reachability probe,
 * not a data read.
 */
async function checkDatabase() {
  if (!configured(supabaseUrl)) {
    return { ok: false, error: 'SUPABASE_URL (or VITE_SUPABASE_URL) is not set' };
  }
  if (!configured(serviceRoleKey)) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set' };
  }

  const supabase = serviceClient(supabaseUrl, serviceRoleKey);
  if (!supabase) return { ok: false, error: 'Supabase service client could not be created' };

  try {
    const { error } = await supabase.from('products').select('id', { count: 'exact', head: true }).limit(1);
    if (error) return { ok: false, error: error.message || 'Unknown PostgREST error', code: error.code };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { key: 'health', limit: 30, windowMs: 60_000 }))) return;

  const database = await checkDatabase();
  const razorpay = { ok: configured(razorpayKeyId) && configured(razorpayKeySecret) };
  if (!razorpay.ok) razorpay.error = 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not both set';

  // Orders need both: the gateway to take the money and the service role to
  // write the row. Either one down means checkout is down.
  const checkoutReady = database.ok && razorpay.ok;

  res.setHeader('Cache-Control', 'no-store');
  return res.status(checkoutReady ? 200 : 503).json({
    checkoutReady,
    database,
    razorpay,
    checkedAt: new Date().toISOString(),
  });
}
