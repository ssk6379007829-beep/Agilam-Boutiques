import { namesAgree } from '@/lib/nameMatch';
import { isMapsLink } from '@/lib/geolocate';
import { GST_RE } from '@/lib/gst';
import type { IfscResult } from '@/lib/ifsc';
import type { PincodeArea } from '@/lib/pincode';

/**
 * What the admin verification queue is allowed to conclude from an application,
 * on its own, before anyone picks up a phone.
 *
 * The queue used to render the application as thirty rows of grey text, which
 * gave an admin no way to tell a real boutique from an invented one except by
 * reading carefully and remembering every shop they had seen before. Nobody does
 * that on the fiftieth application of the week. So the comparisons a human would
 * make if they were being thorough are made here instead, once, and shown as
 * tags — and the ones a human CANNOT make (has this bank account been used
 * before?) are asked of the database.
 *
 * Pure on purpose: every rule in this file is a function of its arguments, so
 * the wording and the severity can be read together and changed together,
 * without opening a 500-line component to find out what "Check address" means.
 *
 * ── The severity ladder ─────────────────────────────────────────────────────
 * Borrowed wholesale from `src/lib/pinCheck.ts`, because the lesson there
 * applies twice over here: a false accusation is worse than no check at all. An
 * admin who is shown three red tags on every honest application stops reading
 * red tags, and then the one that mattered goes past unread.
 *
 *   bad   an unambiguous contradiction. The seller has to explain it before
 *         approval — a pincode in a different state to the address, the same
 *         bank account as another shop.
 *   warn  a real question with an innocent answer available. Ask it on the call;
 *         do not assume. An account in a different name is usually a spouse.
 *   info  context, not suspicion. Most small boutiques have no GST and no
 *         Instagram, and saying so in grey is honest; saying so in red is not.
 *   good  a check that ran and passed. These exist so the admin can see the
 *         comparison happened — a screen with nothing on it looks identical
 *         whether it checked everything or nothing.
 */

export type ReviewTone = 'bad' | 'warn' | 'info' | 'good';

export type ReviewFlag = {
  /** Stable key — used for React lists and nothing else. */
  id: string;
  tone: ReviewTone;
  /** The chip text. Short enough to sit in a table row. */
  label: string;
  /** The sentence under it in the drawer: what it means, or what to ask. */
  detail?: string;
};

/** The subset of a boutique row these rules read. Structural so both the admin
 *  row type and a plain fetch satisfy it without a cast. */
export type ReviewSubject = {
  id: string;
  name: string;
  owner_name?: string | null;
  city?: string | null;
  area?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  address_line?: string | null;
  map_url?: string | null;
  instagram?: string | null;
  description?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
};

/** The withheld fields, as `boutique_private()` returns them. */
export type ReviewPrivate = {
  gst_number?: string | null;
  business_reg_number?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  upi_id?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  payout_verification_status?: string | null;
};

const trimmed = (v: string | null | undefined) => (v ?? '').trim();

/* ── Money and identity ─────────────────────────────────────────────────────
 *
 * The account holder's name is the single most valuable field on the whole
 * application, because it is the only one that says where the money ends up. A
 * fake shop can invent an address, a bio and a shopfront photo; it still has to
 * name a real account it controls.
 *
 * It is graded `warn` rather than `bad` for one reason: in Indian family
 * businesses the shop is run by one person and banked by another — a husband, a
 * mother, a firm. That is entirely legitimate and extremely common, and calling
 * it fraud in red would be wrong most of the times it fires. What it deserves is
 * a question on the call, which is what the detail line says.
 */
export function identityFlags(b: ReviewSubject, priv: ReviewPrivate | null): ReviewFlag[] {
  const out: ReviewFlag[] = [];
  const owner = trimmed(b.owner_name);
  const holder = trimmed(priv?.bank_account_name);

  if (priv && holder && owner) {
    if (namesAgree(owner, holder)) {
      out.push({
        id: 'bank-name-match',
        tone: 'good',
        label: 'Account in the owner’s name',
        detail: `“${holder}” matches the owner name on the application.`,
      });
    } else {
      out.push({
        id: 'bank-name-mismatch',
        tone: 'warn',
        label: 'Account in a different name',
        detail: `The payout account is “${holder}” but the owner is “${owner}”. Usually a spouse or the firm’s account — ask whose it is on the call, and expect them to answer without hesitating.`,
      });
    }
  } else if (priv && !holder) {
    out.push({
      id: 'bank-name-missing',
      tone: 'bad',
      label: 'No account holder name',
      detail: 'Payouts are made by hand from these three fields. Without a name there is nothing to check the transfer against.',
    });
  }

  const gst = trimmed(priv?.gst_number).toUpperCase();
  if (priv && gst && !GST_RE.test(gst)) {
    out.push({
      id: 'gst-malformed',
      tone: 'bad',
      label: 'GSTIN is not valid',
      detail: `“${gst}” is not a well-formed 15-character GSTIN. The setup form rejects these, so this was either edited afterwards or typed somewhere it was not checked.`,
    });
  } else if (priv && !gst) {
    out.push({
      id: 'gst-absent',
      tone: 'info',
      label: 'No GST',
      detail: 'Normal — most boutiques are under the registration threshold. Not a reason to refuse, but it means there is no registry entry to check them against.',
    });
  }

  if (priv?.payout_verification_status === 'failed') {
    out.push({
      id: 'payout-failed',
      tone: 'bad',
      label: 'Payout account check failed',
      detail: 'A previous verification of these bank details came back failed. Do not settle any money until it is corrected.',
    });
  }

  return out;
}

/**
 * Does the IFSC point anywhere near the shop?
 *
 * Deliberately `info`, never a blocker. People bank where they used to live, or
 * where they opened their first account twenty years ago, and a Coimbatore shop
 * with a Chennai branch account is an ordinary Tuesday. What makes it worth
 * showing at all is the pattern it exposes when it is stacked with the other
 * tags: an application whose address, branch and phone all point at three
 * different states is telling you something the individual fields are not.
 */
export function bankBranchFlags(b: ReviewSubject, ifsc: IfscResult | null): ReviewFlag[] {
  if (!ifsc) return [];
  if (ifsc.state === 'invalid') {
    return [{
      id: 'ifsc-unknown',
      tone: 'bad',
      label: 'No such bank branch',
      detail: 'The IFSC does not resolve to a real branch. A manual transfer to it will bounce.',
    }];
  }
  if (ifsc.state !== 'valid') return [];

  const where = [ifsc.branch, ifsc.city].filter(Boolean).join(', ');
  const near = namesAgree(b.city, ifsc.city) || namesAgree(b.district, ifsc.city);
  return [{
    id: near ? 'ifsc-local' : 'ifsc-far',
    tone: near ? 'good' : 'info',
    label: near ? 'Bank branch is local' : 'Bank branch is elsewhere',
    detail: near
      ? `${ifsc.bank} · ${where} — the same town as the shop.`
      : `${ifsc.bank} · ${where}, while the shop is in ${trimmed(b.city) || 'an unstated town'}. Common and usually innocent; worth a question only if the address looks doubtful too.`,
  }];
}

/* ── Location ───────────────────────────────────────────────────────────────
 *
 * The pincode is checked against the same directory that prices every delivery
 * on the platform (`src/data/pincodes.ts`), so this is not a second opinion that
 * can disagree with the shop's own delivery zones — it is the same answer.
 *
 * A state mismatch is unambiguous and red. A district mismatch is amber: pincode
 * boundaries genuinely straddle district lines and the directory's spelling of a
 * Tamil district is not always the seller's, which is exactly what `namesAgree`
 * exists to absorb.
 */
export function locationFlags(b: ReviewSubject, area: PincodeArea | null | undefined): ReviewFlag[] {
  const out: ReviewFlag[] = [];
  const map = trimmed(b.map_url);

  if (!map) {
    out.push({
      id: 'map-missing',
      tone: 'bad',
      label: 'No map pin',
      detail: 'The setup form requires one, so this row predates that rule or was edited since. There is no way to confirm the shop exists at the address without it.',
    });
  } else if (!isMapsLink(map)) {
    out.push({
      id: 'map-not-maps',
      tone: 'bad',
      label: 'Map link is not Google Maps',
      detail: `“${map}” is not a Maps link. Do not open it expecting a location.`,
    });
  }

  if (area === undefined) return out; // not looked up yet
  if (area === null) {
    out.push({
      id: 'pincode-unknown',
      tone: 'info',
      label: 'Pincode not in the directory',
      detail: 'India Post did not recognise it. Confirm the pincode on the call — deliveries to this shop will price at the national rate until it resolves.',
    });
    return out;
  }

  const stateOk = namesAgree(b.state, area.state);
  const districtOk = namesAgree(b.district, area.district);

  if (!stateOk) {
    out.push({
      id: 'pincode-state-mismatch',
      tone: 'bad',
      label: 'Pincode is in another state',
      detail: `${trimmed(b.pincode)} is in ${area.district}, ${area.state} — the application says ${trimmed(b.district) || '—'}, ${trimmed(b.state) || '—'}. One of the two is wrong.`,
    });
  } else if (!districtOk) {
    out.push({
      id: 'pincode-district-mismatch',
      tone: 'warn',
      label: 'Pincode is in another district',
      detail: `${trimmed(b.pincode)} belongs to ${area.district}, but the application says ${trimmed(b.district) || '—'}. Pincodes do straddle district lines — confirm the town rather than assuming an error.`,
    });
  } else {
    out.push({
      id: 'pincode-match',
      tone: 'good',
      label: 'Pincode matches the address',
      detail: `${trimmed(b.pincode)} → ${area.district}, ${area.state}.`,
    });
  }

  // The town is the detail a form-filler gets wrong and a shopkeeper never does.
  const town = trimmed(b.city);
  if (stateOk && districtOk && town && area.places?.length) {
    const covered = area.places.some((p) => namesAgree(town, p)) || namesAgree(town, area.district);
    if (!covered) {
      out.push({
        id: 'city-not-in-pincode',
        tone: 'warn',
        label: 'Town is not under this pincode',
        detail: `${area.pincode} covers ${area.places.slice(0, 4).join(', ')}${area.places.length > 4 ? '…' : ''} — not ${town}. Ask which of those their shop is nearest to.`,
      });
    }
  }

  return out;
}

/* ── Repeat applicants ──────────────────────────────────────────────────────
 *
 * Split in two by what the browser is allowed to know. The shop name, address,
 * pincode and map pin are on the public column grant, so every boutique is
 * already loaded in the admin console and matching them costs nothing and works
 * whether or not migration 0106 has been applied.
 *
 * Phone, email, bank account and UPI are not, and must not be — they came off
 * the grant in 0073 precisely so they could not be pulled in bulk. Those come
 * back from `boutique_duplicate_signals()` already reduced to an answer.
 */

export type PublicDuplicateCandidate = {
  id: string;
  name: string;
  status: string;
  city?: string | null;
  pincode?: string | null;
  address_line?: string | null;
  map_url?: string | null;
};

/** How the database reports a collision on a withheld field. */
export type DuplicateSignal = {
  other_id: string;
  other_name: string;
  other_status: string;
  other_city: string | null;
  other_submitted_at: string | null;
  matched_fields: string[];
};

const addressKey = (v: string | null | undefined) =>
  (v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

const FIELD_LABEL: Record<string, string> = {
  phone: 'phone number',
  email: 'email',
  bank_account: 'bank account',
  upi: 'UPI ID',
};

/**
 * Collisions visible from the rows the console already holds.
 *
 * Same pincode is included but graded `info` and only above two other shops: in
 * a marketplace organised around towns, a shared pincode is the normal case and
 * flagging every one of them in amber would bury the address match sitting right
 * next to it.
 */
export function publicDuplicates(b: ReviewSubject, all: readonly PublicDuplicateCandidate[]): ReviewFlag[] {
  const others = all.filter((o) => o.id !== b.id);
  const out: ReviewFlag[] = [];
  const name = (o: PublicDuplicateCandidate) => `${o.name}${o.status === 'rejected' ? ' (rejected)' : o.status === 'approved' ? '' : ` (${o.status.replace('_', ' ')})`}`;

  const addr = addressKey(b.address_line);
  if (addr.length >= 8) {
    const same = others.filter((o) => addressKey(o.address_line) === addr);
    if (same.length) {
      out.push({
        id: 'dup-address',
        tone: 'bad',
        label: same.length === 1 ? `Same address as ${same[0].name}` : `Same address as ${same.length} shops`,
        detail: `Character-for-character the same shop address as ${same.map(name).join(', ')}. Either one seller is applying twice, or one of them copied the other.`,
      });
    }
  }

  const map = trimmed(b.map_url);
  if (map) {
    const same = others.filter((o) => trimmed(o.map_url) === map);
    if (same.length) {
      out.push({
        id: 'dup-map',
        tone: 'bad',
        label: same.length === 1 ? `Same map pin as ${same[0].name}` : `Same map pin as ${same.length} shops`,
        detail: `The identical map link is on ${same.map(name).join(', ')}. Two boutiques cannot occupy one point.`,
      });
    }
  }

  const shopName = addressKey(b.name);
  if (shopName.length >= 4) {
    const same = others.filter((o) => addressKey(o.name) === shopName);
    if (same.length) {
      out.push({
        id: 'dup-name',
        tone: 'warn',
        label: `Shop name already used`,
        detail: `${same.map(name).join(', ')} ${same.length === 1 ? 'has' : 'have'} the same name. Could be a second branch — ask — or an impersonation of a shop already on the platform.`,
      });
    }
  }

  const pin = trimmed(b.pincode);
  if (pin) {
    const same = others.filter((o) => trimmed(o.pincode) === pin);
    if (same.length > 2) {
      out.push({
        id: 'dup-pincode',
        tone: 'info',
        label: `${same.length} other shops in ${pin}`,
        detail: 'Ordinary in a town where the marketplace is already established. Listed only so a cluster of applications from one pincode in one week is visible.',
      });
    }
  }

  return out;
}

/**
 * Collisions on the withheld fields, as reported by the database.
 *
 * All red without exception, and unlike everything else in this file that is not
 * a judgement call. Two boutiques do not share a bank account by coincidence.
 */
export function privateDuplicates(signals: readonly DuplicateSignal[]): ReviewFlag[] {
  return signals.map((s) => {
    const fields = s.matched_fields.map((f) => FIELD_LABEL[f] ?? f);
    const where = [s.other_city, s.other_status === 'rejected' ? 'rejected' : null].filter(Boolean).join(' · ');
    return {
      id: `dup-priv-${s.other_id}`,
      tone: 'bad' as const,
      label: `Same ${fields.join(' & ')} as ${s.other_name}`,
      detail: `${s.other_name}${where ? ` (${where})` : ''} was submitted with the same ${fields.join(' and ')}. ${
        s.matched_fields.includes('bank_account') || s.matched_fields.includes('upi')
          ? 'A shared payout destination is the strongest fraud signal on this screen — do not approve without an explanation you have verified.'
          : 'Ask directly whether they already run a shop here.'
      }`,
    };
  });
}

/* ── How the application was made ───────────────────────────────────────────
 *
 * Soft signals, all of them, and none is evidence of anything on its own — a
 * genuine seller can be fast, private and slow to upload. They earn their place
 * as a group: an account that signed up, filled seven steps and submitted inside
 * four minutes, with no products, no Instagram and a one-line bio, was not
 * opened by someone who has a shop to run.
 */
export function behaviourFlags(b: ReviewSubject, productCount: number | null): ReviewFlag[] {
  const out: ReviewFlag[] = [];

  if (b.created_at && b.submitted_at) {
    const mins = (new Date(b.submitted_at).getTime() - new Date(b.created_at).getTime()) / 60000;
    if (mins >= 0 && mins < 10) {
      out.push({
        id: 'fast-submit',
        tone: 'warn',
        label: `Submitted ${Math.max(1, Math.round(mins))} min after signup`,
        detail: 'Seven steps including bank details, filled and sent in under ten minutes. Possible with everything to hand — but it is also what pasting prepared data looks like.',
      });
    }
  }

  if (productCount === 0) {
    out.push({
      id: 'no-products',
      tone: 'info',
      label: 'No products uploaded',
      detail: 'Sellers can list while they wait, and most genuine ones do. Nothing here means nothing to inspect for stolen catalogue photos.',
    });
  } else if (productCount && productCount > 0) {
    out.push({
      id: 'has-products',
      tone: 'good',
      label: `${productCount} product${productCount === 1 ? '' : 's'} ready`,
      detail: 'Open Products in the admin console and look at the photos before approving — approval publishes all of them at once.',
    });
  }

  if (!trimmed(b.instagram)) {
    out.push({
      id: 'no-instagram',
      tone: 'info',
      label: 'No Instagram',
      detail: 'Optional, but a boutique with a real local following is hard to fake and takes ten seconds to check.',
    });
  }

  if (trimmed(b.description).length < 20) {
    out.push({
      id: 'thin-bio',
      tone: 'info',
      label: 'Bio barely filled in',
      detail: 'Someone describing a shop they actually own usually has more than a line to say about it.',
    });
  }

  return out;
}

/** Ranking for display: the things that stop an approval come first. */
const TONE_ORDER: Record<ReviewTone, number> = { bad: 0, warn: 1, info: 2, good: 3 };

export function sortFlags(flags: readonly ReviewFlag[]): ReviewFlag[] {
  return [...flags].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

/** The one-line verdict above the decision buttons. */
export function reviewVerdict(flags: readonly ReviewFlag[]): { tone: ReviewTone; text: string } {
  const bad = flags.filter((f) => f.tone === 'bad').length;
  const warn = flags.filter((f) => f.tone === 'warn').length;
  if (bad) {
    return {
      tone: 'bad',
      text: `${bad} contradiction${bad === 1 ? '' : 's'} in this application. Resolve ${bad === 1 ? 'it' : 'them'} on the call before approving.`,
    };
  }
  if (warn) {
    return {
      tone: 'warn',
      text: `${warn} thing${warn === 1 ? '' : 's'} to ask about. Each has an innocent answer — get it from the seller, not from assumption.`,
    };
  }
  return {
    tone: 'good',
    text: 'Nothing contradicts itself. The application still proves only that a form was filled in — the call is what verifies the shop.',
  };
}

/* ── Reaching the seller ────────────────────────────────────────────────────
 *
 * The call is the verification; everything above is triage for it. So the drawer
 * hands the admin a message that is already written, because the friction that
 * actually stops a check from happening is not the dialling — it is composing
 * the same paragraph for the fiftieth time.
 */
export function verificationMessage(b: ReviewSubject): string {
  const where = [trimmed(b.address_line), trimmed(b.area), trimmed(b.city), trimmed(b.pincode)]
    .filter(Boolean)
    .join(', ');
  return [
    `Hello! This is the MangaiMart team.`,
    ``,
    `We have received your boutique application for ${b.name}. We verify every shop personally before approving it — it keeps the marketplace trustworthy for buyers and for genuine sellers like you.`,
    ``,
    `Two quick things:`,
    `1. Please confirm your shop address — we have it as: ${where || '(no address on the application)'}`,
    `2. Please send a short video or a photo of your shop front with the name board visible.`,
    ``,
    `Once we have seen it we will approve your boutique straight away and you can start selling. Thank you!`,
  ].join('\n');
}

/** `wa.me` wants a bare international number; sellers store a local one. */
export function instagramUrl(handle: string): string {
  const h = handle.trim().replace(/^@/, '');
  return /^https?:\/\//i.test(h) ? h : `https://instagram.com/${h}`;
}
