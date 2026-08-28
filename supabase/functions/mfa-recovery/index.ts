/**
 * mfa-recovery — recovery, plus the whole email-code second factor.
 *
 *   redeem        a user spends one of their own backup codes
 *   admin-reset   an admin clears 2FA for somebody else
 *   email-start   mail a six-digit code (to enrol an address, or to unlock)
 *   email-verify  spend that code
 *   email-remove  drop the email method from your own account
 *
 * The email actions live here rather than in a function of their own for the
 * reason below (`api/` is full, and this already holds the service role key),
 * and because they share `clearFactors` with recovery: clearing somebody's 2FA
 * has to clear BOTH methods or in practice it clears neither.
 *
 * Both do the same thing in the end: delete the account's TOTP factors, so the
 * next sign-in lands on the enrol screen instead of the challenge screen.
 *
 * WHY THIS IS AN EDGE FUNCTION
 * Two reasons, and the second is the real one.
 *
 * 1. `api/` is at the 12/12 Vercel Hobby function ceiling. There is no room for
 *    another route there, which is the same reason WhatsApp and Shiprocket live
 *    out here (see CLAUDE.md).
 * 2. Deleting an MFA factor is a GoTrue Admin API call, so it needs the service
 *    role key. That key cannot go anywhere the browser can reach it.
 *
 * WHY A BACKUP CODE DOES NOT LOG YOU IN
 * Only GoTrue can mint a JWT carrying `aal2`, and it only does that for a real
 * TOTP challenge. Anything we honoured ourselves would be a flag in React over
 * a session the database still sees as aal1 — and after migration 0100 the
 * database is what withholds the console. So a code buys a fresh enrolment,
 * not a session. That is the honest version of the feature.
 *
 * WHY BRUTE FORCE IS NOT GUARDED HERE
 * The codes are 64 bits (0099 issues 16 hex characters), single-use, and ten to
 * an account. Guessing one is not a thing that happens, so this endpoint does
 * not carry a rate limiter of its own — it inherits the platform's. If the code
 * length in `mfa_backup_codes_generate` is ever shortened for readability, that
 * reasoning dies with it and a limiter becomes mandatory.
 *
 * DEPLOY — with JWT verification ON, unlike `unsubscribe`. Every caller here
 * must already hold a session; an anonymous request has nothing to recover.
 *   supabase functions deploy mfa-recovery
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Read the claims out of a JWT without verifying the signature.
 *
 * Safe only because this function is deployed with verify_jwt on, so the
 * platform has already rejected anything unsigned or expired before our code
 * runs — and because the two claims read here (`sub`, `aal`) are re-checked
 * against the database below rather than trusted on their own.
 *
 * `session_id` matters as much as `sub` for the email actions: it is what
 * migration 0102 writes into `mfa_email_sessions`, and therefore what
 * `is_admin()` looks for. Reading it from the token is not a shortcut — it is
 * the only place it exists, and reading it from the request BODY instead would
 * let a caller mark any session id they cared to name as verified.
 */
function claims(token: string): { sub?: string; aal?: string; session_id?: string } {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

/**
 * `selva@example.com` -> `s•••a@example.com`.
 *
 * Shown on the "we sent a code to…" line. Enough for the owner to recognise
 * which inbox to open, not enough for a stolen session to learn an address the
 * thief did not already have — that address is the only thing standing between
 * them and the console.
 */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return '•••';
  const head = name.slice(0, 1);
  const tail = name.length > 2 ? name.slice(-1) : '';
  return head + '•••' + tail + '@' + domain;
}

/**
 * Remove every second factor on an account — authenticator apps through the
 * GoTrue Admin API, and the 0102 email method through the database. Returns how
 * many were removed, counting both kinds.
 *
 * Both, always. A reset that cleared the app but left the email address behind
 * would hand a "recovered" account straight back to whoever had been receiving
 * its codes — which is the situation an admin reset is usually called about.
 */
async function clearFactors(admin: ReturnType<typeof createClient>, userId: string): Promise<number> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw new Error(error.message);

  const factors = data.user?.factors ?? [];
  for (const factor of factors) {
    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (delErr) throw new Error(delErr.message);
  }

  const { data: emailRemoved } = await admin.rpc('mfa_email_factor_clear', { p_user: userId });
  return factors.length + (typeof emailRemoved === 'number' ? emailRemoved : 0);
}

/**
 * Is this caller already past a second factor, by either method?
 *
 * `aal2` comes from the token. The email half cannot — an email-verified session
 * is aal1 forever — so it is read from the ledger 0102 created, keyed on the
 * same session id the database keys on. Anything asking "are they verified"
 * must ask both halves, or it treats every email user as unverified and locks
 * them out of their own security settings.
 */
async function isVerified(
  admin: ReturnType<typeof createClient>,
  userId: string,
  aal: string | undefined,
  sessionId: string | undefined,
): Promise<boolean> {
  if (aal === 'aal2') return true;
  if (!sessionId || !UUID.test(sessionId)) return false;

  const { data: session } = await admin
    .from('mfa_email_sessions')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!session) return false;

  // The session row alone is not enough: an admin reset deletes the factor, and
  // a session pointing at a factor that no longer exists must not count. Same
  // join `is_admin()` makes — repeated here so the screens agree with RLS
  // rather than each deciding for themselves.
  const { data: factor } = await admin
    .from('mfa_email_factors')
    .select('user_id')
    .eq('user_id', userId)
    .not('verified_at', 'is', null)
    .maybeSingle();
  return !!factor;
}

/**
 * Six digits from the platform CSPRNG, uniformly distributed.
 *
 * The rejection loop is not pedantry. `n % 1000000` over a 32-bit draw is
 * measurably biased towards low codes, and a second factor whose leading digits
 * are skewed has fewer than the twenty bits it appears to have.
 */
function sixDigitCode(): string {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1000000) * 1000000;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return String(buf[0] % 1000000).padStart(6, '0');
}

/**
 * Mail the code. Returns null on success, or a message to show the user.
 *
 * Inert rather than broken when `RESEND_API_KEY` is unset — the posture
 * `api/_email.js` takes — with one deliberate difference: this one reports the
 * failure to its caller instead of swallowing it. Every caller in `_email.js`
 * sits downstream of money that has already moved, so an email failure must not
 * become an error there. Here the email IS the feature, and "code sent" printed
 * over a mail that never left leaves someone watching an empty inbox.
 *
 * No layout framework, inline attributes only: email clients strip <style>.
 */
async function sendCode(to: string, code: string, purpose: 'enroll' | 'challenge'): Promise<string | null> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? 'MangaiMart <noreply@mangaimart.com>';

  if (!key) {
    // Dev and preview projects have no mail provider. Say so plainly rather
    // than pretending it was sent — and do NOT log the code. It would be a live
    // second factor sitting in the function logs, and the caller voids this
    // challenge the moment we return an error anyway, so it would be a secret
    // written down for no benefit at all.
    console.log('[mfa email skipped — RESEND_API_KEY unset]', { to, purpose });
    return 'Email is not configured on this environment yet.';
  }

  const heading = purpose === 'enroll' ? 'Confirm this security address' : 'Your sign-in code';
  const line =
    purpose === 'enroll'
      ? 'Enter this code in MangaiMart to finish setting up email as your second factor.'
      : 'Enter this code to open the MangaiMart console.';

  const html = [
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf7f5;padding:28px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">',
    '<tr><td align="center">',
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:30px 28px;">',
    '<tr><td align="center" style="padding-bottom:18px;"><img src="https://mangaimart.com/mangaimart-wordmark.png" width="190" alt="MangaiMart" style="width:190px;max-width:60%;height:auto;"></td></tr>',
    '<tr><td style="font-size:19px;font-weight:700;color:#2b1620;padding-bottom:8px;">' + heading + '</td></tr>',
    '<tr><td style="font-size:14px;line-height:1.6;color:#6b5560;padding-bottom:20px;">' + line + '</td></tr>',
    '<tr><td align="center" style="padding:16px 0;background:#faf2f5;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:.22em;color:#b02454;">' + code + '</td></tr>',
    '<tr><td style="font-size:13px;line-height:1.6;color:#6b5560;padding-top:20px;">It expires in 10 minutes and can be used once. If you did not ask for it, someone may have your password — change it now and tell an administrator.</td></tr>',
    '</table></td></tr></table>',
  ].join('');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        from,
        to: [to],
        subject: code + ' is your MangaiMart security code',
        html,
      }),
    });
    if (!res.ok) {
      console.error('[mfa email failed]', res.status, await res.text());
      return 'Could not send the email. Try again in a moment.';
    }
    return null;
  } catch (e) {
    console.error('[mfa email failed]', e);
    return 'Could not send the email. Try again in a moment.';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ ok: false, error: 'Sign in first.' }, 401);

  const { sub: callerId, aal: callerAal, session_id: callerSession } = claims(token);
  if (!callerId || !UUID.test(callerId)) return json({ ok: false, error: 'Sign in first.' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  let body: { action?: string; code?: string; userId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Malformed request.' }, 400);
  }

  // ── A user spending one of their own backup codes ─────────────────────────
  //
  // Deliberately reachable at aal1: the entire point is that this person cannot
  // complete a challenge right now. The password they signed in with plus a
  // code only they hold is the two-factor pair being honoured here.
  if (body.action === 'redeem') {
    const code = (body.code ?? '').trim();
    if (!code) return json({ ok: false, error: 'Enter a backup code.' }, 400);

    const { data: ok, error } = await admin.rpc('mfa_backup_code_consume', {
      p_user: callerId,
      p_code: code,
    });
    if (error) return json({ ok: false, error: 'Could not check that code. Please try again.' }, 500);
    // One message for "wrong code", "already used" and "no codes issued". The
    // distinctions are only useful to somebody who is not the owner.
    if (!ok) return json({ ok: false, error: 'That backup code is not valid or has already been used.' }, 400);

    try {
      await clearFactors(admin, callerId);
    } catch (e) {
      // The code is already spent at this point and cannot be handed back. Say
      // so plainly rather than inviting a retry that would burn a second one.
      return json(
        { ok: false, error: `Your code was accepted but the reset failed: ${e instanceof Error ? e.message : 'unknown error'}. Contact support before using another code.` },
        500,
      );
    }

    await admin.from('admin_activity_log').insert({
      actor_id: callerId,
      actor_name: 'Account owner',
      action: 'mfa.backup_code_redeemed',
      entity_type: 'profile',
      entity_id: callerId,
      meta: { note: 'Authenticator cleared with a backup code; re-enrolment required.' },
    });

    return json({ ok: true });
  }

  // ── An admin clearing somebody else's 2FA ─────────────────────────────────
  if (body.action === 'admin-reset') {
    const targetId = (body.userId ?? '').trim();
    if (!UUID.test(targetId)) return json({ ok: false, error: 'Unknown account.' }, 400);

    // Role comes from the database, never from the token: a JWT says what role
    // GoTrue knew at sign-in, and an admin demoted five minutes ago still holds
    // one. The `aal` claim IS taken from the token — it is minted per-token by
    // GoTrue and is the only place it exists.
    const { data: caller } = await admin
      .from('profiles')
      .select('id, role, full_name, status, deleted_at')
      .eq('id', callerId)
      .maybeSingle();

    const isLiveAdmin =
      caller?.role === 'admin' && (caller.status ?? 'active') === 'active' && caller.deleted_at == null;
    if (!isLiveAdmin) return json({ ok: false, error: 'Admins only.' }, 403);

    // An admin at aal1 must not be able to strip 2FA from other accounts — that
    // would be a one-call unwind of the whole scheme by whoever stole a single
    // password. Staff are excluded by the role check above for the same reason:
    // this is a "money and people" action, and 0086 keeps those away from staff.
    if (callerAal !== 'aal2') {
      return json({ ok: false, error: 'Enter your own authenticator code first, then retry.' }, 403);
    }

    let removed = 0;
    try {
      removed = await clearFactors(admin, targetId);
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : 'Reset failed.' }, 500);
    }

    // Backup codes are per-authenticator. Leaving the old set live would mean a
    // reset account still had ten working bypasses tied to a factor that no
    // longer exists.
    await admin.from('mfa_backup_codes').delete().eq('user_id', targetId);

    await admin.from('admin_activity_log').insert({
      actor_id: callerId,
      actor_name: caller?.full_name || 'Admin',
      action: 'mfa.admin_reset',
      entity_type: 'profile',
      entity_id: targetId,
      meta: { factors_removed: removed },
    });

    return json({ ok: true, removed });
  }

  // ── Email as a second factor ──────────────────────────────────────────────
  //
  // Three actions, one flow. `email-start` mails a code, `email-verify` spends
  // it, `email-remove` gives the method up. What they never do is decide
  // anything about access on their own: the only durable effect of a correct
  // code is a row in `mfa_email_sessions`, and migration 0102's `is_admin()` /
  // `is_staff()` are what read it. This function is the postman, not the lock.

  if (body.action === 'email-start') {
    if (!callerSession || !UUID.test(callerSession)) {
      // Every real GoTrue access token carries `session_id`. Its absence means
      // the session is not one we can bind a verification to, and binding is
      // the entire security property here — so refuse rather than fall back to
      // verifying by user id, which would let one browser unlock another.
      return json({ ok: false, error: 'Sign out and sign in again, then retry.' }, 400);
    }

    const { data: factor } = await admin
      .from('mfa_email_factors')
      .select('email, verified_at')
      .eq('user_id', callerId)
      .maybeSingle();

    // A failed lookup is treated as "they have an app". The only thing `hasApp`
    // decides below is whether an unverified session may change where the codes
    // go, and guessing `false` on an outage would open exactly the door this
    // whole feature is built to keep shut.
    const { data: userRow, error: userErr } = await admin.auth.admin.getUserById(callerId);
    const hasApp = !!userErr || (userRow?.user?.factors ?? []).some((f) => f.status === 'verified');
    const requested = (body.email ?? '').trim().toLowerCase();

    let purpose: 'enroll' | 'challenge';
    let target: string;

    if (requested) {
      // Registering an address, or changing one. Reachable at aal1 ONLY when
      // the account has no working second factor at all — that is the case this
      // whole feature exists for, somebody choosing email instead of an app.
      // Once any factor works, changing where the codes go is a change to the
      // lock itself and needs the current key.
      if ((hasApp || factor?.verified_at) && !(await isVerified(admin, callerId, callerAal, callerSession))) {
        return json(
          { ok: false, error: 'Verify with your current method first, then change your security address.' },
          403,
        );
      }
      purpose = 'enroll';
      target = requested;
    } else {
      // Unlocking a session with the address already on file.
      if (!factor?.verified_at) {
        return json({ ok: false, error: 'No security address is set up on this account.' }, 400);
      }
      purpose = 'challenge';
      target = factor.email as string;
    }

    const code = sixDigitCode();
    const { data: challengeId, error: rpcErr } = await admin.rpc('mfa_email_challenge_create', {
      p_user: callerId,
      p_email: target,
      p_purpose: purpose,
      p_session: callerSession,
      p_code: code,
    });
    // 0102 raises with messages written to be read by the person waiting — the
    // rate limits and the "not your login address" rule. Pass them through
    // rather than replacing them with something vaguer.
    if (rpcErr) return json({ ok: false, error: rpcErr.message || 'Could not send a code.' }, 400);

    const sendErr = await sendCode(target, code, purpose);
    if (sendErr) {
      // The mail never left, so the challenge is dead weight AND it would hold
      // the sixty-second cooldown against a retry the user did nothing to
      // deserve. Remove it and let them press the button again.
      await admin.from('mfa_email_challenges').delete().eq('id', challengeId);
      return json({ ok: false, error: sendErr }, 502);
    }

    return json({ ok: true, sentTo: maskEmail(target) });
  }

  if (body.action === 'email-verify') {
    if (!callerSession || !UUID.test(callerSession)) {
      return json({ ok: false, error: 'Sign out and sign in again, then retry.' }, 400);
    }
    const code = (body.code ?? '').trim();
    if (!/^[0-9]{6}$/.test(code)) return json({ ok: false, error: 'Enter the six-digit code.' }, 400);

    const { data: status, error } = await admin.rpc('mfa_email_challenge_consume', {
      p_user: callerId,
      p_code: code,
      p_session: callerSession,
    });
    if (error) return json({ ok: false, error: 'Could not check that code. Please try again.' }, 500);

    // Four failure modes, four different next actions for the person reading
    // them — retype, ask for a fresh one, wait. Unlike the backup codes in
    // `redeem`, telling them apart helps the owner far more than an attacker,
    // who learns nothing from "expired" that the clock did not already tell
    // them.
    if (status === 'ok') {
      await admin.from('admin_activity_log').insert({
        actor_id: callerId,
        actor_name: 'Account owner',
        action: 'mfa.email_verified',
        entity_type: 'profile',
        entity_id: callerId,
        meta: { note: 'Session verified with an emailed code.' },
      });
      return json({ ok: true });
    }
    if (status === 'expired') {
      return json({ ok: false, error: 'That code has expired. Send yourself a new one.' }, 400);
    }
    if (status === 'locked') {
      return json({ ok: false, error: 'Too many wrong attempts. Send yourself a new code.' }, 429);
    }
    if (status === 'none') {
      return json({ ok: false, error: 'No code is waiting. Send yourself one first.' }, 400);
    }
    return json({ ok: false, error: 'That code is not right.' }, 400);
  }

  if (body.action === 'email-remove') {
    if (!(await isVerified(admin, callerId, callerAal, callerSession))) {
      return json({ ok: false, error: 'Verify first, then change your security settings.' }, 403);
    }

    // The same guard `removeAuthenticator` carries on the client, restated on
    // the server because the client is not where a guard is worth anything.
    // After 0100/0102 an account with NO factor can never satisfy `is_admin()`,
    // so dropping the last one is a silent permanent lockout whose only remedy
    // is another admin — or the rollback SQL. There is deliberately no "turn
    // two-factor off" anywhere in this codebase, and this is one of the doors
    // it could otherwise sneak back in through.
    const { data: userRow } = await admin.auth.admin.getUserById(callerId);
    const hasApp = (userRow?.user?.factors ?? []).some((f) => f.status === 'verified');
    if (!hasApp) {
      return json(
        {
          ok: false,
          error:
            'This is your only second factor. Set up an authenticator app first — an account with no second factor cannot open the console at all.',
        },
        400,
      );
    }

    await admin.rpc('mfa_email_factor_clear', { p_user: callerId });
    await admin.from('admin_activity_log').insert({
      actor_id: callerId,
      actor_name: 'Account owner',
      action: 'mfa.email_removed',
      entity_type: 'profile',
      entity_id: callerId,
      meta: { note: 'Email second factor removed by the account owner.' },
    });

    return json({ ok: true });
  }

  return json({ ok: false, error: 'Unknown action.' }, 400);
});
