import { createClient } from '@supabase/supabase-js';

/**
 * Vercel serverless function: sync a phone-verified guest's profile & orders.
 *
 * Buyers browse without an account, so their profile normally lives only in the
 * browser. Once a buyer verifies their phone with Supabase phone OTP, the client
 * calls this endpoint with that session's access token. We verify the token
 * server-side and trust the phone it carries — the caller can only ever act on
 * their own verified number, never an arbitrary one they type.
 *
 * With that trusted phone we:
 *   1. optionally upsert the guest profile (name / city / address), and
 *   2. return the saved profile plus the buyer's real orders, looked up by the
 *      phone they gave at checkout (bypassing the guest-order RLS limit via the
 *      service role).
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Reduce any phone shape (E.164, +91…, spaced) to the 10-digit form we key on. */
function last10(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Sync service is not configured (missing Supabase service role)' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing verification token' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // The phone we act on comes from the verified token, never the request body.
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return res.status(401).json({ error: 'Invalid or expired verification' });

    const phone = last10(user.phone);
    if (phone.length !== 10) return res.status(400).json({ error: 'No verified phone on this session' });

    // 1. Optionally persist the profile the buyer just edited.
    const { name, city, address } = req.body ?? {};
    if (name != null || city != null || address != null) {
      const { error: upErr } = await admin.from('guest_profiles').upsert(
        {
          phone,
          name: name ?? null,
          city: city ?? null,
          address: address ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone' },
      );
      if (upErr) throw upErr;
    }

    // 2. Read the saved profile back.
    const { data: profile, error: profErr } = await admin
      .from('guest_profiles')
      .select('phone, name, city, address')
      .eq('phone', phone)
      .maybeSingle();
    if (profErr) throw profErr;

    // 3. Look up the buyer's real orders by the phone captured at checkout.
    const { data: orders, error: ordErr } = await admin
      .from('orders')
      .select(
        'order_number, total, status, created_at, boutique_id, boutique:boutiques(name, tone), items:order_items(product_id, title, price, qty, size)',
      )
      .eq('guest_phone', phone)
      .order('created_at', { ascending: false });
    if (ordErr) throw ordErr;

    return res.status(200).json({ phone, profile: profile ?? null, orders: orders ?? [] });
  } catch (err) {
    console.error('guest-sync failed:', err?.message ?? err);
    return res.status(500).json({ error: 'Could not sync your details. Please try again.' });
  }
}
