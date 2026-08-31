/**
 * Welcome email — the first message a new buyer or boutique owner gets from us.
 *
 * WHY THIS IS AN EDGE FUNCTION AND NOT `api/`
 * `api/` holds exactly 12 routes, the Vercel Hobby ceiling; a thirteenth fails
 * the deploy. Same escape hatch as broadcast-email, payout-advice and the
 * Shiprocket pair. It also belongs here on merit: the caller is a Postgres
 * webhook, not a browser, so there is no reason to route it through the
 * frontend's serverless project at all.
 *
 * HOW IT IS CALLED
 * A Supabase Database Webhook on `profiles` INSERT (see 0105 and
 * docs/setup/WELCOME_EMAIL.md) POSTs the standard `{ type, table, record }`
 * envelope. A `{ user_id }` body is accepted too, which is how you resend one by
 * hand after clearing the marker.
 *
 * WHO MAY CALL IT
 * The service role, and nothing else. The bearer token is compared against
 * SUPABASE_SERVICE_ROLE_KEY directly rather than decoded, because the only
 * legitimate caller already holds that exact key — there is no second
 * service-role identity to distinguish, so a string compare is both stricter
 * and harder to get wrong than trusting a parsed `role` claim. Without this the
 * gateway's own JWT check would happily admit any signed-in buyer, and mailing
 * an arbitrary account id is a nuisance vector.
 *
 * EXACTLY ONCE
 * `profiles.welcome_email_sent_at` is the lock, not a log. The claim is a
 * guarded UPDATE … WHERE welcome_email_sent_at IS NULL that returns the row it
 * took; if it returns nothing, someone else already has it and we stop.
 *
 * Note what this does and does not buy. Supabase Database Webhooks run on
 * pg_net: the delivery is fire-and-forget and is NOT retried automatically, so
 * the lock is not defending against an automatic retry storm. It defends
 * against the deliveries that do repeat — a hook configured twice, a manual
 * resend, a catch-up script over the pending queue, a restore that replays
 * inserts. Those are rare and a duplicate welcome is cheap, but the guard costs
 * one WHERE clause.
 *
 * The absence of retries is why a failed send RELEASES the claim instead of
 * keeping it. Nothing is coming back to try again, so the row has to be left
 * looking owed: `welcome_email_sent_at is null` on an old profile is the queue
 * of people who never got theirs, and the resend recipe in
 * docs/setup/WELCOME_EMAIL.md drains it.
 *
 * FAILURE POSTURE
 * Always 200 unless the CALLER is wrong. A webhook is not a user waiting on an
 * answer, and a non-2xx here buys nothing but a red row in the dashboard's
 * delivery log — so "skipped" and "provider refused" both report success with a
 * reason in the body, and the real detail goes to the function log.
 *
 * DEPLOY
 *   supabase functions deploy welcome-email
 *   supabase secrets set RESEND_API_KEY=... EMAIL_FROM=... APP_URL=...
 * Leave JWT verification ON — the webhook sends the service-role key as its
 * Authorization header, so the gateway check and the compare above agree.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const BRAND = 'MangaiMart';
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://mangaimart.com').replace(/\/$/, '');
const SUPPORT_EMAIL = 'support@mangaimart.com';

/**
 * The `From` header, always carrying a display name.
 *
 * `EMAIL_FROM` is set in three separate places — Vercel, Supabase secrets and
 * the local `.env` — and nothing kept them in step, so a bare `noreply@` in any
 * one of them made that path's mail arrive from a raw address while everything
 * else arrived from "MangaiMart". Normalising here means the header is right
 * whatever the var says. A value that already contains `<` is left alone:
 * someone chose that display name deliberately. Mirrors `senderFrom()` in
 * api/_email.js.
 */
const senderFrom = (raw: string | undefined, brand = 'MangaiMart') => {
  const value = (raw ?? '').trim() || 'noreply@mangaimart.com';
  return value.includes('<') ? value : `${brand} <${value}>`;
};


/**
 * The wordmark. Pinned to the production origin rather than derived from
 * APP_URL — that is localhost in a dev environment, and a localhost logo is a
 * broken image in every inbox it reaches. PNG, not the smaller WebP beside it in
 * /public: Outlook on Windows cannot decode WebP and falls back to alt text.
 * Mirrors api/_email.js and broadcast-email.
 */
const LOGO_URL = Deno.env.get('EMAIL_LOGO_URL') ?? 'https://mangaimart.com/mangaimart-wordmark.png';

/**
 * The one stylesheet an email is allowed — a refinement, never a requirement.
 * A client that strips `<style>` shows the inline values, which are sized to be
 * correct on their own. Mirrors HEAD_STYLE in api/_email.js and broadcast-email;
 * change all three shells together.
 */
const HEAD_STYLE = `<style>
  body, table, td, p, h1, li, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; text-size-adjust:100%; }
  @media only screen and (max-width:600px) {
    .ag-pad { padding-left:18px !important; padding-right:18px !important; }
    .ag-h1 { font-size:19px !important; line-height:1.32 !important; }
    .ag-logo { width:168px !important; }
    .ag-body p, .ag-body li { font-size:13.5px !important; line-height:1.6 !important; }
    .ag-btn { font-size:13.5px !important; padding:12px 22px !important; }
    .ag-small { font-size:11px !important; }
  }
</style>`;

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isValidEmail = (email: unknown): email is string =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/**
 * The greeting name.
 *
 * 0028 seeds `full_name` with the literal placeholder 'New user' when signup
 * metadata carried no name, which is most password and OTP signups. "Welcome,
 * New user" is worse than no name at all, so both placeholders fall back to a
 * plain greeting. Only the first word is used — people give their full legal
 * name at signup, and a mail that opens "Welcome, Priya" reads human where
 * "Welcome, Priya Ramanathan Subramaniam" reads like a database.
 */
function greetingName(fullName: unknown): string {
  const clean = String(fullName ?? '').trim();
  if (!clean || clean === 'New user' || clean === 'Customer') return '';
  return clean.split(/\s+/)[0];
}

type Role = 'buyer' | 'seller';

/**
 * What each account is for, in the reader's terms.
 *
 * Two audiences, one shell. A buyer wants to know the shop is worth opening; a
 * boutique owner has just started a wizard and wants to know what finishing it
 * gets them. Sending both the same "welcome to MangaiMart" would waste the one
 * message a new seller is guaranteed to read.
 *
 * Deliberately NOT here: a discount code, a referral ask, an app-store banner.
 * This is the first thing we ever send; its job is to establish the sender
 * address in their inbox and say what the account is. Selling starts with the
 * second message.
 *
 * The seller copy states only what the seller controls (delivery charges,
 * dispatch time, change-of-mind returns) — those are per-boutique since 0076,
 * 0077 and 0078, so promising a platform-wide delivery or returns policy here
 * would contradict what the product page actually shows.
 */
const COPY: Record<Role, {
  subject: string;
  preheader: string;
  heading: (name: string) => string;
  intro: string;
  points: [string, string][];
  ctaLabel: string;
  ctaPath: string;
  closing: string;
}> = {
  buyer: {
    subject: `Welcome to ${BRAND}`,
    preheader: 'Your account is ready — handloom, silk and everyday ethnic wear from verified independent boutiques.',
    heading: (name) => (name ? `Welcome, ${name}` : `Welcome to ${BRAND}`),
    intro:
      'Your account is ready. MangaiMart is a marketplace of independent Indian boutiques — every shop on it is a real, verified business, and you buy from them directly.',
    points: [
      ['Shop by boutique, not by brand', 'Follow the ones you like and see what they add next.'],
      ['Save what catches your eye', 'Your wishlist and cart stay with your account, on every device.'],
      ['Know before you order', 'Each boutique publishes its own delivery charge, dispatch time and returns window on the product page.'],
    ],
    ctaLabel: 'Start browsing',
    ctaPath: '/',
    closing: 'Every order is prepaid and tracked, and support is one reply away.',
  },
  seller: {
    subject: `Welcome to ${BRAND} — let us get your boutique open`,
    preheader: 'Your seller account is ready. Finish setting up your boutique to start listing.',
    heading: (name) => (name ? `Welcome, ${name}` : 'Welcome to MangaiMart for boutiques'),
    intro:
      'Your seller account is ready. The next step is the boutique itself — once it is set up and verified, you can list products and start taking orders.',
    points: [
      ['Finish your boutique profile', 'Name, location, photos, and the delivery charge you want to set for each distance band.'],
      ['Get verified', 'Upload your business details for review. Verification is what puts your shop in front of buyers.'],
      ['List your first pieces', 'Add a product with its colours and sizes, and it goes live the moment your boutique is approved.'],
    ],
    ctaLabel: 'Open your seller console',
    ctaPath: '/seller/dashboard',
    closing:
      'You keep the sale price minus the platform commission, settled after delivery. Delivery charges, dispatch time and your change-of-mind returns window are yours to set.',
  },
};

/**
 * The numbered steps.
 *
 * A table with a round number cell, not a `<ul>`: list bullets and their
 * indentation are one of the few things Outlook and Gmail still disagree about
 * badly enough to notice, and this is the same construction the admin welcome
 * in api/_welcomeEmail.js already uses.
 */
function pointsTable(points: [string, string][]): string {
  const rows = points
    .map(
      ([title, detail], i) => `
        <tr>
          <td width="34" valign="top" style="padding:0 0 12px;">
            <div style="width:22px;height:22px;border-radius:999px;background:#B02454;color:#FFFFFF;text-align:center;line-height:22px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;">${i + 1}</div>
          </td>
          <td style="padding:0 0 12px;font-family:Arial,Helvetica,sans-serif;">
            <div style="font-size:14px;line-height:1.5;color:#241019;font-weight:700;">${esc(title)}</div>
            <div style="font-size:13.5px;line-height:1.6;color:#4B3840;padding-top:2px;">${esc(detail)}</div>
          </td>
        </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

/**
 * The brand shell.
 *
 * Kept deliberately identical to `layout()` in api/_email.js and the `shell()`
 * in broadcast-email — a person who gets a welcome and then an order receipt
 * should not feel they came from two companies. If the shell changes, change
 * all three.
 *
 * Colours are literal hex, the one place the `--ag-*` token rule does not apply:
 * a mail client has never seen our stylesheet and cannot resolve a CSS variable.
 *
 * No unsubscribe link, and that is a decision rather than an oversight. This is
 * a transactional message — sent once, because the person just created the
 * account it describes, and it sells nothing. `marketing_opt_out` gates the
 * broadcast templates; it does not gate this, for the same reason it does not
 * gate an order receipt.
 */
function shell({ heading, preheader, intro, bodyHtml, ctaLabel, ctaHref, closing }: {
  heading: string;
  preheader: string;
  intro: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
  closing: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(heading)}</title>
${HEAD_STYLE}</head>
<body style="margin:0;padding:0;background:#FBF6F2;">
<!-- Preview text: what the inbox list shows next to the subject. The spacer
     stops the client filling the rest of the preview with the header markup. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">&#847;&zwnj;&nbsp;&#8199;&shy;${'&#847;&zwnj;&nbsp;&#8199;&shy;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF6F2;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #EFDCE4;">
    <tr><td align="center" style="background:#FFF8F4;padding:22px 24px 20px;border-bottom:1px solid #F4E7ED;">
      <a href="${esc(APP_URL)}" style="text-decoration:none;">
        <img src="${LOGO_URL}" width="210" alt="${BRAND}" class="ag-logo" style="display:block;margin:0 auto;width:210px;max-width:72%;height:auto;border:0;outline:none;text-decoration:none;" />
      </a>
    </td></tr>
    <tr><td align="center" class="ag-pad" style="padding:26px 24px 8px;text-align:center;">
      <h1 class="ag-h1" style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.3;color:#241019;font-weight:700;text-align:center;">${esc(heading)}</h1>
    </td></tr>
    <tr><td align="left" class="ag-pad ag-body" style="padding:10px 24px 0;text-align:left;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#4B3840;text-align:left;">${esc(intro)}</p>
    </td></tr>
    <tr><td align="left" class="ag-pad ag-body" style="padding:20px 24px 0;text-align:left;">${bodyHtml}</td></tr>
    <tr><td align="center" class="ag-pad" style="padding:14px 24px 4px;text-align:center;">
      <a href="${esc(ctaHref)}" class="ag-btn" style="display:inline-block;background:#B02454;color:#FFFFFF;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;padding:13px 26px;border-radius:10px;">${esc(ctaLabel)}</a>
    </td></tr>
    <tr><td align="center" class="ag-pad" style="padding:22px 24px 26px;text-align:center;">
      <p class="ag-small" style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.6;color:#775D66;text-align:center;">${esc(closing)}</p>
      <p class="ag-small" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.6;color:#836B74;text-align:center;">
        ${BRAND} — ethnic wear from verified independent boutiques.<br />
        Questions? Write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#B02454;text-decoration:none;">${SUPPORT_EMAIL}</a>.<br />
        This is a message about your ${BRAND} account, not marketing.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

/**
 * The plain-text alternative.
 *
 * Not optional politeness: a message with no text part scores worse with spam
 * filters, and this one has to land on the very first send of a brand-new
 * relationship, before any engagement signal exists to vouch for us.
 */
function plainText(role: Role, name: string, ctaHref: string): string {
  const copy = COPY[role];
  return [
    copy.heading(name),
    '',
    copy.intro,
    '',
    ...copy.points.map(([title, detail], i) => `${i + 1}. ${title} — ${detail}`),
    '',
    `${copy.ctaLabel}: ${ctaHref}`,
    '',
    copy.closing,
    '',
    `${BRAND} — ethnic wear from verified independent boutiques.`,
    `Questions? Write to ${SUPPORT_EMAIL}.`,
    `This is a message about your ${BRAND} account, not marketing.`,
  ].join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!serviceKey || !supabaseUrl) return json({ error: 'Function is not configured' }, 500);

  // The caller must BE the service role. See the header comment: the gateway's
  // JWT check alone would admit any signed-in buyer.
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (bearer !== serviceKey) return json({ error: 'Forbidden' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // An UPDATE or DELETE webhook aimed here is a misconfiguration, not a send.
  // Reported as ok: the fix is in the dashboard, and failing loudly on every
  // profile edit would bury the real errors in the delivery log.
  if (body.type && body.type !== 'INSERT') {
    return json({ ok: true, skipped: `webhook type ${String(body.type)}` });
  }

  // Two shapes: the webhook envelope, and a bare { user_id } for a manual resend.
  const record = (body.record ?? {}) as Record<string, unknown>;
  const userId = String(record.id ?? body.user_id ?? '').trim();
  if (!userId) return json({ error: 'No user id in payload' }, 400);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── Claim ──────────────────────────────────────────────────────────────────
  // The guard is the WHERE clause, not a prior read: two concurrent deliveries
  // both reading NULL and then both writing is exactly the race a check-then-act
  // would lose. Postgres serialises the two UPDATEs, and only one gets a row
  // back.
  const claimedAt = new Date().toISOString();
  const { data: profile, error: claimError } = await db
    .from('profiles')
    .update({ welcome_email_sent_at: claimedAt })
    .eq('id', userId)
    .is('welcome_email_sent_at', null)
    .select('id, email, full_name, role')
    .maybeSingle();

  if (claimError) {
    console.error('[welcome-email] claim failed', { userId, error: claimError.message });
    return json({ ok: false, error: 'Could not claim the profile' });
  }
  if (!profile) {
    // Already sent, pre-stamped (admin-created or anonymous — see 0105), or the
    // row is gone. All three are "nothing to do", not failures.
    return json({ ok: true, skipped: 'already sent or not eligible' });
  }

  /** Put the marker back so a later retry can pick the row up again. */
  const release = async (reason: string) => {
    const { error } = await db
      .from('profiles')
      .update({ welcome_email_sent_at: null })
      .eq('id', userId)
      .eq('welcome_email_sent_at', claimedAt);
    if (error) console.error('[welcome-email] could not release claim', { userId, error: error.message });
    console.error('[welcome-email] not sent', { userId, reason });
  };

  if (!isValidEmail(profile.email)) {
    // Anonymous sessions are pre-stamped by 0105 and never reach here; this
    // catches a genuinely malformed address. The claim STAYS taken — a bad
    // address will not fix itself, and releasing it would make every future
    // retry re-attempt the same doomed send.
    console.log('[welcome-email] no usable address', { userId });
    return json({ ok: true, skipped: 'no valid email address' });
  }

  // Admins and staff get the temp-password welcome from api/admin-create-user.js
  // instead. They are already pre-stamped by 0105 on that path; this is the
  // backstop for a role assigned some other way. The claim stays taken, because
  // the answer will not change on a retry.
  if (profile.role === 'admin' || profile.role === 'staff') {
    return json({ ok: true, skipped: `role ${profile.role} is handled by admin-create-user` });
  }
  const role: Role = profile.role === 'seller' ? 'seller' : 'buyer';

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    // Inert, not broken — the same posture _email.js and the webhooks take.
    await release('RESEND_API_KEY unset');
    return json({ ok: false, error: 'Email provider is not configured' });
  }

  const copy = COPY[role];
  const name = greetingName(profile.full_name);
  const ctaHref = `${APP_URL}${copy.ctaPath}`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: senderFrom(Deno.env.get('EMAIL_FROM')),
        to: [String(profile.email).trim()],
        subject: copy.subject,
        html: shell({
          heading: copy.heading(name),
          preheader: copy.preheader,
          intro: copy.intro,
          bodyHtml: pointsTable(copy.points),
          ctaLabel: copy.ctaLabel,
          ctaHref,
          closing: copy.closing,
        }),
        text: plainText(role, name, ctaHref),
        reply_to: SUPPORT_EMAIL,
      }),
      // A hung provider must not hold the function open for its whole wall-clock
      // budget. Resend is fast; past 8s we would rather release the claim and
      // leave the row visibly owed than block.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        detail = err?.message ?? err?.error?.message ?? detail;
      } catch { /* keep the status line */ }
      await release(detail);
      return json({ ok: false, error: detail });
    }
  } catch (err) {
    await release(err instanceof Error ? err.message : String(err));
    return json({ ok: false, error: 'Send failed' });
  }

  console.log('[welcome-email] sent', { userId, role });
  return json({ ok: true, sent: true, role });
});
