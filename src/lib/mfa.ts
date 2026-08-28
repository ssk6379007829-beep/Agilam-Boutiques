import { supabase } from '@/lib/supabase';

/**
 * Two-factor authentication — the client half. Two methods, one gate.
 *
 * WHAT MAKES THIS REAL AND NOT A UI GATE
 * Neither method is decided here. The console's data is withheld by Postgres
 * until a code is entered — not by the screens in this app, which an attacker
 * holding a stolen password would simply not load. The two methods reach that
 * same conclusion by different routes, and the difference is worth holding on
 * to because almost every bug in this file comes from conflating them:
 *
 *   AUTHENTICATOR APP (0099/0100). A thin wrapper over Supabase's own MFA. When
 *   `verifyChallenge` succeeds, GoTrue re-mints the session's JWT with
 *   `aal: "aal2"`, and `is_admin()` / `is_staff()` test that claim.
 *
 *   EMAIL CODE (0102). GoTrue has no email factor and never mints aal2 for one,
 *   so this cannot work the same way — an email-verified session stays aal1 for
 *   its whole life. Instead the `mfa-recovery` Edge Function verifies the code
 *   with the service role and writes a row keyed by the JWT's `session_id`, and
 *   0102 widened those same two functions to accept it. Still the database
 *   deciding; just a second thing it will accept.
 *
 * The practical consequence, and the trap: **AAL alone no longer answers "is
 * this session verified"**. Every call that used to read the assurance level
 * must now also ask the server about the email ledger. `readMfaState` does both.
 * Anything that reads `getAuthenticatorAssuranceLevel()` on its own will report
 * every email user as locked out.
 *
 * That is also why none of the obvious shortcuts are available. We cannot
 * "remember this device" past a fresh sign-in (the verification is a property
 * of the session, and a new sign-in is a new session), and a backup code cannot
 * be a login (only GoTrue can mint aal2). See `mfa-recovery`.
 *
 * WHAT THE ASSURANCE LEVELS MEAN IN PRACTICE
 *   current aal1 / next aal1  → no authenticator enrolled. Nothing to challenge.
 *   current aal1 / next aal2  → enrolled but not yet challenged this session.
 *   current aal2 / next aal2  → done; the JWT carries aal2.
 *
 * `nextLevel` is the enrolment signal, `currentLevel` the "did they type a code
 * this session" one, and confusing the two is the easy bug here.
 */

export type MfaState =
  /** Session is fully verified — the console is open. */
  | 'verified'
  /** Has an authenticator, hasn't entered a code since signing in. */
  | 'challenge'
  /** No authenticator yet. Must enrol before they can be challenged. */
  | 'enroll'
  /** Not signed in, so the question does not arise. */
  | 'anonymous';

export type EnrollStart = {
  factorId: string;
  /** An `<img src>`-ready SVG data URL from GoTrue. No QR library needed. */
  qrCode: string;
  /** The same secret in text, for authenticator apps entered by hand. */
  secret: string;
};

/** What the account has registered, and where the emailed codes would go. */
export type MfaMethods = {
  /** A verified authenticator app. */
  app: boolean;
  /** A verified security address. */
  email: boolean;
  /** That address, for the "we'll email s•••a@…" line. Null when unset. */
  emailAddress: string | null;
  /** Whether THIS session has already passed an email challenge. */
  emailSessionVerified: boolean;
};

/**
 * The account's email factor as the database sees it, or null if there is none.
 *
 * 0102's `mfa_email_status()` returns at most one row and is granted to every
 * signed-in account rather than guarded on `is_admin()` — deliberately, since
 * `is_admin()` now requires a completed challenge and the screen that completes
 * one must not need to have completed one already.
 */
export async function emailFactorStatus(): Promise<
  { email: string; verified: boolean; sessionVerified: boolean } | null
> {
  const { data, error } = await supabase.rpc('mfa_email_status');
  if (error || !data) return null;
  const row = (data as { email: string; verified: boolean; session_verified: boolean }[])[0];
  if (!row) return null;
  return { email: row.email, verified: row.verified, sessionVerified: row.session_verified };
}

/** Both methods at once, for the screens that offer a choice between them. */
export async function readMfaMethods(): Promise<MfaMethods> {
  const [{ data: factors }, email] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    emailFactorStatus(),
  ]);
  return {
    app: !!factors?.totp?.some((f) => f.status === 'verified'),
    email: !!email?.verified,
    emailAddress: email?.verified ? email.email : null,
    emailSessionVerified: !!email?.sessionVerified,
  };
}

/**
 * Where the signed-in session stands. Read after any auth change, and again
 * after a verify.
 *
 * TWO SOURCES, AND WHY BOTH ARE UNAVOIDABLE
 * The AAL is a property of the JWT, so it only moves when the token does — and
 * for an email verification the token never moves at all. So a session that the
 * database considers fully verified reads `aal1` here forever, and asking only
 * GoTrue would show every email user a challenge screen they had already
 * passed, on a console that was working perfectly.
 *
 * The AAL is checked first because it is local and free; the round trip only
 * happens for sessions that are not already aal2.
 */
export async function readMfaState(): Promise<MfaState> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return 'anonymous';

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!error && data?.currentLevel === 'aal2') return 'verified';

  const email = await emailFactorStatus();
  if (email?.verified && email.sessionVerified) return 'verified';

  // Enrolled on either method → there is something to challenge against.
  if (email?.verified) return 'challenge';
  if (!error && data?.nextLevel === 'aal2') return 'challenge';

  // Treat an unreadable AAL as "enrol" rather than "verified". If that call is
  // failing we do not know what the session is, and the safe direction for an
  // unknown is the one that asks for more proof, not less. The database is
  // enforcing this regardless, so a wrong guess here costs a confusing screen,
  // never access.
  return 'enroll';
}

/** True when the account has a second factor of either kind registered. */
export async function hasEnrolledFactor(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors();
  if (data?.totp?.length) return true;
  return !!(await emailFactorStatus())?.verified;
}

/**
 * Begin enrolment: returns the QR code to scan.
 *
 * Abandoned enrolments leave `unverified` factors behind — someone who opens
 * this screen three times before finding their phone would otherwise collect
 * three of them, and Supabase rejects a duplicate friendly name, so the third
 * attempt would fail with an error about a name the user never typed. Clearing
 * the unverified ones first makes re-opening the screen always work.
 */
export async function startEnrollment(friendlyName = 'MangaiMart'): Promise<EnrollStart> {
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const factor of existing?.all ?? []) {
    if (factor.status !== 'verified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
  if (error) throw new Error(friendlyMfaError(error.message));
  if (!data) throw new Error('Could not start setup. Please try again.');

  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/**
 * Verify a 6-digit code against a factor — used both to finish enrolment and to
 * unlock a later session.
 *
 * On success the local session is upgraded to aal2 in place, which is why the
 * caller must re-read the AAL rather than assume it: React state derived from
 * the old token is now stale.
 */
export async function verifyChallenge(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.replace(/\D/g, ''),
  });
  if (error) throw new Error(friendlyMfaError(error.message));
}

/** The verified factor to challenge against, if the account has one. */
export async function verifiedFactorId(): Promise<string | null> {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.find((f) => f.status === 'verified')?.id ?? null;
}

export type Authenticator = { id: string; name: string; createdAt: string | null };

/** The registered authenticators, for the Security card's device list. */
export async function listAuthenticators(): Promise<Authenticator[]> {
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp ?? [])
    .filter((f) => f.status === 'verified')
    .map((f) => ({ id: f.id, name: f.friendly_name || 'Authenticator', createdAt: f.created_at ?? null }));
}

/**
 * Remove ONE authenticator — the lost-laptop case, where the account still has
 * another device registered.
 *
 * Refuses to remove the last one, and that guard is the important part of this
 * function. After migration 0100 an account with no verified factor can never
 * reach aal2, and `is_admin()` requires aal2, so "turn off my 2FA" from inside
 * the console is a permanent self-lockout with no error message — the console
 * simply stops returning data on the next sign-in. The only way back would be
 * the rollback SQL in 0100.
 *
 * So there is deliberately no "turn 2FA off" anywhere in the console. Removing
 * a spare device is safe and useful; removing your only one is not an action
 * this app offers.
 */
export async function removeAuthenticator(factorId: string): Promise<void> {
  const factors = await listAuthenticators();
  if (factors.length <= 1) {
    // An email method counts. Since 0102 an account can be perfectly well
    // protected with a security address and no app at all, and refusing to drop
    // the last authenticator from such an account would strand anyone who set
    // up an app, then moved to email.
    const hasEmail = (await emailFactorStatus())?.verified;
    if (!hasEmail) {
      throw new Error(
        'This is your only second factor. Add another device, or set up an email code, before removing this one — an account with no second factor cannot open the console at all.',
      );
    }
  }
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(friendlyMfaError(error.message));
}

/*
 * There is deliberately no `disableMfa()`.
 *
 * An earlier draft had one, and it was a trap. After migration 0100 an account
 * with no verified factor can never reach aal2, and `is_admin()`/`is_staff()`
 * require aal2 — so "turn off my two-factor" is a silent, permanent lockout
 * from the console, recoverable only by pasting 0100's rollback SQL into the
 * Supabase editor. Supabase's own aal2 requirement for unenrolling does not
 * help: the session doing the damage is aal2 by definition.
 *
 * `removeAuthenticator` above covers the legitimate case (drop a spare device)
 * and refuses to remove the last one. Clearing a factor for real is an admin
 * action against SOMEBODY ELSE's account, through `mfa-recovery`, where the
 * person still has a working console to fix it from.
 */

/**
 * Issue ten fresh single-use backup codes, invalidating any earlier set.
 *
 * Returned in clear text exactly once — there is nowhere to read them back
 * from, by design (the table stores only sha256 hashes). The caller must show
 * them before navigating away.
 */
export async function generateBackupCodes(): Promise<string[]> {
  const { data, error } = await supabase.rpc('mfa_backup_codes_generate');
  if (error) throw new Error(friendlyMfaError(error.message));
  return (data as string[] | null) ?? [];
}

/** How many unused backup codes remain, for the "n of 10 left" line. */
export async function backupCodesRemaining(): Promise<number> {
  const { data, error } = await supabase.rpc('mfa_backup_codes_remaining');
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}

/**
 * Spend a backup code to clear a lost authenticator.
 *
 * This does NOT sign anybody in — it removes the factor so the user can enrol a
 * new one and challenge normally. Deleting a factor needs the Admin API, so the
 * work happens in the `mfa-recovery` Edge Function; the browser only carries
 * its own session token there.
 */
export async function redeemBackupCode(code: string): Promise<void> {
  await invokeRecovery({ action: 'redeem', code }, 'That backup code is not valid.');
}

/**
 * Admin action: clear another account's 2FA so they can enrol again.
 *
 * The Edge Function re-checks that the caller is an admin at aal2 — this
 * function being called from an admin screen is not the guard, because the
 * screen is not what an attacker would use.
 */
export async function adminResetMfa(userId: string): Promise<void> {
  await invokeRecovery({ action: 'admin-reset', userId }, 'Could not reset two-factor authentication.');
}

/**
 * Which accounts have 2FA on, as a set of user ids.
 *
 * `auth.mfa_factors` is not readable from the browser, so this goes through
 * 0099's `mfa_enrollment_status()`.
 */
export async function enrolledUserIds(): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('mfa_enrollment_status');
  if (error || !data) return new Set();
  return new Set((data as { user_id: string }[]).map((r) => r.user_id));
}

/**
 * Call `mfa-recovery` and get back a message a human can act on.
 *
 * This wrapper exists because of one supabase-js behaviour that quietly ruins
 * every error screen in this file: `functions.invoke` treats ANY non-2xx as a
 * `FunctionsHttpError`, sets `data` to null, and hands back the message
 * "Edge Function returned a non-2xx status code" — throwing away the JSON body
 * the function carefully wrote. Every refusal worth reading arrives that way:
 * "wait a minute before asking for another", "use an address other than the one
 * you sign in with", "too many wrong attempts". Without this the user is shown
 * an HTTP status dressed up as an explanation.
 *
 * The body is still there, on the `Response` the error kept in `context`. Read
 * it back, and fall through to the generic text only when there is genuinely
 * nothing better — a network failure, or a body that is not JSON.
 */
async function invokeRecovery(
  body: Record<string, unknown>,
  fallback: string,
): Promise<{ ok?: boolean; sentTo?: string }> {
  const { data, error } = await supabase.functions.invoke('mfa-recovery', { body });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      let message: string | null = null;
      try {
        const parsed = (await context.clone().json()) as { error?: unknown };
        if (typeof parsed?.error === 'string' && parsed.error) message = parsed.error;
      } catch {
        // Not JSON. The generic message below is then the honest answer.
      }
      if (message) throw new Error(message);
    }
    throw new Error(friendlyMfaError(error.message));
  }

  const parsed = data as { ok?: boolean; error?: string; sentTo?: string } | null;
  if (parsed?.error) throw new Error(parsed.error);
  if (!parsed?.ok) throw new Error(fallback);
  return parsed;
}

/*
 * ── THE EMAIL METHOD ────────────────────────────────────────────────────────
 *
 * All three calls go to the `mfa-recovery` Edge Function rather than straight to
 * PostgREST, and that is not an arbitrary layering choice. 0102 revokes the
 * challenge tables from `authenticated` outright: a browser that could read
 * them would hold an oracle for other people's codes, and a browser that could
 * write `mfa_email_sessions` could mark itself verified without ever receiving
 * an email — which is the whole feature, undone in one request. So the code is
 * checked by the service role, behind a function, or not at all.
 *
 * `api/` could not host this: it has been at the 12/12 Vercel Hobby ceiling
 * since the SEO work.
 */

/**
 * Mail a six-digit code.
 *
 * Pass an address to register or change one; pass nothing to send to the
 * address already on file. The server decides which of those it is — it will
 * refuse a change unless the session is already verified, and refuse any
 * address that matches the login email.
 *
 * Returns the masked address it went to, so the screen can say which inbox to
 * open without printing an address a stolen session did not already know.
 */
export async function sendEmailCode(email?: string): Promise<string> {
  const body = await invokeRecovery(
    { action: 'email-start', ...(email ? { email } : {}) },
    'Could not send a code. Please try again.',
  );
  return body.sentTo ?? 'your security address';
}

/**
 * Spend an emailed code.
 *
 * On success the session is verified in the database — but NOT in the JWT,
 * which still says aal1 and always will. Nothing here fires an auth state
 * change, so callers must update their own state rather than waiting for
 * `onAuthStateChange` the way the app flow does.
 */
export async function verifyEmailCode(code: string): Promise<void> {
  await invokeRecovery({ action: 'email-verify', code: code.replace(/\D/g, '') }, 'That code is not right.');
}

/**
 * Give up the email method.
 *
 * Refused by the server when it is the account's only factor, for exactly the
 * reason `removeAuthenticator` refuses the last app: after 0100/0102 an account
 * with no factor can never satisfy `is_admin()`, so this would be a silent
 * permanent lockout. Dropping it while an authenticator app remains is safe.
 */
export async function removeEmailFactor(): Promise<void> {
  await invokeRecovery({ action: 'email-remove' }, 'Could not remove the email method.');
}

/**
 * `selva@example.com` → `s•••a@example.com`.
 *
 * Used wherever a screen names the security address. The server masks the one
 * it reports back from a send; this is for the screens that already hold the
 * address and are about to use it. Enough for the owner to recognise which
 * inbox to open, not enough for a stolen session to learn an address the thief
 * did not already have — and that address is the only thing standing between
 * them and the console.
 */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return '•••';
  return `${name.slice(0, 1)}•••${name.length > 2 ? name.slice(-1) : ''}@${domain}`;
}

/** Readable text for the raw GoTrue MFA errors. */
export function friendlyMfaError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid totp code') || (m.includes('invalid') && m.includes('code'))) {
    // Nearly always clock drift on the phone rather than a mistyped code, and
    // saying so saves a support round-trip.
    return 'That code is not right. Codes change every 30 seconds — try the current one, and check your phone’s clock is set automatically.';
  }
  if (m.includes('already exists') || m.includes('friendly name')) {
    return 'Setup was already started. Reload this page and scan the new QR code.';
  }
  if (m.includes('aal2') || m.includes('insufficient') || m.includes('assurance')) {
    return 'Enter a code from your authenticator app first.';
  }
  if (m.includes('rate') || m.includes('too many')) {
    return 'Too many attempts — wait a minute and try again.';
  }
  if (m.includes('factor not found') || m.includes('no factor')) {
    return 'No authenticator is registered on this account. Set one up to continue.';
  }
  const t = message.trim();
  if (!t || t === '{}' || t.startsWith('{')) {
    return 'Two-factor authentication is unavailable right now. Please try again.';
  }
  return message;
}
