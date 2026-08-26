# Paper and Crimson — the /sell design system

**The source of truth for the public seller site.** Every colour, size, rule and
duration on `/sell` comes from this file. No magic numbers, no rogue hex.

This lives here rather than at the repo root because CLAUDE.md keeps the root to
`README.md` and `CLAUDE.md`. The generated token block is
`.agx-sell-light` in `src/index.css`, and it is a child of this document — if the
two disagree, this file is wrong and should be corrected, not the CSS.

---

## The two theses

**Visual.** Warm paper and near-black ink with MangaiMart's crimson spent *only*
on figures and money; one family throughout — Archivo, its width axis carrying
the hierarchy, condensed for labels and expanded for amounts, the way a printed
form is typeset — ruled rather than shadowed, flat, on a 4px grid with consistent
ledger row heights and 2px stamped-form radii.

**Interaction.** Fast and dry (120–180ms), hover changes ink and rules but never
scale or elevation, nothing whatsoever triggers on scroll, and the only real
motion on the site is the reckoning's figures settling once — no bounce, no
spring, no parallax, no reveal-on-scroll, no shimmer.

Both were validated on 2026-08-25 before any code was written.

---

## Why the site looks nothing like the storefront

Deliberate, and it is the whole point of the brief.

The buyer storefront is a shop window: crimson on rose-cream, Playfair, product
photography. It sells sarees to a woman who wants to feel something.

`/sell` sells a *business arrangement* to a woman deciding whether to trust a
marketplace with her livelihood. She is not browsing. She has one question —
"what would I actually be left with" — and every marketplace she has looked at
so far has been evasive about it. So the site is a counter and a ledger: paper,
ink, ruled columns, and the only coloured thing on the page is the number.

The two surfaces are allowed to disagree because they are doing different jobs.
What holds them together is the crimson, which is the same crimson.

---

## How this avoids touching anything else

`/sell` already re-declares the full `--ag-*` set on `.agx-sell-light`, because
the site pins itself to one palette whatever the visitor's OS theme says. That
mechanism is what makes a separate identity safe:

- The **values** of `--ag-*` are redefined inside `.agx-sell-light`.
- The **components** keep saying `var(--ag-deep)`, `var(--ag-bg)` and so on, so
  CLAUDE.md rule 4 ("colours are `--ag-*`, never literal hex") holds unchanged.
- Custom properties inherit and a declaration on a descendant beats one
  inherited from `:root`, so nothing outside the `/sell` subtree sees any of it.
  The buyer storefront, the seller console and the admin console are untouched.

**If a token is added to `:root[data-theme="dark"]` in `index.css`, add it here
too**, or it will be the one thing on `/sell` that goes dark.

---

## 1. Colour

Nine values. The discipline is in the last two: **crimson never touches a
heading, a button, a border, a link or an icon.** It appears on money, and on the
rule that money sits behind. A page where the only coloured thing is the number
she came to check has told her what it thinks matters.

| Token | Value | Role | Contrast on paper |
|---|---|---|---|
| `--ag-bg` | `#F5F2EB` | Paper — the ground | — |
| `--ag-surface` | `#FFFFFF` | The bill — cards, panels | 1.06:1 (a deliberate whisper) |
| `--ag-surface-2` | `#FCFAF6` | Quiet inset — asides, totals | 1.03:1 |
| `--ag-surface-3` | `#F0ECE3` | Deeper chip / rail | — |
| `--ag-ink` | `#1A1614` | Primary text | 16.1:1 · AAA |
| `--ag-ink-2` | `#4A423D` | Body copy | 8.8:1 · AAA |
| `--ag-muted` | `#6E655E` | Captions, labels | 5.1:1 · AA |
| `--ag-border` | `#DDD6CB` | Rule — hairlines | decorative only |
| `--ag-border-soft` | `#EDE8DF` | Row rule, inside a block | decorative only |
| `--ag-crimson` | `#B02454` | **Money.** Amounts, the money rule | 5.8:1 · AA |
| `--ag-deep` | `#8E1C44` | **The total.** The largest amount only | 7.8:1 · AAA |

The neutrals are warm on purpose — the ink is brown-black, not pure black, and
the paper is yellow-warm, not grey. A pure neutral here reads as a fintech
dashboard, which is the failure mode this palette is closest to.

**`--ag-border` is never load-bearing alone.** At ~1.3:1 it is a hairline for
rhythm. Anything that has to read as a boundary of a control uses `--ag-ink` or
`--ag-crimson`, both well past 3:1.

### Semantic colour

Suppressed almost to nothing. `/sell` has no dashboard state to report — it is
read, not operated. The two that survive are for form feedback only, and neither
is crimson, so neither can be mistaken for money:

| Token | Value | Role |
|---|---|---|
| `--ag-good-text` | `#2F6B4A` | A field accepted |
| `--ag-danger-text` | `#9A3A22` | A field that needs fixing |

---

## 2. Type

**One family: Archivo**, variable, axes `wdth` 62–125 and `wght` 100–900.

It replaced Fraunces, which replaced Libre Caslon Text. Archivo is a grotesque
drawn for high-reproduction print and forms, which is precisely the register: a
ledger is set in a workhorse, not in a book face. The width axis then does what a
second family normally does — and that is not a saving, it is how a printed form
is actually typeset: column heads squeezed narrow, amounts opened wide, running
text left alone in between.

Requested in `index.html` as one variable font (roman only — the site sets no
italic). It replaced Fraunces in that request rather than being added to it, so
the global font payload did not grow, and nothing outside `/sell` uses it.

| Role | wdth | wght | Size | Notes |
|---|---|---|---|---|
| `LABEL` | 78 | 600 | 11px | uppercase, tracking `.14em` |
| `BODY` | 100 | 400 | 16px / 1.65 | 66ch measure |
| `SUBHEAD` | 100 | 600 | `clamp(19px, 2.4vw, 23px)` | tracking `-.01em` |
| `DISPLAY` | 100 | 600 | `clamp(30px, 4.5vw, 46px)` | tracking `-.02em`, `text-wrap: balance` |
| `AMOUNT` | 108 | 600 | `clamp(20px, 4.4vw, 24px)` | tabular, `--ag-crimson` |
| `AMOUNT_XL` | 112 | 600 | `clamp(40px, 7vw, 60px)` | tabular, `--ag-deep` |

**Every figure is tabular.** `font-variant-numeric: tabular-nums` plus
`font-feature-settings: 'tnum' 1`. This is not cosmetic: the reckoning rewrites
its numbers on every keystroke, and proportional digits make the line jump
sideways as she types.

**Body copy is the only role at normal width and regular weight.** Anything with
a job leaves normal width to say so.

---

## 3. Space

4px base. Nothing off the scale.

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`

| Measure | Value |
|---|---|
| Container, wide | 1180px |
| Container, prose | 940px |
| Page gutter | `clamp(20px, 3vw, 24px)` |
| Section rhythm | `clamp(56px, 7vw, 96px)` |
| Ledger row, min height | 56px desktop · 48px mobile |
| Running text measure | 66ch |

The section rhythm is tighter than the 120px the site used to run at. A ledger is
ruled at a consistent pitch; 120px of air between sections is a gallery, which is
a different building.

---

## 4. Shape

| Token | Value | Applies to |
|---|---|---|
| `--sell-r-control` | `2px` | Buttons, inputs, chips |
| `--sell-r-panel` | `4px` | Cards, the bill, tables |
| Ruled edges | `0` | Anything separated by a rule rather than a box |

**No shadows anywhere.** Not one. Separation is done with rules, the way a ledger
does it. This is the single largest departure from the old site, which leaned on
a berry-tinted card shadow throughout.

---

## 5. Motion

| Token | Value | Applies to |
|---|---|---|
| `--sell-t-fast` | `120ms` | Ink and rule colour |
| `--sell-t-base` | `160ms` | Buttons, links, focus |
| `--sell-t-max` | `180ms` | The ceiling. Nothing is slower. |
| `--sell-ease` | `cubic-bezier(.2, 0, 0, 1)` | Everything |
| `--sell-t-settle` | `520ms` | The reckoning, once, on load |
| stagger | `0` | Nothing staggers |

One curve: off the mark hard, then a long settle, no overshoot. The value never
passes the number and comes back.

**The reckoning is the only animation on the site.** It runs once when the page
loads and never again — not on every keystroke as she types her own price. A
figure that tweens while you type is unreadable and reads as lag.

`prefers-reduced-motion: reduce` removes it entirely; the degraded version is the
number simply being correct.

### Forbidden

Approved as part of the interaction thesis. These are off the table site-wide:

reveal-on-scroll · parallax · stagger · bounce · elastic · spring easing · scale
on hover · lift and drop-shadow · skeleton shimmer · gradients of any kind ·
crimson on anything but money · a second typeface · icon-in-a-tinted-circle

### Loading, without shimmer

`/sell` reads its numbers live from `platform_settings` via `useSellerTerms`, so
there is a real moment before they resolve — and shimmer is forbidden. The rule:

- **Reserve the space.** A figure's box is sized before its value arrives, so
  nothing reflows when it lands. `useSettings` already returns defaults, so the
  common case renders a plausible number immediately and corrects it in place.
- **Never show a spinner for a number.** A number that is about to be right does
  not need a loading state; it needs to not move.
- The settle animation covers the arrival. That is what it is for.

---

## 6. Components

Five states on everything interactive: **default · hover · focus · active ·
disabled.** Hover changes ink and rules. Nothing scales, nothing lifts.

### Button, primary

```
padding      13px 26px
radius       --sell-r-control
type         wdth 90 · wght 600 · 14px · tracking .04em · uppercase
default      background --ag-ink,    border --ag-ink,    text --ag-bg
hover        background --ag-deep,   border --ag-deep
focus        outline 2px --ag-crimson, offset 3px
active       background --ag-ink,    border --ag-ink
disabled     background transparent, border --ag-border, text --ag-muted
transition   --sell-t-base --sell-ease  (colour only)
```

### Button, secondary

Same geometry. `background: transparent`, `color: --ag-ink`, `border: --ag-ink`.
Hover inverts to the primary's default fill.

### The ledger block — the signature

The one structural device the site repeats. Figures never sit inline with prose;
they live in a column of their own, ruled off in crimson, running the height of
any block that carries money.

```
container    background --ag-surface · border 1px --ag-border · radius --sell-r-panel
head         border-bottom 1px --ag-ink · LABEL both cells
row          grid 1fr auto · min-height 56px · border-bottom 1px --ag-border-soft
money cell   border-left 1px --ag-crimson · padding-left 16px
             min-width 132px · text-align right · AMOUNT
total row    border-top 1px --ag-ink · background --ag-surface-2 · AMOUNT_XL in --ag-deep
```

It encodes something true — that the amounts are the part you check — rather than
decorating a section break. It is the one place the site is allowed to look like
a bill, because that is exactly what it is showing.

### The price field

The site's only input, and the one interactive thing on it. Not styled as a form
field: no box, no chrome, just the rupee sign and a rule under the digits. A form
field on a marketing page reads as a signup step; this reads as a number written
on a bill.

```
rule         2px solid --ag-crimson   (it is the money rule, and the affordance)
focus        rule stays crimson + outline 2px --ag-crimson, offset 6px
width        6ch, fixed — never hugs its content
type         AMOUNT_XL, tabular
name         from its <label>. No aria-label — one would override the visible
             text and fail Label-in-Name.
```

Fixed width, not `field-sizing: content`: a rule that grew and shrank on every
keystroke would reflow the line as she types, which is exactly what the tabular
figures are there to prevent.

### Rules

| Rule | Weight | Colour | Means |
|---|---|---|---|
| Section head | 1px | `--ag-ink` | a section begins |
| Row | 1px | `--ag-border-soft` | one entry from the next |
| Money column | 1px | `--ag-crimson` | figures live to the right of this |
| Total | 1px above | `--ag-ink` | everything above sums to what is below |
| Masthead / footer | 2px | `--ag-ink` | the page's own edge |

Five rules, five meanings. A rule that means nothing is decoration and does not
belong in a system whose whole argument is precision.

---

## 7. Accessibility floor

Non-negotiable, checked in Phase 5.

- Every text colour above 4.5:1 on its own ground; the table records the measured
  figure, not an estimate.
- Focus visible on every interactive element — 2px crimson outline, 3px offset.
  Never `outline: none` without a replacement.
- Touch targets 44×44px minimum. The nav rail and the CTAs are the ones to watch.
- `prefers-reduced-motion` honoured; the settle is the only thing it has to turn
  off.
- The price field takes its accessible name from its `<label>`, and its live
  region stays `off` until the settle finishes — a polite region armed during a
  520ms tween fires an announcement per frame.
- Body text never below 16px on mobile.
- Responsive at 375 / 768 / 1024 / 1440.

---

## Change log

| Date | Change |
|---|---|
| 2026-08-25 | System created. Theses validated, palette and type replaced wholesale. Supersedes the "Heritage Modern" berry-on-cream kit and the Fraunces pass that preceded it the same day. |
