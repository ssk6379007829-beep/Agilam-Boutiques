import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { css } from '@/lib/css';
import { Icon } from '@/components/ui/Icon';
import { AMOUNT, BODY, CONTROL, DISPLAY, FACE, HEADING_SM, LABEL, LINK, SUBHEAD } from './type';

/**
 * The kit the five /sell pages are set in — "Paper and Crimson", generated from
 * `docs/architecture/SELL_DESIGN_SYSTEM.md`. That file is the source of truth;
 * if the two disagree, this one is what gets corrected.
 *
 * ── What this replaced ─────────────────────────────────────────────────────
 * A "Heritage Modern" kit: berry on rose-cream, a Caslon display face, soft
 * berry-tinted card shadows, arched photography, gold ornament. It was a good
 * execution of a shop window, and /sell is not a shop window — it sells a
 * business arrangement to someone deciding whether to trust us with her
 * livelihood. So this is a counter and a ledger: paper, ink, ruled columns, and
 * the only coloured thing on any page is the number she came to check.
 *
 * ── The two rules that hold it together ────────────────────────────────────
 *
 * 1. CRIMSON IS MONEY. It never touches a heading, a button, a border, a link
 *    or an icon. It appears on amounts, and on the rule amounts sit behind.
 *    This is why `AMOUNT` and `AMOUNT_XL` carry their own colour rather than
 *    leaving it to the call site — a heading that reached for `AMOUNT` because
 *    it wanted the width would take the crimson with it, and the palette's one
 *    rule would erode in a month.
 *
 * 2. RULES, NOT SHADOWS. There is no elevation anywhere on this site. Five
 *    rules with five distinct meanings do all the separating; see the table in
 *    the design system. A sixth rule that means nothing is decoration, and
 *    decoration does not belong in a system whose whole argument is precision.
 *
 * Colours are `--ag-*` as CLAUDE.md rule 4 requires. Their VALUES are redefined
 * on `.agx-sell-light` in index.css, which is what lets /sell look nothing like
 * the storefront without touching it, the seller console or the admin console.
 */

/* ── Structure ─────────────────────────────────────────────────────────────── */

/**
 * A full-bleed horizontal band. `tone` decides the ground:
 *   page  — the paper itself, no fill (the default)
 *   panel — a quiet inset, for a section that should read as an aside
 */
export function Band({
  tone = 'page',
  children,
  style,
  id,
}: {
  tone?: 'page' | 'panel';
  children: ReactNode;
  style?: CSSProperties;
  id?: string;
}) {
  const fill = tone === 'panel' ? 'background:var(--ag-surface-2);' : '';
  return (
    <section
      id={id}
      // Full-bleed out of the centred column, the same way SiteFooter does it.
      style={{ ...css(`width:100vw;margin-left:calc(50% - 50vw);${fill}`), ...style }}
    >
      {children}
    </section>
  );
}

/**
 * The ink panel — the hero's ground and the closing call to action.
 *
 * Ink, not crimson. On the old site this block was berry, which is exactly the
 * habit the new palette exists to break: crimson on a panel this large would be
 * the loudest thing on the page and it would not be a number. Ink gives the same
 * weight with none of the meaning.
 *
 * Flat, and squared off at 4px. No gradient — a gradient across a panel this
 * large bands visibly on a cheap phone screen, and gradients are forbidden by
 * the interaction thesis anyway.
 */
export function DeepPanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        ...css(
          'position:relative;background:var(--ag-ink);color:var(--ag-bg);' +
            'border-radius:var(--sell-r-panel);' +
            'padding:clamp(28px,5vw,64px) clamp(20px,5vw,64px);',
        ),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The reading column.
 *
 * 1180px wide, 940px for prose — 1180 of running text is unreadable. The
 * vertical rhythm is `--sell-section`: 96px on desktop, 56px on a phone. The old
 * kit ran 120px, which is a gallery; a ledger is ruled at a tighter, more
 * consistent pitch.
 */
export function Wrap({
  children,
  wide,
  style,
}: {
  children: ReactNode;
  wide?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        ...css(
          `max-width:${wide ? 1180 : 940}px;margin:0 auto;` +
            'padding:var(--sell-section) clamp(20px,3vw,24px);',
        ),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Type ──────────────────────────────────────────────────────────────────── */

/** A column head or an eyebrow. The condensed end of the width axis. */
export function Eyebrow({ children, onDeep }: { children: ReactNode; onDeep?: boolean }) {
  return (
    <div style={css(`${LABEL}color:${onDeep ? 'var(--ag-muted-soft)' : 'var(--ag-muted)'};`)}>
      {children}
    </div>
  );
}

/**
 * A heading. `level` sets the tag so the document outline is real — one `h1` per
 * page, the rest `h2`/`h3`.
 *
 * The three sizes are three roles from the type system, not three font-sizes:
 * `lg` is DISPLAY (the page's own headline), `md` is SUBHEAD (a section opens),
 * `sm` is HEADING_SM (a thing inside a block is named).
 */
export function Display({
  children,
  level = 2,
  size = 'md',
  onDeep,
  style,
}: {
  children: ReactNode;
  level?: 1 | 2 | 3;
  size?: 'sm' | 'md' | 'lg';
  onDeep?: boolean;
  style?: CSSProperties;
}) {
  const Tag = (`h${level}` as unknown) as 'h2';
  const role = size === 'lg' ? DISPLAY : size === 'md' ? SUBHEAD : HEADING_SM;
  return (
    <Tag
      style={{
        ...css(
          `font-family:${FACE};${role}` +
            `color:${onDeep ? 'var(--ag-bg)' : 'var(--ag-ink)'};margin:16px 0 0;text-wrap:balance;`,
        ),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/** The paragraph under a heading. Held to a comfortable measure. */
export function Lede({
  children,
  onDeep,
  style,
}: {
  children: ReactNode;
  onDeep?: boolean;
  style?: CSSProperties;
}) {
  return (
    <p
      style={{
        ...css(
          `margin:20px 0 0;max-width:62ch;${BODY}font-size:17px;` +
            `color:${onDeep ? 'rgba(245,242,235,.88)' : 'var(--ag-ink-2)'};`,
        ),
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/** Body copy inside a section. The only role at normal width and regular weight. */
export function Text({
  children,
  onDeep,
  style,
}: {
  children: ReactNode;
  onDeep?: boolean;
  style?: CSSProperties;
}) {
  return (
    <p
      style={{
        ...css(
          `margin:14px 0 0;max-width:66ch;${BODY}` +
            `color:${onDeep ? 'rgba(245,242,235,.88)' : 'var(--ag-ink-2)'};`,
        ),
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/** A hairline. One of the five rules — this is the plain one. */
export function Rule({ onDeep, style }: { onDeep?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        ...css(
          `height:1px;background:${onDeep ? 'rgba(245,242,235,.22)' : 'var(--ag-border)'};margin:32px 0;`,
        ),
        ...style,
      }}
    />
  );
}

/**
 * A link that closes a section — "…and here is the next page".
 *
 * Ink, not crimson. The affordance is the rule under it, which thickens on
 * hover; the colour never moves. See `.agx-sell-link` in index.css.
 */
export function ArrowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="agx-sell-link" style={css(`${LINK}color:var(--ag-ink);`)}>
      {children}
      <Icon name="arrow_forward" style={css('font-size:19px;')} />
    </Link>
  );
}

/* ── Calls to action ───────────────────────────────────────────────────────── */

/*
 * Five states, and the hover is colour only — nothing scales and nothing lifts.
 * 44px minimum height for the touch target, which the 13px padding reaches
 * without inflating the shape past what a 2px radius wants.
 *
 * The states live in `.agx-sell-btn` in index.css rather than here, because an
 * inline style cannot express `:hover`, `:focus-visible` or `:disabled`.
 */
export function PrimaryCta({
  to,
  children,
  onDeep,
}: {
  to: string;
  children: ReactNode;
  onDeep?: boolean;
}) {
  return (
    <Link to={to} className={`agx-sell-btn${onDeep ? ' on-ink' : ''}`} style={css(CONTROL)}>
      {children}
      <Icon name="arrow_forward" style={css('font-size:18px;')} />
    </Link>
  );
}

export function GhostCta({
  to,
  children,
  onDeep,
}: {
  to: string;
  children: ReactNode;
  onDeep?: boolean;
}) {
  return (
    <Link to={to} className={`agx-sell-btn ghost${onDeep ? ' on-ink' : ''}`} style={css(CONTROL)}>
      {children}
    </Link>
  );
}

/** The two buttons that close most sections. 8px apart minimum — see mobile spacing. */
export function CtaPair({
  to,
  label,
  secondaryTo,
  secondaryLabel,
  onDeep,
}: {
  to: string;
  label: string;
  secondaryTo?: string;
  secondaryLabel?: string;
  onDeep?: boolean;
}) {
  return (
    <div style={css('display:flex;flex-wrap:wrap;gap:12px;margin-top:32px;')}>
      <PrimaryCta to={to} onDeep={onDeep}>
        {label}
      </PrimaryCta>
      {secondaryTo && secondaryLabel && (
        <GhostCta to={secondaryTo} onDeep={onDeep}>
          {secondaryLabel}
        </GhostCta>
      )}
    </div>
  );
}

/**
 * A white block on the paper ground.
 *
 * A 1px rule does the separating and there is no shadow at all — that is the
 * single largest departure from the kit this replaced, which leaned on a soft
 * berry-tinted elevation everywhere. On paper, elevation is a lie: nothing on a
 * counter floats.
 */
export function Card({
  children,
  style,
  pad = 28,
}: {
  children: ReactNode;
  style?: CSSProperties;
  pad?: number;
}) {
  return (
    <div
      style={{
        ...css(
          'background:var(--ag-surface);border:1px solid var(--ag-border);' +
            `border-radius:var(--sell-r-panel);padding:clamp(20px,3vw,${pad}px);`,
        ),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── The ledger block — the signature ──────────────────────────────────────── */

/**
 * The one structural device the site repeats.
 *
 * Figures never sit inline with prose: they live in a column of their own, ruled
 * off in crimson, running the height of any block that carries money. It encodes
 * something true — that the amounts are the part you check — rather than
 * decorating a section break, which is the test every structural device on this
 * site has to pass.
 *
 * `head` is the pair of column heads. Pass it whenever the block has more than
 * two rows; a two-row block reads fine without one.
 */
export function Ledger({
  head,
  children,
  style,
}: {
  head?: [ReactNode, ReactNode];
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="agx-sell-ledger" style={style}>
      {head && (
        <div className="agx-sell-ledger-head">
          <span style={css(`${LABEL}color:var(--ag-muted);`)}>{head[0]}</span>
          <span style={css(`${LABEL}color:var(--ag-muted);`)}>{head[1]}</span>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * One line of a ledger: what it is on the left, what it costs on the right.
 *
 * `strong` is the total — it takes the ink rule above it and the largest amount
 * the site sets. There is at most one per block, because a ledger with two
 * totals is not a ledger.
 */
export function LedgerRow({
  label,
  value,
  strong,
  negative,
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  negative?: boolean;
  note?: string;
}) {
  return (
    <div className={`agx-sell-ledger-row${strong ? ' total' : ''}`}>
      <div>
        <div
          style={css(
            `font-family:${FACE};${HEADING_SM}` +
              `color:${negative ? 'var(--ag-muted)' : 'var(--ag-ink)'};`,
          )}
        >
          {label}
        </div>
        {note && (
          <div style={css(`margin-top:3px;${BODY}font-size:12.5px;color:var(--ag-muted);max-width:46ch;`)}>
            {note}
          </div>
        )}
      </div>
      <div
        style={css(
          `font-family:${FACE};${AMOUNT}` +
            (strong ? 'font-size:clamp(26px,6vw,32px);color:var(--ag-deep);' : '') +
            (negative ? 'color:var(--ag-muted);' : ''),
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Small pieces ──────────────────────────────────────────────────────────── */

/**
 * An icon-led point: thin-line glyph, a short heading, a sentence under it.
 *
 * The glyph sits loose on the page rather than inside a tinted circle — the
 * circle is on the forbidden list, because it is the single most reliable tell
 * that a section was assembled from a template rather than designed.
 */
export function IconPoint({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={css('display:flex;gap:20px;align-items:flex-start;')}>
      <Icon
        name={icon}
        style={css(
          "font-size:22px;margin-top:2px;color:var(--ag-ink);flex:none;font-variation-settings:'wght' 200;",
        )}
      />
      <div>
        <h3 style={css(`font-family:${FACE};${HEADING_SM}color:var(--ag-ink);margin:0 0 6px;`)}>
          {title}
        </h3>
        <p style={css(`margin:0;${BODY}color:var(--ag-ink-2);max-width:56ch;`)}>{children}</p>
      </div>
    </div>
  );
}

/**
 * One row of a "here is what happens" list. Numbered, and the numbering is
 * earned: these are genuinely sequential — register, then list, then the order
 * arrives, then you are paid. Order carries information the reader needs.
 */
export function Step({
  n,
  title,
  children,
  aside,
}: {
  n: number;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <li
      style={css(
        'display:grid;grid-template-columns:auto 1fr;gap:20px;padding:28px 0;' +
          'border-top:1px solid var(--ag-border);',
      )}
    >
      <div
        style={css(
          `font-family:${FACE};${LABEL}font-size:12px;color:var(--ag-muted);` +
            'font-variant-numeric:tabular-nums;min-width:26px;padding-top:5px;',
        )}
      >
        {String(n).padStart(2, '0')}
      </div>
      <div>
        <h3 style={css(`font-family:${FACE};${SUBHEAD}margin:0;color:var(--ag-ink);`)}>{title}</h3>
        <div style={css(`margin-top:10px;${BODY}color:var(--ag-ink-2);max-width:60ch;`)}>
          {children}
        </div>
        {aside && (
          <div
            style={css(
              'margin-top:16px;padding:14px 16px;background:var(--ag-surface-2);' +
                `border-left:1px solid var(--ag-border);${BODY}font-size:14px;` +
                'color:var(--ag-muted);max-width:58ch;',
            )}
          >
            {aside}
          </div>
        )}
      </div>
    </li>
  );
}

/** A tick line. Deliberately plain — no coloured pills, no icon circles. */
export function Point({
  children,
  icon = 'check',
  onDeep,
}: {
  children: ReactNode;
  icon?: string;
  onDeep?: boolean;
}) {
  return (
    <li style={css('display:flex;gap:12px;align-items:flex-start;padding:9px 0;')}>
      <Icon
        name={icon}
        style={css(
          `font-size:19px;margin-top:2px;flex:none;font-variation-settings:'wght' 200;` +
            `color:${onDeep ? 'rgba(245,242,235,.7)' : 'var(--ag-muted)'};`,
        )}
      />
      <span
        style={css(
          `${BODY}color:${onDeep ? 'rgba(245,242,235,.9)' : 'var(--ag-ink-2)'};`,
        )}
      >
        {children}
      </span>
    </li>
  );
}

export function PointList({ children }: { children: ReactNode }) {
  return <ul style={css('list-style:none;padding:0;margin:18px 0 0;')}>{children}</ul>;
}

/** A short quoted line set large. Used for the seller's own words, never ours. */
export function PullQuote({
  children,
  attribution,
}: {
  children: ReactNode;
  attribution: ReactNode;
}) {
  return (
    <figure style={css('margin:0;padding-left:20px;border-left:1px solid var(--ag-border);')}>
      <blockquote
        style={css(
          `margin:0;font-family:${FACE};${SUBHEAD}color:var(--ag-ink);text-wrap:pretty;`,
        )}
      >
        “{children}”
      </blockquote>
      <figcaption style={css(`margin-top:16px;${LABEL}color:var(--ag-muted);`)}>
        {attribution}
      </figcaption>
    </figure>
  );
}
