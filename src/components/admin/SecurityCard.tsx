import { useCallback, useEffect, useState } from 'react';
import { css } from '@/lib/css';
import { Card, ConfirmDialog, GhostButton, Icon, T } from '@/components/admin/kit';
import { useShop } from '@/state/ShopContext';
import {
  backupCodesRemaining,
  emailFactorStatus,
  generateBackupCodes,
  listAuthenticators,
  maskEmail,
  removeAuthenticator,
  removeEmailFactor,
  sendEmailCode,
  startEnrollment,
  verifyChallenge,
  verifyEmailCode,
  type Authenticator,
  type EnrollStart,
} from '@/lib/mfa';

/**
 * "Your security" — the console's own two-factor panel.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE GATE
 * `RequireMfa` gets you IN. It shows an enrolment choice to somebody with no
 * second factor and a keypad to somebody who has one, and then it gets out of
 * the way. Everything you might want to do about 2FA once you are already
 * inside — check how many backup codes are left, print a fresh set before a
 * trip, register the laptop as a second device so a lost phone is an
 * inconvenience rather than a support call, move your codes to a new email
 * address — had nowhere to live. This is that place.
 *
 * WHY IT IS MOUNTED TWICE
 * Staff cannot open Settings (`STAFF_ROUTES` in lib/staffAccess), and after
 * migration 0100 they need 2FA exactly as much as an admin does. So this card
 * renders on the admin Settings page AND on StaffHome. One component, two
 * mount points, rather than a screen half the console cannot reach.
 *
 * WHAT IT DELIBERATELY WILL NOT DO
 * There is no "turn two-factor off". After 0100/0102 an account with no factor
 * of either kind can never satisfy `is_admin()`, and the console's policies do
 * — so that button would be a silent, permanent self-lockout whose only remedy
 * is pasting rollback SQL into the Supabase editor. Dropping a SPARE method is
 * offered and safe; both `removeAuthenticator` and the `email-remove` action
 * refuse to remove the last one, and the second of those refuses on the server,
 * where a refusal is worth something.
 */

const CODE_GRID =
  "font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:13px;font-weight:700;letter-spacing:.02em;";

type EmailFactor = { email: string; verified: boolean; sessionVerified: boolean } | null;

/** Where the email sub-flow is: closed, naming an address, or confirming one. */
type EmailStep = 'idle' | 'address' | 'code';

export function SecurityCard() {
  const { showToast } = useShop();

  const [devices, setDevices] = useState<Authenticator[] | null>(null);
  const [email, setEmail] = useState<EmailFactor>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Enrolment sub-flow — used both for the very first authenticator and for
  // adding a second device, because they are the same three steps.
  const [enrolling, setEnrolling] = useState<EnrollStart | null>(null);
  const [code, setCode] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<Authenticator | null>(null);

  // The email sub-flow, which is the same three steps in a different order:
  // name an address, prove you can read it, and it becomes the address.
  const [emailStep, setEmailStep] = useState<EmailStep>('idle');
  const [address, setAddress] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [confirmRemoveEmail, setConfirmRemoveEmail] = useState(false);

  const load = useCallback(async () => {
    const [list, mail] = await Promise.all([listAuthenticators(), emailFactorStatus()]);
    setDevices(list);
    setEmail(mail);
    // Backup codes exist per account, not per method, so the count is worth
    // showing as soon as EITHER method is live.
    setRemaining(list.length || mail?.verified ? await backupCodesRemaining() : null);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 0102 refuses a second send inside sixty seconds. The button says so rather
  // than letting someone press it into an error.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function beginEnrol() {
    setBusy(true);
    try {
      // Named by position and date so a second device is distinguishable in the
      // list, and so re-adding after a removal cannot collide with a name
      // GoTrue still holds — friendly names must be unique per user.
      const n = (devices?.length ?? 0) + 1;
      const stamp = new Date().toISOString().slice(0, 10);
      setEnrolling(await startEnrollment(n === 1 ? 'MangaiMart' : `MangaiMart ${n} · ${stamp}`));
      setCode('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not start setup', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function finishEnrol() {
    if (!enrolling || code.length !== 6 || busy) return;
    setBusy(true);
    try {
      await verifyChallenge(enrolling.factorId, code);
      const first = (devices?.length ?? 0) === 0 && !email?.verified;
      setEnrolling(null);
      setCode('');
      // A first factor has no backup codes behind it yet; a second one shares
      // the set that already exists, so minting a new one there would silently
      // invalidate the codes already written down somewhere.
      if (first) setCodes(await generateBackupCodes());
      else showToast('Device added');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That code did not work', 'error');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function sendAddressCode() {
    if (busy || !address.trim()) return;
    setBusy(true);
    try {
      setSentTo(await sendEmailCode(address.trim()));
      setCooldown(60);
      setEmailCode('');
      setEmailStep('code');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not send a code', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function finishEmail() {
    if (emailCode.length !== 6 || busy) return;
    setBusy(true);
    try {
      await verifyEmailCode(emailCode);
      const first = (devices?.length ?? 0) === 0 && !email?.verified;
      setEmailStep('idle');
      setEmailCode('');
      setAddress('');
      if (first) setCodes(await generateBackupCodes());
      else showToast('Security address saved');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That code did not work', 'error');
      setEmailCode('');
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    try {
      setCodes(await generateBackupCodes());
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not generate codes', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doRemove() {
    if (!confirmRemove) return;
    setBusy(true);
    try {
      await removeAuthenticator(confirmRemove.id);
      showToast('Device removed');
      setConfirmRemove(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not remove that device', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doRemoveEmail() {
    setBusy(true);
    try {
      await removeEmailFactor();
      showToast('Email code turned off');
      setConfirmRemoveEmail(false);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not turn that off', 'error');
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div style={css('display:flex;align-items:center;gap:10px;margin-bottom:4px;')}>
      <Icon name="encrypted" size={19} color="var(--ag-crimson)" />
      <div style={css('font-weight:800;font-size:15px;')}>Your security</div>
    </div>
  );

  if (devices === null) {
    return (
      <Card>
        {header}
        <div style={css(`font-size:12.5px;color:${T.muted};`)}>Checking…</div>
      </Card>
    );
  }

  // ── The one-time reveal of a fresh set of backup codes ────────────────────
  if (codes) {
    return (
      <Card style="border:1.5px solid var(--ag-crimson);">
        {header}
        <div style={css(`font-size:12.5px;color:${T.muted};line-height:1.6;margin-bottom:12px;`)}>
          Save these somewhere that is not your phone or your inbox. Each works once, and this is the
          only time they are shown — they are stored as hashes, so there is nowhere to read them back
          from. Any codes from an earlier set have just stopped working.
        </div>
        <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px;background:var(--ag-surface-2);border:1px solid var(--ag-border);border-radius:14px;padding:14px;')}>
          {codes.map((c) => (
            <div key={c} style={css(CODE_GRID)}>{c}</div>
          ))}
        </div>
        <div style={css('display:flex;gap:10px;justify-content:flex-end;margin-top:14px;')}>
          <GhostButton
            icon="content_copy"
            onClick={() => {
              navigator.clipboard?.writeText(codes.join('\n')).then(
                () => showToast('Backup codes copied'),
                () => showToast('Could not copy — write them down instead', 'error'),
              );
            }}
          >
            Copy
          </GhostButton>
          <GhostButton
            icon="download"
            onClick={() => {
              const blob = new Blob([`MangaiMart backup codes\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'mangaimart-backup-codes.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download
          </GhostButton>
          <GhostButton icon="check" onClick={() => setCodes(null)}>I’ve saved them</GhostButton>
        </div>
      </Card>
    );
  }

  // ── Scanning a QR, for a first authenticator or an extra device ───────────
  if (enrolling) {
    return (
      <Card>
        {header}
        <div style={css(`font-size:12.5px;color:${T.muted};line-height:1.6;margin-bottom:14px;`)}>
          Scan this with your authenticator app, then enter the six-digit code it shows.
        </div>
        <div style={css('display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;')}>
          {/* White plate behind the QR — GoTrue returns a plain SVG, and a QR on
              a dark background does not scan. */}
          <img
            src={enrolling.qrCode}
            alt="Two-factor setup QR code"
            width={168}
            height={168}
            style={css('width:168px;height:168px;background:#fff;border-radius:14px;padding:9px;border:1px solid var(--ag-border);flex:none;')}
          />
          <div style={css('flex:1;min-width:200px;')}>
            <div style={css('font-weight:700;font-size:13px;margin-bottom:6px;')}>Six-digit code</div>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(next);
                if (next.length === 6) void finishEnrol();
              }}
              placeholder="000000"
              style={css('width:100%;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:12px;padding:0 14px;height:48px;font-size:20px;font-weight:800;letter-spacing:.3em;text-align:center;color:var(--ag-ink);')}
            />
            <div style={css(`font-size:11.5px;color:${T.muted};margin-top:8px;line-height:1.5;word-break:break-all;`)}>
              Can’t scan? Enter this key by hand: <span style={css(CODE_GRID)}>{enrolling.secret}</span>
            </div>
            <div style={css('display:flex;gap:10px;margin-top:12px;')}>
              <GhostButton icon="check" onClick={() => void finishEnrol()} disabled={busy || code.length !== 6}>
                Verify
              </GhostButton>
              <GhostButton icon="close" onClick={() => { setEnrolling(null); setCode(''); }} disabled={busy}>
                Cancel
              </GhostButton>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // ── Naming or changing the security address ──────────────────────────────
  if (emailStep === 'address') {
    return (
      <Card>
        {header}
        <div style={css(`font-size:12.5px;color:${T.muted};line-height:1.6;margin-bottom:14px;`)}>
          Use an address other than the one you sign in with. A password reset and a security code
          arriving in the same inbox would be one factor wearing two hats, and the server refuses it
          for that reason.
        </div>
        <input
          type="email"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          style={css('width:100%;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:12px;padding:0 14px;height:48px;font-size:14.5px;font-weight:600;color:var(--ag-ink);')}
        />
        <div style={css('display:flex;gap:10px;margin-top:12px;')}>
          <GhostButton icon="send" onClick={() => void sendAddressCode()} disabled={busy || !address.trim()}>
            Send a code
          </GhostButton>
          <GhostButton icon="close" onClick={() => { setEmailStep('idle'); setAddress(''); }} disabled={busy}>
            Cancel
          </GhostButton>
        </div>
      </Card>
    );
  }

  // ── Confirming it ─────────────────────────────────────────────────────────
  if (emailStep === 'code') {
    return (
      <Card>
        {header}
        <div style={css(`font-size:12.5px;color:${T.muted};line-height:1.6;margin-bottom:14px;`)}>
          We sent a six-digit code to <strong>{sentTo || maskEmail(address)}</strong>. It expires in ten
          minutes. Entering it makes that address the one your future sign-in codes go to.
        </div>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={emailCode}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '').slice(0, 6);
            setEmailCode(next);
            if (next.length === 6) void finishEmail();
          }}
          placeholder="000000"
          style={css('width:100%;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:12px;padding:0 14px;height:48px;font-size:20px;font-weight:800;letter-spacing:.3em;text-align:center;color:var(--ag-ink);')}
        />
        <div style={css('display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;')}>
          <GhostButton icon="check" onClick={() => void finishEmail()} disabled={busy || emailCode.length !== 6}>
            Verify
          </GhostButton>
          <GhostButton icon="refresh" onClick={() => void sendAddressCode()} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
          </GhostButton>
          <GhostButton icon="close" onClick={() => { setEmailStep('idle'); setEmailCode(''); setAddress(''); }} disabled={busy}>
            Cancel
          </GhostButton>
        </div>
      </Card>
    );
  }

  const hasAny = devices.length > 0 || !!email?.verified;

  // ── Not set up yet ────────────────────────────────────────────────────────
  if (!hasAny) {
    return (
      <Card style="border:1.5px solid var(--ag-warn-text);">
        {header}
        <div style={css(`font-size:12.5px;color:${T.muted};line-height:1.6;margin-bottom:14px;`)}>
          Two-factor authentication is <strong>not set up</strong> on your account. The console holds
          payouts, refunds and every customer record, so a password on its own is the only thing
          standing in front of all of it. Pick either method — it takes about a minute.
        </div>
        <div style={css('display:flex;gap:10px;flex-wrap:wrap;')}>
          <GhostButton icon="smartphone" onClick={() => void beginEnrol()} disabled={busy}>
            Use an authenticator app
          </GhostButton>
          <GhostButton icon="mail" onClick={() => { setAddress(''); setEmailStep('address'); }} disabled={busy}>
            Use an email code
          </GhostButton>
        </div>
      </Card>
    );
  }

  // ── Set up ────────────────────────────────────────────────────────────────
  const low = remaining !== null && remaining <= 3;
  // Removal is offered only when something else would still be standing. The
  // count is across BOTH methods, because that is what `is_admin()` counts.
  const factorCount = devices.length + (email?.verified ? 1 : 0);

  return (
    <Card>
      {header}
      <div style={css(`font-size:12.5px;color:${T.muted};line-height:1.6;margin-bottom:14px;`)}>
        Two-factor authentication is on. You are asked for a code when you sign in — not on every
        visit, because the session keeps its verification until you sign out.
      </div>

      <div style={css('display:flex;flex-direction:column;gap:8px;')}>
        {devices.map((d) => (
          <div key={d.id} style={css('display:flex;align-items:center;gap:11px;background:var(--ag-surface-2);border:1px solid var(--ag-border);border-radius:12px;padding:10px 12px;')}>
            <Icon name="smartphone" size={18} color="var(--ag-good-text)" />
            <div style={css('flex:1;min-width:0;')}>
              <div style={css('font-weight:700;font-size:13.5px;')}>{d.name}</div>
              {d.createdAt && (
                <div style={css(`font-size:11.5px;color:${T.muted};margin-top:1px;`)}>
                  Added {new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
            {/* Only when something else remains. Removing the last factor would
                lock the account out of the console permanently. */}
            {factorCount > 1 && (
              <GhostButton icon="delete" onClick={() => setConfirmRemove(d)} disabled={busy}>
                Remove
              </GhostButton>
            )}
          </div>
        ))}

        {email?.verified ? (
          <div style={css('display:flex;align-items:center;gap:11px;background:var(--ag-surface-2);border:1px solid var(--ag-border);border-radius:12px;padding:10px 12px;')}>
            <Icon name="mail" size={18} color="var(--ag-good-text)" />
            <div style={css('flex:1;min-width:0;')}>
              <div style={css('font-weight:700;font-size:13.5px;')}>Email code</div>
              <div style={css(`font-size:11.5px;color:${T.muted};margin-top:1px;word-break:break-all;`)}>
                Codes go to {maskEmail(email.email)}
              </div>
            </div>
            <GhostButton icon="edit" onClick={() => { setAddress(''); setEmailStep('address'); }} disabled={busy}>
              Change
            </GhostButton>
            {factorCount > 1 && (
              <GhostButton icon="delete" onClick={() => setConfirmRemoveEmail(true)} disabled={busy}>
                Remove
              </GhostButton>
            )}
          </div>
        ) : (
          <div style={css('display:flex;align-items:center;gap:11px;background:var(--ag-surface-2);border:1px dashed var(--ag-border);border-radius:12px;padding:10px 12px;')}>
            <Icon name="mail" size={18} color={T.muted} />
            <div style={css('flex:1;min-width:0;')}>
              <div style={css('font-weight:700;font-size:13.5px;')}>Email code</div>
              <div style={css(`font-size:11.5px;color:${T.muted};margin-top:1px;line-height:1.45;`)}>
                Not set up. A second method means a lost phone is an inconvenience, not a support call.
              </div>
            </div>
            <GhostButton icon="add" onClick={() => { setAddress(''); setEmailStep('address'); }} disabled={busy}>
              Set up
            </GhostButton>
          </div>
        )}
      </div>

      <div style={css(`display:flex;align-items:center;gap:11px;margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid ${low ? 'var(--ag-warn-text)' : 'var(--ag-border)'};background:${low ? 'var(--ag-warn-bg)' : 'var(--ag-surface-2)'};`)}>
        <Icon name="key" size={18} color={low ? 'var(--ag-gold-text)' : T.muted} />
        <div style={css('flex:1;min-width:0;')}>
          <div style={css('font-weight:700;font-size:13.5px;')}>
            {remaining ?? 0} of 10 backup codes left
          </div>
          <div style={css(`font-size:11.5px;color:${T.muted};margin-top:1px;line-height:1.45;`)}>
            {low
              ? 'Running low. Generate a fresh set while you still have a working method.'
              : 'Each works once, and gets you back in if you lose your phone or your inbox.'}
          </div>
        </div>
        <GhostButton icon="refresh" onClick={() => void regenerate()} disabled={busy}>
          Regenerate
        </GhostButton>
      </div>

      <div style={css('display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap;')}>
        <div style={css(`font-size:11.5px;color:${T.muted};line-height:1.5;flex:1;min-width:220px;`)}>
          Adding a second device — a laptop password manager, a tablet — means a lost phone never
          locks you out.
        </div>
        <GhostButton icon="add" onClick={() => void beginEnrol()} disabled={busy}>
          Add a device
        </GhostButton>
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove this authenticator?"
        message={`${confirmRemove?.name ?? 'This device'} will stop generating codes for your account. You will still have ${factorCount - 1} other way${factorCount - 1 === 1 ? '' : 's'} to verify, so you keep access.`}
        confirmLabel="Remove"
        danger
        busy={busy}
        onConfirm={() => void doRemove()}
        onCancel={() => setConfirmRemove(null)}
      />

      <ConfirmDialog
        open={confirmRemoveEmail}
        title="Turn off email codes?"
        message={`We will stop sending codes to ${email ? maskEmail(email.email) : 'your security address'}, and any session verified that way is signed out of the console immediately. You will still have ${factorCount - 1} other way${factorCount - 1 === 1 ? '' : 's'} to verify.`}
        confirmLabel="Turn off"
        danger
        busy={busy}
        onConfirm={() => void doRemoveEmail()}
        onCancel={() => setConfirmRemoveEmail(false)}
      />
    </Card>
  );
}
