/**
 * The seller site's type system: one face, its axes, and the roles they build.
 *
 * Generated from `docs/architecture/SELL_DESIGN_SYSTEM.md` — that file is the
 * source of truth. If the two disagree, this one is what gets corrected.
 *
 * Split out of `parts.tsx` rather than living beside the components, because
 * these are functions and a file that exports both components and functions
 * loses React Fast Refresh for everything in it. The components in `parts.tsx`
 * import from here; so do the five pages, for the headings they set inline.
 */

/**
 * Archivo. The site's only typeface.
 *
 * It replaced Libre Caslon Text, by way of a Fraunces pass the same day. Caslon
 * is a book face and Fraunces is a made-by-hand face; this site is a counter and
 * a ledger, and a ledger is set in a workhorse. Archivo is a grotesque drawn for
 * high-reproduction print and forms, which is exactly the register.
 *
 * Georgia is a poor metric match on purpose — there is no good grotesque in the
 * system stack that Archivo resembles closely enough for the swap to be
 * invisible, so the fallback is the platform UI face, which at least shares its
 * proportions.
 */
export const FACE = "'Archivo',system-ui,-apple-system,'Segoe UI',sans-serif";

/**
 * The width and weight axes, as a `font-variation-settings` value.
 *
 * `wdth` is the whole typographic hierarchy of this site. One family does the
 * work two normally do, and that is not a saving — it is how a printed form is
 * actually typeset: column heads squeezed narrow, amounts opened wide, running
 * text left alone at normal width in between.
 *
 * Every role below goes through this, so a width or weight cannot be invented at
 * a call site.
 */
const axes = (wdth: number, wght: number) =>
  `font-variation-settings:'wdth' ${wdth},'wght' ${wght};`;

/**
 * Tabular figures.
 *
 * Not cosmetic. The hero's reckoning rewrites its numbers on every keystroke,
 * and proportional digits make the whole line jump sideways as she types.
 */
const TABULAR = "font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1;";

/* ── The roles ──────────────────────────────────────────────────────────────
   Six, and no seventh without adding it here first. Sizes that must survive a
   360px phone as well as a 1180px container are `clamp()`; the rest are fixed
   because a label that scales is a label that stops aligning with its column. */

/** Column heads, eyebrows. The condensed end of the axis. */
export const LABEL =
  `${axes(78, 600)}font-size:11px;line-height:1.4;letter-spacing:.14em;text-transform:uppercase;`;

/** Running text. The only role at normal width and regular weight. */
export const BODY = `${axes(100, 400)}font-size:16px;line-height:1.65;`;

/** A section opens here. */
export const SUBHEAD =
  `${axes(100, 600)}font-size:clamp(19px,2.4vw,23px);line-height:1.3;letter-spacing:-.01em;`;

/** The page's own headline. One per page. */
export const DISPLAY =
  `${axes(100, 600)}font-size:clamp(30px,4.5vw,46px);line-height:1.12;letter-spacing:-.02em;`;

/**
 * Money. Opened wide, tabular, and the only crimson on the site.
 *
 * The colour is deliberately part of the role rather than left to the call
 * site: crimson means money here, and a heading that reaches for `AMOUNT`
 * because it wants the width would quietly break the one rule the palette is
 * built on.
 */
export const AMOUNT =
  `${axes(108, 600)}${TABULAR}font-size:clamp(20px,4.4vw,24px);line-height:1.15;` +
  'white-space:nowrap;color:var(--ag-crimson);';

/** The total, and nothing else. The largest thing on any page that carries one. */
export const AMOUNT_XL =
  `${axes(112, 600)}${TABULAR}font-size:clamp(40px,7vw,60px);line-height:1.05;` +
  'letter-spacing:-.02em;white-space:nowrap;color:var(--ag-deep);';

/**
 * The button face. Condensed and uppercase — a stamped form's instruction.
 *
 * Separate from `LABEL` because it is a control rather than a column head: it
 * sits at 14px so the 44px touch target is reachable without inflating the
 * padding past what the shape wants.
 */
export const CONTROL =
  `${axes(90, 600)}font-size:14px;line-height:1.2;letter-spacing:.04em;text-transform:uppercase;`;

/**
 * A small heading — the title of a card, a point, a table row group.
 *
 * Distinct from `SUBHEAD`, which opens a whole section, and from `LABEL`, which
 * heads a column. This is the one that names a thing inside a block, and it is
 * the role the old kit called `LABEL_LG`.
 */
export const HEADING_SM = `font-variation-settings:'wdth' 100,'wght' 600;font-size:15px;line-height:1.35;`;

/**
 * A link that sits inside running text or closes a section.
 *
 * Ink, not crimson — crimson is money. The affordance is the rule underneath,
 * which thickens on hover; see `.agx-sell-link` in index.css.
 */
export const LINK = `font-variation-settings:'wdth' 100,'wght' 600;font-size:15px;line-height:1.4;`;
