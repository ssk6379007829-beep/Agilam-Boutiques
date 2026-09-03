import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { css } from '@/lib/css';
import {
  backupCodesRemaining,
  generateBackupCodes,
  maskEmail,
  readMfaMethods,
  readMfaState,
  redeemBackupCode,
  sendEmailCode,
  startEnrollment,
  verifiedFactorId,
  verifyChallenge,
  verifyEmailCode,
  type EnrollStart,
  type MfaMethods,
  type MfaState,
} from '@/lib/mfa';
import { useShop } from '@/state/ShopContext';

/**
 * The two-factor screen: register a second factor, or enter a code to unlock
 * the session.
 *
 * Deliberately NOT built on `AuthModal`. That shell renders the buyer Home
 * blurred behind the card, which would pull the entire storefront bundle into
 * the console's code-split chunk and read as a strange backdrop for an employee
 * signing in to do refunds.
 *
 * This screen is a courtesy, not the lock. After migrations 0100 and 0102 the
 * database refuses console data to an unverified session whether or not this
 * component ever renders — what it prevents is an admin staring at an
 * inexplicably empty console with no way to fix it.
 *
 * TWO METHODS, AND WHY THE SCREEN IS SHAPED LIKE THIS
 * An authenticator app and an emailed code are equal citizens here: either one
 * on its own is a complete second factor, and a new user picks one at
 * enrolment. What they are NOT is interchangeable under the hood — the app path
 * ends with GoTrue re-minting the JWT as aal2, the email path ends with the
 * `mfa-recovery` Edge Function writing a row against this session's id (see the
 * header of `lib/mfa.ts`). Everything below routes on `step`, and the two paths
 * only rejoin at `onVerified`.
 *
 * When an account has both, the app is offered first and email sits behind a
 * link. Not a preference dressed up as a default: a code that never leaves the
 * device is stronger than one that crosses a mail provider, so the stronger
 * method should be the one that takes no extra clicks.
 */

const CARD =
  'width:100%;max-width:440px;background:var(--ag-surface);border:1px solid var(--ag-border);border-radius:24px;padding:26px 26px 30px;box-shadow:0 30px 80px -30px rgba(107,20,54,.45);';
const PRIMARY =
  'width:100%;height:52px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-size:15px;font-weight:800;cursor:pointer;';
const LINK =
  'background:none;border:none;color:var(--ag-crimson);font-size:13.5px;font-weight:700;cursor:pointer;padding:0;';

function Shell({ icon, heading, sub, children }: { icon: string; heading: string; sub: string; children: ReactNode }) {
  return (
    <div style={css('position:fixed;inset:0;z-index:60;background:var(--ag-bg);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;')}>
      <div style={css(CARD)}>
        <div style={css('width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,#D6336C,#B02454);display:flex;align-items:center;justify-content:center;margin:0 auto;')}>
          <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:#fff;font-size:29px;")}>{icon}</span>
        </div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;text-align:center;margin-top:15px;line-height:1.15;color:var(--ag-ink);")}>{heading}</div>
        <div style={css('text-align:center;color:var(--ag-muted);font-size:13.5px;margin-top:9px;line-height:1.55;')}>{sub}</div>
        <div style={css('display:flex;flex-direction:column;gap:14px;margin-top:22px;')}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Six-digit input.
 *
 * `inputMode=numeric` rather than `type=number`: a spinner on an auth code is
 * absurd, and iOS shows the same keypad either way. Submits itself on the sixth
 * digit, because nobody wants to reach for a button after typing a code they
 * are already racing a clock to use.
 */
function CodeField({
  value,
  onChange,
  onComplete,
  disabled,
  label = 'Six-digit code',
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <label style={css('font-size:13px;font-weight:700;color:var(--ag-label);')}>
      {label}
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(next);
          if (next.length === 6) onComplete();
        }}
        placeholder="000000"
        style={css('width:100%;margin-top:7px;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:14px;padding:0 15px;height:56px;font-size:24px;font-weight:800;letter-spacing:.35em;text-align:center;color:var(--ag-ink);')}
      />
    </label>
  );
}

/** The one-time reveal of the backup codes. There is no second chance to read them. */
function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { showToast } = useShop();
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Shell
      icon="key"
      heading="Save your backup codes"
      sub="If you lose your phone or your inbox, one of these gets you back in. Each works once. This is the only time they are shown."
    >
      <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px;background:var(--ag-surface-2);border:1px solid var(--ag-border);border-radius:16px;padding:16px;')}>
        {codes.map((code) => (
          <div key={code} style={css("font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:13.5px;font-weight:700;color:var(--ag-ink);letter-spacing:.02em;")}>
            {code}
          </div>
        ))}
      </div>

      <div style={css('display:flex;gap:10px;')}>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(codes.join('\n')).then(
              () => showToast('Backup codes copied'),
              () => showToast('Could not copy — write them down instead', 'error'),
            );
          }}
          style={css('flex:1;height:46px;border:1.5px solid var(--ag-border);border-radius:14px;background:var(--ag-surface);color:var(--ag-ink);font-size:14px;font-weight:700;cursor:pointer;')}
        >
          Copy
        </button>
        <button
          type="button"
          onClick={() => {
            // A file download, not a print dialog: these want to end up in a
            // password manager or a drawer, and a printer is neither.
            const blob = new Blob([`MangaiMart backup codes\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mangaimart-backup-codes.txt';
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={css('flex:1;height:46px;border:1.5px solid var(--ag-border);border-radius:14px;background:var(--ag-surface);color:var(--ag-ink);font-size:14px;font-weight:700;cursor:pointer;')}
        >
          Download
        </button>
      </div>

      <label style={css('display:flex;gap:10px;align-items:flex-start;font-size:13.5px;color:var(--ag-muted);line-height:1.5;cursor:pointer;')}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          style={css('margin-top:3px;width:17px;height:17px;accent-color:#D6336C;cursor:pointer;')}
        />
        I have saved these somewhere safe.
      </label>

      <button type="button" disabled={!confirmed} onClick={onDone} style={css(`${PRIMARY}${confirmed ? '' : 'opacity:.5;cursor:not-allowed;'}`)}>
        Continue
      </button>
    </Shell>
  );
}

/** One of the two big buttons on the "pick a method" screen. */
function MethodChoice({
  icon,
  title,
  blurb,
  onClick,
  disabled,
}: {
  icon: string;
  title: string;
  blurb: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={css(`display:flex;gap:13px;align-items:flex-start;text-align:left;width:100%;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:16px;padding:15px 16px;cursor:pointer;${disabled ? 'opacity:.55;' : ''}`)}
    >
      <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:24px;color:var(--ag-crimson);line-height:1.1;")}>{icon}</span>
      <span style={css('flex:1;min-width:0;')}>
        <span style={css('display:block;font-size:14.5px;font-weight:800;color:var(--ag-ink);')}>{title}</span>
        <span style={css('display:block;font-size:12.5px;color:var(--ag-muted);margin-top:3px;line-height:1.5;')}>{blurb}</span>
      </span>
    </button>
  );
}

/**
 * Which screen we are on. `state` (from the database) answers "enrol or
 * challenge"; `step` answers "by which method, and how far in".
 */
type Step =
  | 'loading'
  | 'choose'
  | 'app-enroll'
  | 'app-challenge'
  | 'email-address'
  | 'email-code'
  | 'backup';

export function MfaGate({ onVerified }: { onVerified: () => void }) {
  const { showToast } = useShop();
  const [state, setState] = useState<MfaState | 'loading'>('loading');
  const [methods, setMethods] = useState<MfaMethods | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [enrollment, setEnrollment] = useState<EnrollStart | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [address, setAddress] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // `enrolling` decides what a correct email code MEANS: registering the address
  // for the first time, or unlocking a session with one already on file. The
  // server decides this too, from the same signal (an address in the request or
  // not); this copy is only so the screen can say the right thing afterwards.
  const enrollingEmail = step === 'email-address' || (step === 'email-code' && state === 'enroll');

  const load = useCallback(async () => {
    const [next, m] = await Promise.all([readMfaState(), readMfaMethods()]);
    setState(next);
    setMethods(m);

    if (next === 'enroll') {
      setStep('choose');
      return;
    }
    // Both methods available → offer the app, since it is the stronger one and
    // needs no round trip. Email-only accounts go straight to the code screen.
    setStep(m.app ? 'app-challenge' : 'email-code');
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The resend clock. 0102 refuses a second send inside sixty seconds, so the
  // button has to say so rather than let someone press it into an error.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = useCallback(
    async (to?: string) => {
      setBusy(true);
      try {
        const masked = await sendEmailCode(to);
        setSentTo(masked);
        setCooldown(60);
        setStep('email-code');
        setCode('');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not send a code', 'error');
        // A failed send on the enrolment path leaves the address form as the
        // only sensible place to be — the address may well be what was wrong.
        if (to) setStep('email-address');
      } finally {
        setBusy(false);
      }
    },
    [showToast],
  );

  // Auto-send when an email-only account lands on the code screen. Guarded by a
  // ref rather than by the dependency list: React 18's StrictMode mounts effects
  // twice in development, and the second send would come back as the sixty-second
  // cooldown error on a screen the user had not touched.
  const autoSent = useRef(false);
  useEffect(() => {
    if (step !== 'email-code' || state !== 'challenge' || autoSent.current) return;
    autoSent.current = true;
    void sendCode();
  }, [step, state, sendCode]);

  /** Finish an app enrolment or an app challenge. */
  async function submitAppCode(e?: FormEvent) {
    e?.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true);
    try {
      if (state === 'enroll') {
        if (!enrollment) throw new Error('Setup was interrupted. Reload and try again.');
        await verifyChallenge(enrollment.factorId, code);
        // Only now is the session aal2, which is what lets the RPC issue codes.
        setCodes(await generateBackupCodes());
      } else {
        const factorId = await verifiedFactorId();
        if (!factorId) throw new Error('No authenticator is registered on this account.');
        await verifyChallenge(factorId, code);
        // An account with no codes left — every one spent, or reset by an admin —
        // is one lost phone away from a support call. Top it up silently.
        if ((await backupCodesRemaining()) === 0) setCodes(await generateBackupCodes());
        else onVerified();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'That code did not work', 'error');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  /** Finish an email enrolment or an email challenge. */
  async function submitEmailCode(e?: FormEvent) {
    e?.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true);
    try {
      await verifyEmailCode(code);
      if (enrollingEmail) {
        // 0102 widened `mfa_verified()` so this works for an email-only account
        // too. Without that widening the users with the weaker factor would have
        // been the only ones with no recovery path at all.
        setCodes(await generateBackupCodes());
      } else if ((await backupCodesRemaining()) === 0) {
        setCodes(await generateBackupCodes());
      } else {
        onVerified();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'That code did not work', 'error');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function submitAddress(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !address.trim()) return;
    await sendCode(address.trim());
  }

  async function submitBackupCode(e?: FormEvent) {
    e?.preventDefault();
    if (busy || !backupCode.trim()) return;
    setBusy(true);
    try {
      await redeemBackupCode(backupCode);
      showToast('Two-factor cleared — set up a new method now');
      setBackupCode('');
      setCode('');
      autoSent.current = false;
      setState('loading');
      setStep('loading');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'That code is not valid', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function beginAppEnrolment() {
    setBusy(true);
    try {
      setEnrollment(await startEnrollment());
      setCode('');
      setStep('app-enroll');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not start setup', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (codes) return <BackupCodes codes={codes} onDone={onVerified} />;

  if (step === 'loading' || state === 'loading') {
    return (
      <Shell icon="lock" heading="Checking your session" sub="One moment.">
        <div />
      </Shell>
    );
  }

  if (step === 'backup') {
    return (
      <Shell
        icon="key"
        heading="Use a backup code"
        sub="Enter one of the codes you saved when you set up two-factor authentication. It clears the method you have lost, so you can set up a new one."
      >
        <form onSubmit={submitBackupCode} style={css('display:flex;flex-direction:column;gap:14px;')}>
          <label style={css('font-size:13px;font-weight:700;color:var(--ag-label);')}>
            Backup code
            <input
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              style={css("width:100%;margin-top:7px;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:14px;padding:0 15px;height:52px;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:15px;font-weight:700;text-align:center;color:var(--ag-ink);")}
            />
          </label>
          <button type="submit" disabled={busy} style={css(`${PRIMARY}${busy ? 'opacity:.6;' : ''}`)}>
            {busy ? 'Checking…' : 'Use this code'}
          </button>
          <div style={css('text-align:center;color:var(--ag-muted);font-size:12.5px;line-height:1.55;')}>
            Out of codes too? An admin can reset two-factor authentication for you from the Users screen.
          </div>
          <button type="button" onClick={() => setStep(methods?.app ? 'app-challenge' : 'email-code')} style={css(`${LINK}text-align:center;`)}>
            Back
          </button>
        </form>
      </Shell>
    );
  }

  // ── Enrolment: pick a method ───────────────────────────────────────────────
  if (step === 'choose') {
    return (
      <Shell
        icon="encrypted"
        heading="Set up two-factor authentication"
        sub="The console holds payouts, refunds and every customer record, so a password on its own is the only thing in front of all of it. Choose how you would like to confirm it is you."
      >
        <MethodChoice
          icon="smartphone"
          title="Authenticator app"
          blurb="Google Authenticator, Authy or your password manager generates a code every 30 seconds. Works with no signal and nothing to wait for."
          onClick={() => void beginAppEnrolment()}
          disabled={busy}
        />
        <MethodChoice
          icon="mail"
          title="Email code"
          blurb="We email a six-digit code to an address you choose — not the one you sign in with. No app to install."
          onClick={() => { setAddress(''); setStep('email-address'); }}
          disabled={busy}
        />
        <div style={css('text-align:center;color:var(--ag-muted);font-size:12px;line-height:1.55;')}>
          The app is the stronger of the two: its codes never leave your phone. Either one can be
          changed later from Settings.
        </div>
      </Shell>
    );
  }

  // ── Enrolment: scan a QR ───────────────────────────────────────────────────
  if (step === 'app-enroll') {
    return (
      <Shell
        icon="encrypted"
        heading="Scan this with your app"
        sub="Open Google Authenticator, Authy or your password manager, scan the code, then enter the six digits it shows."
      >
        {enrollment ? (
          <>
            {/* GoTrue returns the QR as an SVG data URL, so there is no QR
                library in the bundle. White plate behind it because a QR on a
                dark background does not scan. */}
            <div style={css('display:flex;justify-content:center;')}>
              <img
                src={enrollment.qrCode}
                alt="Two-factor setup QR code"
                width={188}
                height={188}
                style={css('width:188px;height:188px;background:#fff;border-radius:16px;padding:10px;border:1px solid var(--ag-border);')}
              />
            </div>

            <button type="button" onClick={() => setShowSecret((v) => !v)} style={css(`${LINK}text-align:center;`)}>
              {showSecret ? 'Hide setup key' : 'Can’t scan? Enter a key instead'}
            </button>
            {showSecret && (
              <div style={css("background:var(--ag-surface-2);border:1px solid var(--ag-border);border-radius:12px;padding:12px;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:13px;font-weight:700;word-break:break-all;text-align:center;color:var(--ag-ink);")}>
                {enrollment.secret}
              </div>
            )}

            <form onSubmit={submitAppCode} style={css('display:flex;flex-direction:column;gap:14px;')}>
              <CodeField value={code} onChange={setCode} onComplete={() => void submitAppCode()} disabled={busy} />
              <button type="submit" disabled={busy || code.length !== 6} style={css(`${PRIMARY}${busy || code.length !== 6 ? 'opacity:.5;' : ''}`)}>
                {busy ? 'Verifying…' : 'Turn on two-factor'}
              </button>
              <button type="button" onClick={() => setStep('choose')} style={css(`${LINK}text-align:center;`)}>
                Use an email code instead
              </button>
            </form>
          </>
        ) : (
          <div style={css('text-align:center;color:var(--ag-muted);font-size:13.5px;')}>Preparing your QR code…</div>
        )}
      </Shell>
    );
  }

  // ── Enrolment: name the security address ───────────────────────────────────
  if (step === 'email-address') {
    return (
      <Shell
        icon="mail"
        heading="Where should codes go?"
        sub="Use an address other than the one you sign in with. A password reset and a security code arriving in the same inbox would be one factor wearing two hats."
      >
        <form onSubmit={submitAddress} style={css('display:flex;flex-direction:column;gap:14px;')}>
          <label style={css('font-size:13px;font-weight:700;color:var(--ag-label);')}>
            Security email address
            <input
              type="email"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
              style={css('width:100%;margin-top:7px;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:14px;padding:0 15px;height:52px;font-size:15px;font-weight:600;color:var(--ag-ink);')}
            />
          </label>
          <button type="submit" disabled={busy || !address.trim()} style={css(`${PRIMARY}${busy || !address.trim() ? 'opacity:.5;' : ''}`)}>
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
          <button type="button" onClick={() => setStep('choose')} style={css(`${LINK}text-align:center;`)}>
            Back
          </button>
        </form>
      </Shell>
    );
  }

  // ── Challenge (or enrolment confirmation) by email ─────────────────────────
  if (step === 'email-code') {
    const where = sentTo || (methods?.emailAddress ? maskEmail(methods.emailAddress) : 'your security address');
    return (
      <Shell
        icon="mail"
        heading={enrollingEmail ? 'Confirm that address' : 'Check your email'}
        sub={`We sent a six-digit code to ${where}. It expires in ten minutes.`}
      >
        <form onSubmit={submitEmailCode} style={css('display:flex;flex-direction:column;gap:14px;')}>
          <CodeField value={code} onChange={setCode} onComplete={() => void submitEmailCode()} disabled={busy} />
          <button type="submit" disabled={busy || code.length !== 6} style={css(`${PRIMARY}${busy || code.length !== 6 ? 'opacity:.5;' : ''}`)}>
            {busy ? 'Verifying…' : enrollingEmail ? 'Turn on two-factor' : 'Unlock'}
          </button>

          <button
            type="button"
            disabled={busy || cooldown > 0}
            onClick={() => void sendCode(enrollingEmail ? address.trim() : undefined)}
            style={css(`${LINK}text-align:center;${busy || cooldown > 0 ? 'opacity:.5;cursor:default;' : ''}`)}
          >
            {cooldown > 0 ? `Send another code in ${cooldown}s` : 'Send another code'}
          </button>

          {/* Only offered once there is something to fall back TO. During
              enrolment there is no other method yet, so the way out is Back. */}
          {state === 'enroll' ? (
            <button type="button" onClick={() => setStep('email-address')} style={css(`${LINK}text-align:center;`)}>
              Use a different address
            </button>
          ) : (
            <>
              {methods?.app && (
                <button type="button" onClick={() => { setCode(''); setStep('app-challenge'); }} style={css(`${LINK}text-align:center;`)}>
                  Use my authenticator app instead
                </button>
              )}
              <button type="button" onClick={() => setStep('backup')} style={css(`${LINK}text-align:center;`)}>
                Can’t get the email? Use a backup code
              </button>
            </>
          )}
        </form>
      </Shell>
    );
  }

  // ── Challenge by app ───────────────────────────────────────────────────────
  return (
    <Shell
      icon="lock"
      heading="Enter your code"
      sub="Open your authenticator app and enter the six-digit code for MangaiMart."
    >
      <form onSubmit={submitAppCode} style={css('display:flex;flex-direction:column;gap:14px;')}>
        <CodeField value={code} onChange={setCode} onComplete={() => void submitAppCode()} disabled={busy} />
        <button type="submit" disabled={busy || code.length !== 6} style={css(`${PRIMARY}${busy || code.length !== 6 ? 'opacity:.5;' : ''}`)}>
          {busy ? 'Verifying…' : 'Unlock'}
        </button>
        {methods?.email && (
          <button
            type="button"
            disabled={busy}
            onClick={() => { setCode(''); autoSent.current = true; void sendCode(); }}
            style={css(`${LINK}text-align:center;`)}
          >
            Email me a code instead
          </button>
        )}
        <button type="button" onClick={() => setStep('backup')} style={css(`${LINK}text-align:center;`)}>
          Lost your phone? Use a backup code
        </button>
      </form>
    </Shell>
  );
}
