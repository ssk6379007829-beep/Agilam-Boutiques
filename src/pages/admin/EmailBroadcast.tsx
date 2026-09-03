import { useMemo, useState } from 'react';
import { css } from '@/lib/css';
import { useAsync } from '@/hooks/useAsync';
import { useShop } from '@/state/ShopContext';
import { useAuth } from '@/auth/AuthContext';
import { logAdminAction } from '@/data/activityLog';
import { broadcast, fetchAudienceSizes, type Audience } from '@/data/broadcast';
import { imageUrl } from '@/lib/imageUrl';
import { fmtInr } from '@/lib/tokens';
import {
  sendEmailBroadcast,
  fetchEmailReach,
  fetchPickableProducts,
  fetchEmailBroadcastHistory,
  searchEmailRecipients,
  MARKETING_TEMPLATES,
  type EmailTemplate,
  type EmailAudience,
  type PickableProduct,
  type EmailPerson,
} from '@/data/emailBroadcast';
import { useDebounced } from '@/hooks/useDebounced';
import { Card, GhostButton, ConfirmDialog, Icon, StatusPill, EmptyState, T } from '@/components/admin/kit';

/**
 * Email broadcast — the inbox half of the Broadcast page.
 *
 * Its sibling tab writes the in-app notification bell and is instant, reversible
 * in practice (nobody screenshots a bell) and open to staff. This one puts a
 * message in thousands of inboxes under the company's sending domain, cannot be
 * recalled, and is admin-only. The UI is built around that difference: a forced
 * template choice, a real preview, a test-to-myself button, a reach count that
 * subtracts people who unsubscribed, and a confirm step that repeats the number.
 *
 * Sending happens in the `broadcast-email` Edge Function (api/ is at Vercel's
 * 12-route ceiling); everything here is composition.
 */

type TemplateMeta = {
  key: EmailTemplate;
  label: string;
  icon: string;
  blurb: string;
  /** Placeholder copy — shows the shape of a good message for this template. */
  sample: { subject: string; heading: string; body: string; cta: string };
};

const TEMPLATES: TemplateMeta[] = [
  {
    key: 'announcement',
    label: 'Announcement',
    icon: 'campaign',
    blurb: 'A sale, a coupon, anything with one clear action.',
    sample: {
      subject: 'Diwali sale — up to 40% off ethnic wear',
      heading: 'Our Diwali sale is live',
      body:
        'Silk sarees, lehengas and kurta sets from verified boutiques across Tamil Nadu are on offer until Sunday.\n\n' +
        'Use code DIWALI15 at checkout for an extra 15% off your first order.',
      cta: 'Shop the sale',
    },
  },
  {
    key: 'arrivals',
    label: 'New arrivals',
    icon: 'auto_awesome',
    blurb: 'Show up to six real products, with photo and price.',
    sample: {
      subject: 'Just in: handloom cottons for the season',
      heading: 'New this week',
      body: 'A few pieces our boutiques added in the last few days. Every one ships from a verified shop.',
      cta: 'See everything new',
    },
  },
  {
    key: 'festival',
    label: 'Festival greeting',
    icon: 'celebration',
    blurb: 'A warm wish. Centred, minimal, barely sells.',
    sample: {
      subject: 'Happy Pongal from all of us',
      heading: 'Happy Pongal',
      body:
        'From every boutique on MangaiMart and everyone behind it — we hope this year brings you a full harvest and a fuller home.\n\n' +
        'Thank you for shopping small with us.',
      cta: 'Visit MangaiMart',
    },
  },
  {
    key: 'feature',
    label: 'New in the app',
    icon: 'new_releases',
    blurb: 'Tell people about something you just built.',
    sample: {
      subject: 'New: ask your family before you buy',
      heading: "Can't decide? Ask your people",
      body:
        'Shortlist the sarees you are torn between and share one link. Your family votes — no account, no app, no group chat screenshots.\n\n' +
        '- Save any product to a shortlist from its page\n' +
        '- Share the link on WhatsApp\n' +
        '- Everyone votes, you see the result live',
      cta: 'Try it now',
    },
  },
  {
    key: 'service',
    label: 'Service update',
    icon: 'info',
    blurb: 'Operational notice. Ignores unsubscribes — never sell with it.',
    sample: {
      subject: 'Delivery timings during the festival week',
      heading: 'Delivery may take a day longer this week',
      body:
        'Courier partners across Tamil Nadu are running at capacity between the 12th and the 18th, so some orders may arrive a day later than the estimate shown at checkout.\n\n' +
        'Your tracking link stays accurate throughout, and nothing about your order or refund rights changes.',
      cta: '',
    },
  },
];

const AUDIENCES: { key: EmailAudience; label: string; icon: string }[] = [
  { key: 'all', label: 'Everyone', icon: 'public' },
  { key: 'buyer', label: 'Buyers', icon: 'group' },
  { key: 'seller', label: 'Sellers', icon: 'storefront' },
  // The one-off: search for a person by name or address and email just them.
  { key: 'selected', label: 'Specific people', icon: 'person_search' },
];

export function EmailBroadcast() {
  const { showToast } = useShop();
  const { profile } = useAuth();

  const [template, setTemplate] = useState<EmailTemplate>('announcement');
  const [audience, setAudience] = useState<EmailAudience>('all');
  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('');
  const [preheader, setPreheader] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [picked, setPicked] = useState<PickableProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [people, setPeople] = useState<EmailPerson[]>([]);
  const [personSearch, setPersonSearch] = useState('');
  // One composer, one Send, both channels. These were two tabs with two
  // composers until the same announcement started being written twice, once
  // for the inbox and once for the bell, with the wording drifting between
  // them. Both default to on: the common case is that a broadcast should
  // reach people who read email AND people who never open it.
  const [sendBell, setSendBell] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const meta = TEMPLATES.find((t) => t.key === template)!;
  const marketing = MARKETING_TEMPLATES.includes(template);

  // The bell fans out by ROLE and has no notion of "these four people", so a
  // hand-picked send is email's alone. That is the one rule that still takes a
  // channel away here.
  //
  // Email was admins-only until now, enforced by is_admin() inside the Edge
  // Function. Staff send it too (owner's decision, 2026-09-03) — a deliberate
  // widening of the boundary 0089 drew: the gate moved to is_staff() there, and
  // migration 0108 widens the history policy to match. BOTH have to be live or
  // a staff session still gets 403 from an undeployed function.
  const bellAllowed = audience !== 'selected';
  const bellOn = sendBell && bellAllowed;
  const emailOn = sendEmail;

  // Reach is template-dependent: a marketing send skips everyone who unsubscribed,
  // a service update does not. Refetched when that distinction changes.
  const { data: reach } = useAsync(() => fetchEmailReach(marketing), [marketing]);
  // The channels do not reach the same people: email needs an address on file
  // and skips marketing unsubscribes, the bell needs neither. Both counts are
  // shown rather than one blended number that would be wrong for both.
  const { data: bellSizes } = useAsync(() => fetchAudienceSizes(), []);
  const { data: history } = useAsync(() => fetchEmailBroadcastHistory(), [historyKey]);
  const { data: pickable, loading: picking } = useAsync(
    () => (pickerOpen ? fetchPickableProducts(productSearch) : Promise.resolve([])),
    [pickerOpen, productSearch],
  );

  const personTerm = useDebounced(personSearch, 300);
  const { data: found, loading: searching } = useAsync(
    () => (audience === 'selected' ? searchEmailRecipients(personTerm) : Promise.resolve([])),
    [audience, personTerm],
  );

  // A marketing template still skips someone who unsubscribed, even when you
  // picked them by name — so the count that matters is the one after that filter,
  // and it is shown before the send, not discovered afterwards.
  const skippedPicked = marketing ? people.filter((p) => p.marketing_opt_out).length : 0;
  const recipients = audience === 'selected' ? people.length - skippedPicked : (reach?.[audience] ?? 0);
  const bellReach = bellAllowed ? (bellSizes?.[audience as Audience] ?? 0) : 0;
  // Every channel that is on has to have somebody at the other end of it.
  const written = subject.trim().length > 0 && body.trim().length > 0;
  const canSend =
    written && ((emailOn && recipients > 0) || (bellOn && bellReach > 0));

  /** Fill the composer with this template's sample so nobody starts from a blank page. */
  const useSample = () => {
    setSubject(meta.sample.subject);
    setHeading(meta.sample.heading);
    setBody(meta.sample.body);
    setCtaLabel(meta.sample.cta);
    setCtaUrl(meta.sample.cta ? '/' : '');
    setPreheader('');
    showToast(`Loaded the ${meta.label.toLowerCase()} example — edit it before sending`, 'info');
  };

  const payload = (test: boolean) => ({
    template,
    audience,
    subject: subject.trim(),
    heading: heading.trim() || subject.trim(),
    preheader: preheader.trim(),
    body: body.trim(),
    ctaLabel: ctaLabel.trim(),
    ctaUrl: ctaUrl.trim(),
    productIds: picked.map((p) => p.id),
    recipientIds: audience === 'selected' ? people.map((p) => p.id) : [],
    // `bellAllowed` has already forced this off for a hand-picked send, so the
    // switch is the whole answer by the time it gets here.
    alsoNotify: bellOn,
    test,
  });

  const sendTest = async () => {
    if (!subject.trim() || !body.trim()) {
      showToast('Add a subject and a message first', 'warning');
      return;
    }
    setBusy(true);
    const res = await sendEmailBroadcast(payload(true));
    setBusy(false);
    showToast(res.ok ? 'Test sent to your own address — check your inbox' : res.error || 'Test failed', 'error');
  };

  /** Clear the composer after a send on either channel. */
  const resetComposer = () => {
    setSubject('');
    setHeading('');
    setPreheader('');
    setBody('');
    setCtaLabel('');
    setCtaUrl('');
    setPicked([]);
    setPeople([]);
    setPersonSearch('');
    setHistoryKey((k) => k + 1);
  };

  const send = async () => {
    setBusy(true);

    // Bell without email is the one combination that does not go through the
    // Edge Function at all. Routing it through a send with no email channel
    // would write a row to `email_broadcasts` describing an email that never
    // existed, and that table is the record of what actually left the
    // building. The slicing mirrors what the function applies server-side, so
    // the bell text is identical whichever path produced it.
    if (!emailOn) {
      const res = await broadcast(
        audience as Audience,
        (heading.trim() || subject.trim()).slice(0, 80),
        body.trim().slice(0, 280),
      );
      setBusy(false);
      setConfirm(false);
      if (!res.ok) {
        showToast(res.error, 'error');
        return;
      }
      void logAdminAction({
        actor_id: profile?.id,
        actor_name: profile?.full_name ?? 'Admin',
        action: 'broadcast.send',
        entity_type: 'notification',
        meta: { audience, sent: res.sent },
      });
      showToast(`Broadcast sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}`);
      resetComposer();
      return;
    }

    const res = await sendEmailBroadcast(payload(false));
    setBusy(false);
    setConfirm(false);

    if (!res.ok) {
      showToast(res.error || 'Nothing was sent', 'error');
      return;
    }

    void logAdminAction({
      actor_id: profile?.id,
      actor_name: profile?.full_name ?? 'Admin',
      action: 'broadcast.email',
      entity_type: 'email_broadcast',
      meta: { audience, template, subject: subject.trim(), sent: res.sent, failed: res.failed },
    });

    showToast(
      res.failed > 0
        ? `Sent to ${res.sent}, ${res.failed} failed`
        : `Emailed ${res.sent} ${res.sent === 1 ? 'person' : 'people'}${res.alsoNotified ? ' + notification bell' : ''}`,
      // The broadcast went out either way, so this is never an error — but a
      // partial failure is something the admin has to follow up on.
      res.failed > 0 ? 'warning' : 'success',
    );
    resetComposer();
  };

  const field = `width:100%;border:1.5px solid ${T.field};border-radius:12px;background:var(--ag-surface);font-size:14px;font-family:inherit;color:var(--ag-ink);padding:12px 14px;box-sizing:border-box;`;
  const label = `font-size:12px;font-weight:800;color:${T.muted};text-transform:uppercase;letter-spacing:.04em;margin:18px 0 8px;`;

  return (
    <>
      {reach?.notReady && (
        <div style={css('background:var(--ag-warn-bg,var(--ag-gold-bg));border:1px solid var(--ag-border);border-radius:12px;padding:12px 16px;margin-bottom:14px;font-size:13px;font-weight:600;display:flex;gap:8px;align-items:flex-start;line-height:1.5;')}>
          <Icon name="warning" size={18} color="#8A6D00" />
          <span>
            Email broadcasts are not enabled yet — <b>apply migration 0089</b> and deploy the{' '}
            <code>broadcast-email</code> function. You can compose here, but sending will fail.
          </span>
        </div>
      )}

      <div className="agx-adm-split" style={css('align-items:start;')}>
        <Card>
          <div style={css('font-weight:800;font-size:15px;margin-bottom:4px;')}>Compose broadcast</div>
          <div style={css(`font-size:12.5px;color:${T.muted};margin-bottom:14px;line-height:1.5;`)}>
            {emailOn
              ? 'This lands in a real inbox and cannot be recalled. Send yourself a test first.'
              : 'This appears in the notification bell the moment people next open the app. It cannot be recalled.'}
          </div>

          {/* Template, preview text and the button shape the EMAIL and nothing
              else. On a bell-only send they would be controls that do nothing,
              so they come out of the form rather than sit there inert. */}
          {emailOn && (
          <>
          <div style={css(label + 'margin-top:0;')}>Template</div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;')}>
            {TEMPLATES.map((t) => {
              const on = template === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTemplate(t.key)}
                  style={css(`text-align:left;border:1.5px solid ${on ? 'var(--ag-crimson)' : T.field};background:${on ? 'var(--ag-bad-bg)' : 'var(--ag-surface)'};border-radius:14px;padding:12px;cursor:pointer;font-family:inherit;`)}
                >
                  <Icon name={t.icon} size={20} color={on ? 'var(--ag-crimson)' : T.muted} />
                  <div style={css(`font-weight:800;font-size:13px;margin-top:6px;color:${on ? 'var(--ag-crimson)' : 'var(--ag-label)'};`)}>{t.label}</div>
                  <div style={css(`font-size:11.5px;color:${T.muted};margin-top:3px;line-height:1.45;`)}>{t.blurb}</div>
                </button>
              );
            })}
          </div>

          <div style={css('display:flex;justify-content:space-between;align-items:center;margin-top:10px;')}>
            <span style={css(`font-size:11.5px;color:${T.muted};line-height:1.5;`)}>
              {marketing
                ? 'Marketing — skips anyone who unsubscribed, and carries an unsubscribe link.'
                : 'Operational — reaches everyone, including people who unsubscribed from marketing.'}
            </span>
            <GhostButton icon="auto_fix_high" onClick={useSample}>Use example</GhostButton>
          </div>
          </>
          )}

          <div style={css(label)}>Audience</div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;')}>
            {AUDIENCES.map((a) => {
              const on = audience === a.key;
              const count = a.key === 'selected' ? people.length : reach ? reach[a.key] : null;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAudience(a.key)}
                  style={css(`border:1.5px solid ${on ? 'var(--ag-crimson)' : T.field};background:${on ? 'var(--ag-bad-bg)' : 'var(--ag-surface)'};border-radius:14px;padding:14px 10px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:6px;`)}
                >
                  <Icon name={a.icon} size={22} color={on ? 'var(--ag-crimson)' : T.muted} />
                  <span style={css(`font-weight:800;font-size:13px;text-align:center;color:${on ? 'var(--ag-crimson)' : 'var(--ag-label)'};`)}>{a.label}</span>
                  <span style={css(`font-size:11px;color:${T.muted};font-weight:700;`)}>
                    {a.key === 'selected' ? `${count} chosen` : `${count ?? '…'} reachable`}
                  </span>
                </button>
              );
            })}
          </div>
          {marketing && audience !== 'selected' && !!reach?.optedOut && (
            <div style={css(`font-size:11.5px;color:${T.muted};margin-top:8px;`)}>
              {reach.optedOut} {reach.optedOut === 1 ? 'person has' : 'people have'} unsubscribed from marketing and will be skipped.
            </div>
          )}

          {audience === 'selected' && (
            <div style={css(`margin-top:12px;border:1.5px solid ${T.field};border-radius:14px;padding:12px;`)}>
              {people.length > 0 && (
                <div style={css('display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;')}>
                  {people.map((p) => {
                    const skipped = marketing && p.marketing_opt_out;
                    return (
                      <div
                        key={p.id}
                        title={skipped ? 'Unsubscribed from marketing — this template will skip them' : p.email}
                        style={css(`display:flex;align-items:center;gap:7px;border:1.5px solid ${skipped ? 'var(--ag-gold-border)' : T.field};background:${skipped ? 'var(--ag-gold-bg)' : 'var(--ag-surface)'};border-radius:999px;padding:5px 8px 5px 11px;`)}
                      >
                        <span style={css('font-size:12.5px;font-weight:700;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>
                          {p.full_name || p.email}
                        </span>
                        {skipped && <Icon name="unsubscribe" size={14} color="#8A6D00" />}
                        <button
                          type="button"
                          onClick={() => setPeople((list) => list.filter((x) => x.id !== p.id))}
                          style={css(`border:none;background:none;cursor:pointer;color:${T.muted};display:flex;padding:0;`)}
                          title="Remove"
                        >
                          <Icon name="close" size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <input
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                placeholder="Search by name or email address…"
                style={css(field)}
              />

              {personSearch.trim().length >= 2 && (
                <div style={css('margin-top:8px;max-height:220px;overflow-y:auto;')} className="agx-scroll">
                  {searching ? (
                    <div style={css(`font-size:12.5px;color:${T.muted};padding:8px;`)}>Searching…</div>
                  ) : !found?.length ? (
                    <div style={css(`font-size:12.5px;color:${T.muted};padding:8px;`)}>
                      Nobody active matches “{personSearch.trim()}”.
                    </div>
                  ) : (
                    found.map((p) => {
                      const on = people.some((x) => x.id === p.id);
                      const full = people.length >= 50 && !on;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={full}
                          onClick={() =>
                            setPeople((list) => (on ? list.filter((x) => x.id !== p.id) : [...list, p]))
                          }
                          style={css(`width:100%;text-align:left;display:flex;align-items:center;gap:10px;border:none;border-bottom:1px solid var(--ag-border-soft);background:${on ? 'var(--ag-bad-bg)' : 'transparent'};padding:9px 8px;cursor:${full ? 'not-allowed' : 'pointer'};font-family:inherit;opacity:${full ? '.45' : '1'};`)}
                        >
                          <Icon name={on ? 'check_circle' : 'person'} size={18} color={on ? 'var(--ag-crimson)' : T.muted} />
                          <span style={css('min-width:0;flex:1;')}>
                            <span style={css('display:block;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>
                              {p.full_name || '(no name)'}
                            </span>
                            <span style={css(`display:block;font-size:11.5px;color:${T.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`)}>
                              {p.email} · {p.role}
                              {p.marketing_opt_out ? ' · unsubscribed' : ''}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {skippedPicked > 0 && (
                <div style={css('font-size:11.5px;color:#8A6D00;margin-top:10px;line-height:1.5;')}>
                  {skippedPicked} of the {people.length} chosen{' '}
                  {skippedPicked === 1 ? 'has' : 'have'} unsubscribed from marketing, so this template will skip{' '}
                  {skippedPicked === 1 ? 'them' : 'them'}. Use the <b>Service update</b> template if it is an
                  operational message they must receive.
                </div>
              )}
            </div>
          )}

          <div style={css(label)}>Subject line</div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} placeholder={meta.sample.subject} style={css(field)} />

          {emailOn && (
            <>
              <div style={css(label)}>Preview text <span style={css('text-transform:none;letter-spacing:0;font-weight:600;')}>— the grey line after the subject in the inbox</span></div>
              <input value={preheader} onChange={(e) => setPreheader(e.target.value)} maxLength={140} placeholder="Optional. Defaults to the start of your message." style={css(field)} />
            </>
          )}

          <div style={css(label)}>Heading <span style={css('text-transform:none;letter-spacing:0;font-weight:600;')}>— {emailOn ? 'the big line inside the email' : 'the notification title'}</span></div>
          <input value={heading} onChange={(e) => setHeading(e.target.value)} maxLength={90} placeholder={subject.trim() || meta.sample.heading} style={css(field)} />

          <div style={css(label)}>Message</div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1600}
            rows={8}
            placeholder={meta.sample.body}
            style={css(field + 'resize:vertical;min-height:150px;line-height:1.6;')}
          />
          <div style={css(`display:flex;justify-content:space-between;font-size:11px;color:${T.muted};margin-top:4px;`)}>
            <span>Blank line = new paragraph. Start a line with “- ” for a bullet.</span>
            <span>{body.length}/1600</span>
          </div>

          {emailOn && template === 'arrivals' && (
            <>
              <div style={css(label)}>Products <span style={css('text-transform:none;letter-spacing:0;font-weight:600;')}>— up to 6, shown with photo and price</span></div>
              {picked.length > 0 && (
                <div style={css('display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;')}>
                  {picked.map((p) => (
                    <div key={p.id} style={css(`display:flex;align-items:center;gap:8px;border:1.5px solid ${T.field};border-radius:12px;padding:6px 10px 6px 6px;background:var(--ag-surface);`)}>
                      {p.image_url && <img src={imageUrl(p.image_url, 240)} alt="" style={css('width:32px;height:32px;border-radius:8px;object-fit:cover;')} />}
                      <span style={css('font-size:12.5px;font-weight:700;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{p.title}</span>
                      <button
                        type="button"
                        onClick={() => setPicked((list) => list.filter((x) => x.id !== p.id))}
                        style={css(`border:none;background:none;cursor:pointer;color:${T.muted};display:flex;padding:0;`)}
                        title="Remove"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <GhostButton icon={pickerOpen ? 'expand_less' : 'add'} onClick={() => setPickerOpen((v) => !v)}>
                {pickerOpen ? 'Close product picker' : 'Pick products'}
              </GhostButton>

              {pickerOpen && (
                <div style={css(`margin-top:12px;border:1.5px solid ${T.field};border-radius:14px;padding:12px;`)}>
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search live products…"
                    style={css(field + 'margin-bottom:10px;')}
                  />
                  {picking ? (
                    <div style={css(`font-size:12.5px;color:${T.muted};padding:8px;`)}>Loading…</div>
                  ) : !pickable?.length ? (
                    <div style={css(`font-size:12.5px;color:${T.muted};padding:8px;`)}>No live, in-stock products match.</div>
                  ) : (
                    <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;max-height:280px;overflow-y:auto;')} className="agx-scroll">
                      {pickable.map((p) => {
                        const on = picked.some((x) => x.id === p.id);
                        const full = picked.length >= 6 && !on;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={full}
                            onClick={() => setPicked((list) => (on ? list.filter((x) => x.id !== p.id) : [...list, p]))}
                            style={css(`text-align:left;border:1.5px solid ${on ? 'var(--ag-crimson)' : T.field};border-radius:12px;padding:6px;background:var(--ag-surface);cursor:${full ? 'not-allowed' : 'pointer'};opacity:${full ? '.45' : '1'};font-family:inherit;`)}
                          >
                            {p.image_url
                              ? <img src={imageUrl(p.image_url, 240)} alt="" style={css('width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block;')} />
                              : <div style={css('width:100%;aspect-ratio:1;border-radius:8px;background:var(--ag-surface-2);')} />}
                            <div style={css('font-size:11.5px;font-weight:700;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{p.title}</div>
                            <div style={css(`font-size:11.5px;color:${T.muted};`)}>{fmtInr(p.price)}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {emailOn && (
            <>
              <div style={css(label)}>Button</div>
              <div style={css('display:grid;grid-template-columns:1fr 1.4fr;gap:10px;')}>
                <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={30} placeholder="Shop now" style={css(field)} />
                <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/collections or https://…" style={css(field)} />
              </div>
              <div style={css(`font-size:11.5px;color:${T.muted};margin-top:6px;`)}>
                Leave both blank for an email with no button. A path like <code>/new-arrivals</code> becomes a full link.
              </div>
            </>
          )}

          {/* One Send, both channels — this row is the whole point of the merge.
              The counts differ on purpose: email needs an address on file and a
              marketing template skips unsubscribes, the bell needs neither. */}
          <div style={css(label)}>Send on</div>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;')}>
            <ChannelSwitch
              icon="notifications"
              title="Notification bell"
              sub={
                bellAllowed
                  ? `${bellReach} in-app · uses the heading and first 280 characters`
                  : 'Reaches whole audiences, so it cannot run on hand-picked people'
              }
              on={bellOn}
              disabled={!bellAllowed}
              onToggle={() => setSendBell((v) => !v)}
            />
            <ChannelSwitch
              icon="mail"
              title="Email"
              sub={`${recipients} inbox${recipients === 1 ? '' : 'es'}${marketing ? ' · skips unsubscribes' : ''}`}
              on={emailOn}
              disabled={false}
              onToggle={() => setSendEmail((v) => !v)}
            />
          </div>

          <div style={css('display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap;')}>
            {/* The test is an email to yourself. There is no bell equivalent
                that would tell you anything the preview does not. */}
            {emailOn && (
              <GhostButton icon="outgoing_mail" onClick={sendTest} disabled={busy}>Send test to me</GhostButton>
            )}
            <GhostButton tone="primary" icon="send" onClick={() => setConfirm(true)} disabled={!canSend || busy}>
              Send broadcast
            </GhostButton>
          </div>
          {!canSend && (
            <div style={css(`font-size:11.5px;color:${T.muted};margin-top:8px;text-align:right;`)}>
              {!bellOn && !emailOn
                ? 'Pick at least one channel to send on.'
                : !written
                  ? 'Add a subject and a message to send.'
                  : audience === 'selected'
                    ? people.length === 0
                      ? 'Search for someone to email.'
                      : 'Everyone you picked has unsubscribed from marketing.'
                    : 'Nobody in this audience can be reached on the channels you picked.'}
            </div>
          )}
        </Card>

        <div>
          {/* A preview per channel that is actually going out. Showing an email
              mock-up for a bell-only send would be worse than showing nothing. */}
          {bellOn && (
            <>
              <Card>
                <div style={css('font-weight:800;font-size:15px;margin-bottom:14px;')}>Notification bell</div>
                <div style={css('border:1.5px solid var(--ag-border-soft);border-radius:16px;padding:14px;display:flex;gap:12px;align-items:flex-start;background:var(--ag-surface-2);')}>
                  <div style={css('width:40px;height:40px;border-radius:12px;background:var(--ag-surface);display:flex;align-items:center;justify-content:center;flex:none;')}>
                    <Icon name="campaign" size={22} color="var(--ag-crimson)" />
                  </div>
                  <div style={css('min-width:0;')}>
                    <div style={css('font-weight:800;font-size:14px;')}>
                      {(heading.trim() || subject.trim()).slice(0, 80) || 'Notification title'}
                    </div>
                    <div style={css('font-size:13px;color:var(--ag-label);margin-top:3px;line-height:1.5;')}>
                      {body.trim().slice(0, 280) || 'Your message appears here as buyers and sellers will see it in their notification bell.'}
                    </div>
                    <div style={css(`font-size:11px;color:${T.muted};margin-top:6px;`)}>just now</div>
                  </div>
                </div>
              </Card>
              <div style={css('height:14px;')} />
            </>
          )}

          {emailOn && (
            <>
              <Card>
                <div style={css('font-weight:800;font-size:15px;margin-bottom:14px;')}>Email</div>
                <EmailPreview
                  template={template}
                  subject={subject}
                  preheader={preheader}
                  heading={heading}
                  body={body}
                  ctaLabel={ctaLabel}
                  products={picked}
                  marketing={marketing}
                />
                <div style={css('margin-top:14px;display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;background:var(--ag-info-bg);')}>
                  <Icon name="info" size={19} color="var(--ag-info-text)" />
                  <span style={css('font-size:12.5px;font-weight:600;color:var(--ag-info-text);line-height:1.5;')}>
                    Approximate — the real email is built by the sending function. Use <b>Send test to me</b> to see exactly what lands.
                  </span>
                </div>
              </Card>

              <div style={css('height:14px;')} />
            </>
          )}

          <Card>
            <div style={css('font-weight:800;font-size:15px;margin-bottom:12px;')}>Recently sent</div>
            {!history?.length ? (
              <EmptyState icon="mail" title="No email broadcasts yet" sub="Sends are logged here with their delivery counts." />
            ) : (
              <div style={css('display:flex;flex-direction:column;gap:10px;')}>
                {history.map((h) => (
                  <div key={h.id} style={css('display:flex;gap:10px;align-items:flex-start;padding-bottom:10px;border-bottom:1px solid var(--ag-border-soft);')}>
                    <div style={css('min-width:0;flex:1;')}>
                      <div style={css('font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{h.subject}</div>
                      <div style={css(`font-size:11.5px;color:${T.muted};margin-top:3px;`)}>
                        {new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {h.audience} ·{' '}
                        {h.sent}/{h.recipients} delivered{h.failed > 0 ? ` · ${h.failed} failed` : ''}
                      </div>
                    </div>
                    <StatusPill status={h.status === 'sent' ? 'approved' : h.status === 'failed' ? 'rejected' : 'pending'} label={h.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={
          !emailOn
            ? `Notify ${bellReach} ${audience === 'all' ? 'people' : audience + 's'}?`
            : audience === 'selected'
              ? `Email ${recipients} ${recipients === 1 ? 'person' : 'people'}?`
              : `Email ${recipients} ${audience === 'all' ? 'people' : audience + 's'}?`
        }
        message={
          !emailOn
            ? `"${(heading.trim() || subject.trim()).slice(0, 80)}" appears in ${bellReach} notification bell${bellReach === 1 ? '' : 's'} immediately, and cannot be recalled.`
            : `"${subject.trim()}" goes to ${recipients} inbox${recipients === 1 ? '' : 'es'} now. ` +
              'Email cannot be recalled, edited or deleted once sent.' +
              (audience === 'selected'
                ? ` Recipients: ${people
                    .filter((p) => !(marketing && p.marketing_opt_out))
                    .map((p) => p.full_name || p.email)
                    .join(', ')}.`
                : bellOn
                  ? ` It also appears in ${bellReach} notification bell${bellReach === 1 ? '' : 's'}.`
                  : '')
        }
        confirmLabel="Send now"
        busy={busy}
        onConfirm={send}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

/**
 * One channel switch in the "Send on" row.
 *
 * A blocked channel still renders, with the reason where its count would be,
 * rather than vanishing. A row that silently loses a switch leaves someone
 * wondering why their broadcast only went to one place.
 */
function ChannelSwitch({
  icon, title, sub, on, disabled, onToggle,
}: {
  icon: string;
  title: string;
  sub: string;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      style={css(
        `display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;` +
          `border:1.5px solid ${on ? 'var(--ag-crimson)' : T.field};` +
          `background:${on ? 'var(--ag-bad-bg)' : 'var(--ag-surface)'};` +
          `cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? '.55' : '1'};`,
      )}
    >
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={onToggle}
        style={css('width:17px;height:17px;accent-color:var(--ag-crimson);margin-top:2px;cursor:inherit;flex:none;')}
      />
      <span style={css('min-width:0;')}>
        <span style={css('display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;')}>
          <Icon name={icon} size={16} color={on ? 'var(--ag-crimson)' : T.muted} />
          {title}
        </span>
        <span style={css(`display:block;font-size:11.5px;color:${T.muted};font-weight:500;margin-top:3px;line-height:1.45;`)}>{sub}</span>
      </span>
    </label>
  );
}

/**
 * A structural preview of the message.
 *
 * Deliberately NOT a copy of the email HTML: that lives in the Edge Function, in
 * table markup written for Outlook, and a second copy here would drift the first
 * time either is touched. This shows the same content in the same order with the
 * same brand colours, which is what the composer is actually checking — wording,
 * length, and whether the button says something useful. The test send is the
 * fidelity check, and the panel says so.
 */
function EmailPreview({
  template, subject, preheader, heading, body, ctaLabel, products, marketing,
}: {
  template: EmailTemplate;
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  ctaLabel: string;
  products: PickableProduct[];
  marketing: boolean;
}) {
  // Same grammar the sender applies: blank line = paragraph, "- " = bullet.
  const blocks = useMemo(() => {
    return (body || '')
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map((block) => block.split('\n').filter((l) => l.trim()))
      .filter((lines) => lines.length > 0)
      .map((lines) => ({
        isList: lines.every((l) => /^\s*[-•]\s+/.test(l)),
        lines: lines.map((l) => l.replace(/^\s*[-•]\s+/, '')),
      }));
  }, [body]);

  const centred = template === 'festival';

  return (
    <div style={css('border:1.5px solid var(--ag-border-soft);border-radius:16px;overflow:hidden;background:var(--ag-surface-2);')}>
      {/* Inbox row — subject + preview text, the two things that decide whether
          any of the rest is ever seen. */}
      <div style={css('padding:12px 14px;border-bottom:1px solid var(--ag-border-soft);background:var(--ag-surface);')}>
        <div style={css('font-size:12px;font-weight:800;color:var(--ag-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>
          {subject.trim() || 'Your subject line'}
        </div>
        <div style={css(`font-size:11.5px;color:${T.muted};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`)}>
          {preheader.trim() || body.trim().slice(0, 90) || 'Preview text appears here'}
        </div>
      </div>

      <div style={css('padding:0;')}>
        {/* Cream masthead with the centred wordmark — the same treatment the
            sender applies. The asset is served from /public, so this is the real
            logo rather than a stand-in for it. */}
        <div style={css('background:#FFF8F4;padding:16px;text-align:center;border-bottom:1px solid var(--ag-border-soft);')}>
          <img src="/mangaimart-wordmark.png" alt="MangaiMart" style={css('display:block;margin:0 auto;width:170px;max-width:72%;height:auto;')} />
        </div>

        <div style={css(`background:var(--ag-surface);padding:16px;${centred ? 'text-align:center;' : ''}`)}>
          {template === 'service' && (
            <div style={css('text-align:center;')}>
              <span style={css('display:inline-block;padding:4px 9px;border-radius:999px;background:var(--ag-gold-bg);color:#8A6D00;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;')}>
                Service update
              </span>
            </div>
          )}
          {/* Heading centred, body left — matches shell() in the Edge Function. */}
          <div style={css("font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:18px;line-height:1.3;color:var(--ag-ink);text-align:center;")}>
            {heading.trim() || subject.trim() || 'Your heading'}
          </div>

          <div style={css(`margin-top:10px;${centred ? '' : 'text-align:left;'}`)}>
            {blocks.length === 0 && (
              <p style={css(`font-size:13px;line-height:1.7;color:${T.muted};margin:0;`)}>Your message appears here.</p>
            )}
            {blocks.map((block, i) =>
              block.isList ? (
                <ul key={i} style={css('margin:0 0 10px;padding-left:18px;text-align:left;')}>
                  {block.lines.map((line, j) => (
                    <li key={j} style={css('font-size:13px;line-height:1.7;color:var(--ag-label);margin-bottom:5px;')}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p key={i} style={css('font-size:13px;line-height:1.7;color:var(--ag-label);margin:0 0 10px;')}>{block.lines.join(' ')}</p>
              ),
            )}
          </div>

          {template === 'arrivals' && products.length > 0 && (
            <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;')}>
              {products.map((p) => (
                <div key={p.id} style={css('text-align:left;')}>
                  {p.image_url
                    ? <img src={imageUrl(p.image_url, 240)} alt="" style={css('width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block;')} />
                    : <div style={css('width:100%;aspect-ratio:1;border-radius:10px;background:var(--ag-surface-2);')} />}
                  <div style={css('font-size:11.5px;font-weight:600;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{p.title}</div>
                  <div style={css('font-size:12px;font-weight:800;color:var(--ag-crimson);')}>{fmtInr(p.price)}</div>
                </div>
              ))}
            </div>
          )}

          {ctaLabel.trim() && (
            <div style={css('margin-top:14px;text-align:center;')}>
              <span style={css('display:inline-block;background:var(--ag-crimson);color:#fff;font-size:12.5px;font-weight:700;padding:10px 20px;border-radius:9px;')}>
                {ctaLabel.trim()}
              </span>
            </div>
          )}

          <div style={css(`margin-top:16px;padding-top:12px;border-top:1px solid var(--ag-border-soft);font-size:10.5px;color:${T.muted};line-height:1.6;text-align:center;`)}>
            MangaiMart — ethnic wear from verified independent boutiques.<br />
            {marketing
              ? <>You are receiving this because you have a MangaiMart account. <u>Unsubscribe from marketing email</u>.</>
              : 'This is a service message about your MangaiMart account, not marketing.'}
          </div>
        </div>
      </div>
    </div>
  );
}
