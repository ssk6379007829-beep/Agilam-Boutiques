import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { css } from '@/lib/css';
import { usePageMeta } from '@/lib/pageMeta';
import { graph, organizationSchema, breadcrumbSchema } from '@/lib/schema';
import { useCatalog } from '@/state/CatalogContext';
import { BoutiqueLogo } from '@/components/buyer/BoutiqueLogo';
import { Icon } from '@/components/ui/Icon';
import { fmtInr } from '@/lib/tokens';
import {
  ArrowLink,
  Band,
  Card,
  CtaPair,
  DeepPanel,
  Display,
  Eyebrow,
  GhostCta,
  IconPoint,
  Ledger,
  Lede,
  LedgerRow,
  Point,
  PointList,
  PrimaryCta,
  PullQuote,
  Rule,
  Text,
  Wrap,
} from './parts';
import { BODY, FACE, HEADING_SM, LABEL, SUBHEAD } from './type';
import { SELLER_STORIES, START_SELLING, WHAT_YOU_NEED } from './sellContent';
import { useSellerTerms } from './useSellerTerms';

/**
 * `/sell` — the page a boutique owner lands on.
 *
 * The hero sells on MECHANICS, not on scale, because we have no scale worth
 * quoting yet and a fabricated "10,000 sellers" is both a lie and the kind of
 * lie that is trivially checked. What we do have is an arrangement that is
 * genuinely kinder to a small shop than the alternatives — paid before you
 * pack, keep your own delivery, nothing charged until it actually arrives —
 * and a live catalogue of real shops that proves the thing exists.
 *
 * ── Two things about the writing ──────────────────────────────────────────
 *
 * 1. It is "platform fee", never "commission", everywhere a seller can read
 *    it. Same number, same row (`platform_settings.commission_pct`) — but
 *    "commission" is the word a middleman uses for the cut he takes, and it
 *    lands badly on someone deciding whether to trust us. The code keeps the
 *    database's name; the page uses the seller's.
 *
 * 2. The tone is warm and it is not evasive. A percentage always looks large
 *    until you know what it covers, so the page SAYS what it covers rather
 *    than hurrying past it — see `WhatTheFeeCovers`. Softening the number by
 *    hiding it would be the one thing worse than the number.
 *
 * Everything numeric here comes from `useSellerTerms`; everything real comes
 * from the live catalogue via `useCatalog`. No hardcoded rate anywhere.
 */
export function SellHome() {
  const terms = useSellerTerms();
  const { products, boutiques } = useCatalog();

  usePageMeta({
    title: 'Sell on MangaiMart — Open Your Boutique Online',
    description:
      'Open your boutique to buyers across India. Free to join and free to list, a small platform fee only when an order is delivered, every order paid online before you pack, and delivery stays in your hands.',
    canonical: '/sell',
    schema: graph(
      organizationSchema(),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Sell on MangaiMart', path: '/sell' },
      ]),
    ),
  });

  return (
    <>
      <Hero terms={terms} />
      <TheDeal terms={terms} />
      <WhatTheFeeCovers terms={terms} />
      <RealShops boutiques={boutiques} products={products} />
      <Division />
      <SellerVoices />
      <WhatYouNeed />
      <ClosingBand />
    </>
  );
}

/* -- Hero ------------------------------------------------------------------ */

/**
 * The hero - a berry field with a white bill lying on it.
 *
 * -- Why this and not a headline over a row of statistics ------------------
 * It used to end on four big figures with small labels under them, and
 * `Mechanics` repeated that exact form one screen further down. Two dashboard
 * rows on a page whose whole argument is that this is NOT a dashboard.
 *
 * More to the point, a statistic asserts, and a boutique owner arriving here
 * has no reason yet to believe us. The single question she actually has is
 * "what would I be left with" - and it is a question this business can answer
 * in one line, because there is exactly one deduction. So the hero IS that
 * line, and she can type her own prices into it. She arrives sceptical about a
 * percentage and leaves having checked it herself on a saree she really sells.
 *
 * No competitor's landing page can run this, which is rather the point: they
 * cannot show one deduction, because they do not have one.
 *
 * -- Why the photograph went ----------------------------------------------
 * There was an arched portrait here reading `/sell-hero.png`. The file on disk
 * is `public/sell-hero.png.png` - a double extension - so the request 404'd,
 * `onError` fired and the column silently unmounted, every time. It has never
 * once rendered. It was also a 2 MB PNG and a stock-photo gesture, and with the
 * reckoning in the hero there is no room for a second focal point.
 *
 * -- What is deliberately absent ------------------------------------------
 * No seller count, no GMV, no "trusted by thousands". Rule 2 of sellContent.ts.
 * The proof on this page is the live catalogue in `RealShops`, and the
 * arithmetic here, which she can check.
 */
function Hero({ terms }: { terms: ReturnType<typeof useSellerTerms> }) {
  return (
    // Ink, not crimson. This is the largest coloured field on the site, and
    // crimson is money — a berry hero would be the loudest thing on the page
    // and it would not be a number. Ink gives the same weight, none of the
    // meaning, and lets the bill beside it be the only colour that counts.
    <Band style={css('position:relative;overflow:hidden;background:var(--ag-ink);color:var(--ag-bg);')}>
      <Wrap
        wide
        style={css(
          'position:relative;padding-top:clamp(40px,5vw,72px);padding-bottom:clamp(40px,5vw,64px);',
        )}
      >
        <div className="agx-sell-hero">
          <div>
            <Eyebrow onDeep>For boutique owners</Eyebrow>

            {/* The one accent word, in the display italic and the pale gold. It
                falls on the reach - the thing a shop owner cannot get on her
                own, and the entire reason she is reading this page. */}
            <Display
              level={1}
              size="lg"
              onDeep
              style={css('margin-top:22px;font-size:clamp(38px,5.6vw,64px);')}
            >
              From your boutique to{' '}
              <em
                style={css(
                  "font-style:normal;font-variation-settings:'wdth' 118,'wght' 700;color:var(--ag-bg);",
                )}
              >
                every corner
              </em>{' '}
              of
              India.
            </Display>

            <Lede onDeep style={css('margin-top:26px;max-width:46ch;')}>
              List your pieces, reach buyers across India, and keep running your shop exactly as you
              run it now &mdash; we handle the rest. You create, we connect,{' '}
              <strong style={css("font-variation-settings:'wght' 600;color:var(--ag-bg);")}>
                India shops
              </strong>.
            </Lede>

            {/* Hand-rolled rather than `CtaPair`, only so the secondary can
                carry the play glyph - its `secondaryLabel` is a plain string. */}
            <div style={css('display:flex;flex-wrap:wrap;gap:16px;margin-top:36px;')}>
              <PrimaryCta to={START_SELLING} onDeep>
                Start selling today
              </PrimaryCta>
              <GhostCta to="/sell/how-it-works" onDeep>
                <Icon
                  name="play_circle"
                  style={css("font-size:20px;font-variation-settings:'wght' 200;")}
                />
                See how it works
              </GhostCta>
            </div>
          </div>

          <Reckoning terms={terms} />
        </div>

        <HeroFooterLine terms={terms} />
      </Wrap>
    </Band>
  );
}

/* -- The reckoning --------------------------------------------------------- */

/** What the bill opens on. A mid-range saree - recognisable, not aspirational. */
const DEFAULT_PRICE = 2400;

/**
 * The bill, and the one interactive thing on the seller site.
 *
 * She types a price; the fee and the take-home resolve under it as she types.
 * Every figure comes from `useSellerTerms`, so this cannot drift from what
 * `settle_boutique_payout` actually pays her - `netOf` is the same rounding the
 * payout row uses.
 *
 * The input is deliberately not styled as a form field. No box, no chrome, just
 * the rupee sign and a gold rule under the digits: a form field on a marketing
 * page reads as a signup step, and this is meant to read as a number written on
 * a bill. It is still a real `<input>` with a real `<label>`, so it focuses,
 * tabs and reads out properly, and the result carries `aria-live` so a screen
 * reader hears the new figure rather than silently missing it.
 */
function Reckoning({ terms }: { terms: ReturnType<typeof useSellerTerms> }) {
  const [raw, setRaw] = useState(String(DEFAULT_PRICE));

  // An empty field is 0 rather than NaN, so the bill stays readable while she
  // has cleared it to type a new number. Six digits is the cap, which is a
  // 9,99,999 saree - past any real one, and the point where the line wraps.
  const price = Number(raw) || 0;
  const fee = terms.cutOf(price);
  const net = terms.netOf(price);

  // The one animated moment on the site: the take-home counts up once on load
  // and never again - see `useCountUp`. `settled` gates the live region below.
  const [shownNet, settled] = useCountUp(net);

  return (
    <div className="agx-sell-reckoning">
      {/* One white bill, on the ink field. This wrapper is not decoration: the
          price figure is `--ag-deep` and the label `--ag-ink-2`, which on ink
          measure 2.06:1 and worse. On paper they are 7.8:1 and 8.8:1. Paper on
          cloth is also the only real contrast the hero has, now that the field
          behind it is a flat ink rather than a gradient. */}
      <div className="agx-sell-bill">
        <label className="agx-sell-price-row" htmlFor="sell-price">
          <span style={css(`${LABEL}color:var(--ag-muted);`)}>What you&rsquo;d take home</span>
          <div style={css(`margin-top:8px;${BODY}font-size:15px;color:var(--ag-ink-2);`)}>
            A saree, priced by you at
          </div>
          <span
            className="agx-sell-price"
            style={css(
              `font-family:${FACE};font-variation-settings:'wdth' 112,'wght' 600;` +
                "font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1;" +
                'font-size:clamp(38px,5vw,50px);line-height:1.1;color:var(--ag-deep);',
            )}
          >
            <span aria-hidden="true">&#8377;</span>
            <input
              id="sell-price"
              value={raw}
              onChange={(e) => setRaw(e.target.value.replace(/\D/g, '').slice(0, 6))}
              // `inputMode` rather than `type="number"`: this is read on a phone,
              // where the numeric keypad is the whole benefit — while the spinners,
              // and scroll-wheel-changes-the-value, are not.
              inputMode="numeric"
              autoComplete="off"
              // No `aria-label`. One would override the `<label>` and leave the
              // accessible name saying something different from the words on
              // screen, which is the Label-in-Name failure exactly.
              size={6}
            />
          </span>
        </label>

        {/* The live region is switched OFF until the intro count-up has finished.
            A polite region announces every mutation, and the settle mutates this
            figure on every frame for 520ms — armed through that, it would fire a
            few dozen announcements before the page had settled. After it, it is
            armed for the rest of the session, which is the part that matters: she
            types a price and hears what she would be left with. */}
        <div aria-live={settled ? 'polite' : 'off'}>
          <Ledger style={css('margin-top:20px;')}>
            <LedgerRow
              label={`Platform fee (${terms.commissionPct}%)`}
              value={`− ${fmtInr(fee)}`}
              negative
              note="The only deduction. Nothing else comes off."
            />
            <LedgerRow label="Into your bank" value={fmtInr(shownNet)} strong />
          </Ledger>
        </div>

        <p
          style={css(
            `margin:14px 0 0;${BODY}font-size:13px;color:var(--ag-muted);max-width:44ch;`,
          )}
        >
          Sent {terms.holdDays} days after it is delivered, straight to the account you registered
          &mdash; and your delivery charge sits on top of this, in full.
        </p>
      </div>
    </div>
  );
}

/**
 * Counts a figure up from zero, once, the first time it is worth showing.
 *
 * Only the FIRST non-zero value animates. Every value after that - every
 * keystroke in the price field - lands immediately, because a number that
 * tweens on each keystroke is unreadable while you type and reads as lag.
 *
 * Honours `prefers-reduced-motion`, in which case nothing ever tweens.
 *
 * Returns the figure and whether the intro has finished. The caller needs the
 * second one to keep an `aria-live` region quiet while the number is mid-tween.
 */
function useCountUp(value: number, ms = 520): [number, boolean] {
  const [shown, setShown] = useState(0);
  const [settled, setSettled] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    // Settings load a moment after mount, so the first value through here is
    // usually the default-terms one; `done` is set on the first non-zero value
    // and every later one is applied flat.
    if (done.current || value === 0) {
      setShown(value);
      if (value !== 0) done.current = true;
      return;
    }
    done.current = true;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      setSettled(true);
      return;
    }

    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - started) / ms, 1);
      // easeOutCubic: quick off the mark, settles rather than stops.
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setSettled(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, ms]);

  return [shown, settled];
}

/**
 * The line along the foot of the hero - what the catch is, before she goes
 * looking for it.
 *
 * This replaced two separate four-up grids of big figures: the hero's own strip
 * and the `Mechanics` band below it. Both were the same shape, a screen apart,
 * and between them they said less than this sentence does.
 *
 * Set as running text rather than as cards, on purpose. These are the answers
 * to "what else are you going to charge me" - and a reader scanning for the
 * catch reads a sentence, where a grid of figures is the thing she has learned
 * to skip.
 *
 * Every zero here is real: nothing to join (there are no plans), nothing on an
 * order that did not arrive (the fee is charged on delivery), and not a rupee
 * of the delivery charge she sets herself (0076/0077) - which is precisely the
 * line the "0% commission" marketplaces take their own margin on.
 */
function HeroFooterLine({ terms }: { terms: ReturnType<typeof useSellerTerms> }) {
  // Paper-white rather than crimson: these are zeros on an ink field, and
  // crimson is reserved for the amounts in the bill beside them. Emphasis here
  // is weight and width, not colour.
  const zero = css(
    `font-family:${FACE};font-variation-settings:'wdth' 108,'wght' 600;` +
      "font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1;" +
      'font-size:1.15em;color:var(--ag-bg);',
  );
  return (
    <p className="agx-sell-hero-foot">
      <span style={zero}>&#8377;0</span> to join, to list, and every month.{' '}
      <span style={zero}>&#8377;0</span> on an order that is cancelled or comes back.{' '}
      <span style={zero}>0%</span> of the delivery charge you set &mdash; that stays yours in full.
      The {terms.commissionPct}% above is the whole of what we take, and only once she has it in her
      hands. About fifteen minutes to open the shop, on your phone.
    </p>
  );
}

/* ── The money, worked ─────────────────────────────────────────────────────── */

/**
 * The arrangement, in prose.
 *
 * This section used to close on a `Card` working ₹2,400 down to a payout. The
 * hero does that now, and interactively, so what was left here was the same
 * sum a second time on the same page. Repeating your one proof weakens it.
 *
 * What replaces it is the case the arithmetic cannot make: the orders where
 * nothing is charged at all. Those are the ones a boutique owner is quietly
 * worried about - the buyer who changes her mind, the piece she cannot make in
 * time - and every one of them costs her nothing.
 */
function TheDeal({ terms }: { terms: ReturnType<typeof useSellerTerms> }) {
  return (
    <Band>
      <Wrap wide>
        <div className="agx-sell-lean">
          <div>
            <Eyebrow>The whole arrangement</Eyebrow>
            <Display>We only earn when you do.</Display>
            <Text>
              Most marketplaces need a table with nine rows to explain themselves. Here it is one
              line: {terms.commissionPct}% of what the pieces sold for, and only once the order has
              actually reached your customer. Until that happens we have not earned anything, and we
              do not take anything.
            </Text>
            <Text>
              No fee on a sale that did not happen has always seemed to us like the only fair way to
              do this. It also means the risk of a quiet month sits with us, not with you.
            </Text>
            <div style={css('margin-top:32px;')}>
              <ArrowLink to="/sell/pricing">
                See every charge, worked out on real prices
              </ArrowLink>
            </div>
          </div>

          <div>
            <h3 style={css(`${LABEL}color:var(--ag-muted);margin:0 0 4px;`)}>
              Orders you are charged nothing for
            </h3>
            <PointList>
              <Point icon="do_not_disturb_on">The buyer changes her mind before it is dispatched</Point>
              <Point icon="do_not_disturb_on">You turn an order down, or cannot make the piece in time</Point>
              <Point icon="do_not_disturb_on">It comes back inside her return window</Point>
              <Point icon="do_not_disturb_on">It is refunded, in part or in full</Point>
              <Point icon="do_not_disturb_on">
                Anything you ring up at your own counter, to a walk-in customer
              </Point>
            </PointList>
            <Text style={css('margin-top:20px;font-size:14px;')}>
              The fee attaches to a delivered order and to nothing else, so none of the above ever
              reaches a payout statement. There is no minimum, and no monthly floor to make up.
            </Text>
          </div>
        </div>
      </Wrap>
    </Band>
  );
}

/* ── What the fee actually buys ────────────────────────────────────────────── */

/**
 * The answer to "why is it that much?", given before anyone has to ask.
 *
 * A percentage looks like a lot right up until you know what sits behind it,
 * and the instinct to bury the number is exactly wrong — a seller who finds it
 * later feels tricked, and rightly. So the number stays in plain sight two
 * sections earlier and this is where it is justified.
 *
 * Every line below is something the platform genuinely carries. The gateway
 * charge and the tax are the two named in migration 0025's own note on the
 * money model; the rest are real costs of running the marketplace. Nothing
 * here is padded to make the list look longer.
 */
function WhatTheFeeCovers({ terms }: { terms: ReturnType<typeof useSellerTerms> }) {
  return (
    <Band tone="panel">
      <Wrap wide>
        <div className="agx-sell-lean">
          <div>
            <Eyebrow>Fair’s fair</Eyebrow>
            <Display>Where your {terms.commissionPct}% goes.</Display>
            <Text>
              You are trusting us with your livelihood, so you should know what you are paying for
              rather than take it on faith. Here is the honest list — and it is one fee covering all
              of it, not the first of several.
            </Text>
            <Text>
              There is no version of MangaiMart where you pay less by giving something up, because
              there are no plans and no tiers. The newest shop on the site is on exactly the same
              terms as the busiest one.
            </Text>
          </div>

          <div style={css('display:flex;flex-direction:column;gap:40px;')}>
            <IconPoint icon="payments" title="Taking the payment.">
              Every card, UPI and netbanking charge, and the tax on it. On a small order that alone
              is a meaningful slice of the fee.
            </IconPoint>
            <IconPoint icon="search" title="Finding you the buyer.">
              Search, the collection pages, the feed and the work of getting MangaiMart in front of
              people who are shopping for what you make.
            </IconPoint>
            <IconPoint icon="account_balance" title="Holding and moving the money.">
              Safely, and then into your bank automatically after each delivery — with the
              statements to match.
            </IconPoint>
            <IconPoint icon="shield" title="Standing behind the order.">
              The 30-day cover on a faulty or wrong item is what lets a stranger in another state
              risk buying from a shop she has never heard of. That trust is the thing you are
              actually renting.
            </IconPoint>
            <IconPoint icon="support_agent" title="The console and the people.">
              Listings, chat, billing, analytics — and someone to pick up the phone when you need
              them.
            </IconPoint>
          </div>
        </div>
      </Wrap>
    </Band>
  );
}

/* ── Real shops, real pieces ───────────────────────────────────────────────── */

function RealShops({
  boutiques,
  products,
}: {
  boutiques: ReturnType<typeof useCatalog>['boutiques'];
  products: ReturnType<typeof useCatalog>['products'];
}) {
  // Shops with something actually listed. A directory of empty shops is not
  // proof of anything, and this section is here to be proof.
  const shown = useMemo(
    () => boutiques.filter((b) => b.products > 0).slice(0, 6),
    [boutiques],
  );
  if (shown.length === 0) return null;

  const cities = new Set(shown.map((b) => b.city).filter(Boolean));

  return (
    // Page tone, not panel: `WhatTheFeeCovers` above it is already tinted, and
    // two panel bands in a row read as one long block with no section break.
    <Band>
      <Wrap wide>
        <Eyebrow>You’d be in good company</Eyebrow>
        <Display>Real shops, listing real pieces, right now.</Display>
        <Lede>
          Every boutique below is live on the storefront today. Open any of them, read their reviews,
          and see exactly what your own shop page would look like — before you decide anything.
        </Lede>

        <div className="agx-sell-shops" style={css('margin-top:48px;')}>
          {shown.map((b) => (
            <Link
              key={b.id}
              to={`/boutique/${b.slug}`}
              className="agx-sell-shop"
              style={css(
                'display:flex;gap:16px;align-items:center;padding:20px;text-decoration:none;' +
                  'border-radius:var(--sell-r-panel);' +
                  'background:var(--ag-surface);border:1px solid var(--ag-border);',
              )}
            >
              <BoutiqueLogo name={b.name} src={b.logo} size={48} radius={8} />
              <div style={css('min-width:0;')}>
                <div
                  style={css(
                    `font-family:${FACE};${HEADING_SM}font-size:17px;color:var(--ag-ink);` +
                      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
                  )}
                >
                  {b.name}
                </div>
                <div style={css('margin-top:4px;font-size:12px;font-weight:500;color:var(--ag-muted);')}>
                  {b.city}
                  {b.products > 0 && ` · ${b.products} piece${b.products === 1 ? '' : 's'}`}
                  {b.verified && ' · Verified'}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div style={css('margin-top:32px;display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;')}>
          <ArrowLink to="/boutiques">Browse every shop on MangaiMart</ArrowLink>
          <span style={css('font-size:14px;color:var(--ag-muted);')}>
            {products.length} live piece{products.length === 1 ? '' : 's'}
            {cities.size > 0 && ` across ${cities.size} cit${cities.size === 1 ? 'y' : 'ies'}`}
          </span>
        </div>
      </Wrap>
    </Band>
  );
}

/* ── What is yours, what is ours ───────────────────────────────────────────── */

function Division() {
  return (
    <Band tone="panel">
      <Wrap wide>
        <Eyebrow>Who does what</Eyebrow>
        <Display>You keep the shop. We take the boring half.</Display>
        <Lede>
          Somewhere that decides your prices, your packing and who your customer is isn’t really a
          marketplace — it’s a supplier contract. We’ve drawn the line the other way round.
        </Lede>

        <div className="agx-sell-two" style={css('margin-top:36px;align-items:start;')}>
          <div>
            <h3 style={css(`font-family:${FACE};${SUBHEAD}margin:0;color:var(--ag-ink);`)}>
              Yours to decide
            </h3>
            <PointList>
              <Point>What each piece costs, and when you discount it</Point>
              <Point>What you charge to deliver — four rates, by distance</Point>
              <Point>How many days you need to dispatch, shown to the buyer before she orders</Point>
              <Point>Your own change-of-mind return window</Point>
              <Point>Your shop page: name, logo, story, city — and its own web address to share</Point>
              <Point>Your own coupon codes, run when you want to run them</Point>
              <Point>Whether to answer a buyer’s message yourself. You always can</Point>
            </PointList>
          </div>

          <div>
            <h3 style={css(`font-family:${FACE};${SUBHEAD}margin:0;color:var(--ag-ink);`)}>
              Ours to handle
            </h3>
            <PointList>
              <Point icon="verified_user">Taking the payment, safely, before the order reaches you</Point>
              <Point icon="verified_user">Holding that money and transferring it to your bank after delivery</Point>
              <Point icon="verified_user">Getting your pieces found — search, collections, the Inspire feed</Point>
              <Point icon="verified_user">The buyer’s account, order tracking and refund handling</Point>
              <Point icon="verified_user">Checking every shop before it can list, so buyers trust the ones that pass</Point>
              <Point icon="verified_user">Covering a faulty or wrong item for 30 days, across the marketplace</Point>
              <Point icon="verified_user">The invoices, the statements and the record of every rupee</Point>
            </PointList>
          </div>
        </div>

        <Rule />

        <div className="agx-sell-two" style={css('align-items:start;')}>
          <div>
            <Display size="sm">And the counter you already have</Display>
            <Text>
              The console bills your walk-in customers too. Ring up a sale at the shop, send the bill
              straight to her WhatsApp, and your stock stays right in one place. We charge nothing at
              all on those — that till is yours, and it never touches a payout.
            </Text>
          </div>
          <div>
            <Display size="sm">On the phone in your hand</Display>
            <Text>
              Listing, photos, orders, chat, billing, earnings — all of it works on a phone. Most
              sellers here never open a laptop. There is nothing to install and nothing to buy.
            </Text>
          </div>
        </div>
      </Wrap>
    </Band>
  );
}

/* ── Sellers in their own words ────────────────────────────────────────────── */

/**
 * Renders nothing until there is a real quote to render.
 *
 * See the note on `SELLER_STORIES` in sellContent.ts. An empty section is a
 * page that is missing a section; an invented one is a page that cannot be
 * trusted about anything else on it, including the money.
 */
function SellerVoices() {
  if (SELLER_STORIES.length === 0) return null;
  return (
    <Band tone="panel">
      <Wrap wide>
        <Eyebrow>In their words</Eyebrow>
        <Display>Sellers already here.</Display>
        <div className="agx-sell-quotes" style={css('margin-top:38px;')}>
          {SELLER_STORIES.map((s) => (
            <PullQuote
              key={`${s.shop}-${s.name}`}
              attribution={
                <>
                  <strong style={css('color:var(--ag-ink);')}>{s.name}</strong>
                  {' · '}
                  {s.boutiqueSlug ? (
                    <Link to={`/boutique/${s.boutiqueSlug}`} className="agx-sell-link">
                      {s.shop}
                    </Link>
                  ) : (
                    s.shop
                  )}
                  {' · '}
                  {s.city}
                </>
              }
            >
              {s.quote}
            </PullQuote>
          ))}
        </div>
      </Wrap>
    </Band>
  );
}

/* ── What you need ─────────────────────────────────────────────────────────── */

function WhatYouNeed() {
  return (
    <Band>
      <Wrap>
        <Eyebrow>Before you start</Eyebrow>
        <Display>Five things — and you almost certainly have four of them.</Display>
        <Lede>
          No minimum number of pieces, no minimum order value, and you don’t need to be a registered
          company. If you make or stock ethnic wear and you can post a parcel, you’re in.
        </Lede>

        <ul style={css('list-style:none;padding:0;margin:64px 0 0;display:flex;flex-direction:column;gap:24px;')}>
          {WHAT_YOU_NEED.map((item) => (
            <li key={item.need}>
              <Card pad={32} style={css('display:flex;gap:24px;align-items:flex-start;')}>
                {/* The glyph sits loose, not in a tinted disc. The disc was the
                    old kit's one permitted exception and it is now on the
                    forbidden list — it is the single most reliable tell that a
                    section was assembled rather than designed. */}
                <Icon
                  name={item.icon}
                  style={css(
                    "font-size:22px;color:var(--ag-ink);flex:none;margin-top:2px;" +
                      "font-variation-settings:'wght' 200;",
                  )}
                />
                <div>
                  <div style={css('display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px;')}>
                    <h3 style={css(`font-family:${FACE};${HEADING_SM}color:var(--ag-ink);margin:0;`)}>
                      {item.need}
                    </h3>
                    {!item.required && (
                      <span
                        style={css(
                          `${LABEL}font-size:10px;color:var(--ag-muted);` +
                            'border:1px solid var(--ag-border);padding:3px 7px;' +
                            'border-radius:var(--sell-r-control);',
                        )}
                      >
                        optional
                      </span>
                    )}
                  </div>
                  <p style={css('margin:0;font-size:14px;line-height:1.6;color:var(--ag-ink-2);max-width:62ch;')}>
                    {item.detail}
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Wrap>
    </Band>
  );
}

/* ── Close ─────────────────────────────────────────────────────────────────── */

function ClosingBand() {
  return (
    <Band>
      <Wrap wide>
        <DeepPanel>
          <div className="agx-sell-two" style={css('align-items:center;')}>
            <div>
              <Eyebrow onDeep>Whenever you’re ready</Eyebrow>
              <Display onDeep size="md">
                Eight short steps, and you can stop after any of them.
              </Display>
              <Lede onDeep>
                Nothing is charged and nothing is committed. Your shop only goes live once one of us
                has looked it over and you’ve listed your first piece — so there is no way to end up
                somewhere you didn’t mean to be.
              </Lede>
              <CtaPair
                to={START_SELLING}
                label="Open your boutique"
                secondaryTo="/sell/faq"
                secondaryLabel="I have questions first"
                onDeep
              />
            </div>
            <div>
              <PointList>
                <Point onDeep icon="schedule">About fifteen minutes, on your phone</Point>
                <Point onDeep icon="save">Saved as you go — close it and come back later</Point>
                <Point onDeep icon="payments">No card asked for, nothing to pay</Point>
                <Point onDeep icon="support_agent">
                  Stuck anywhere? Call or WhatsApp us and a real person will walk you through it
                </Point>
              </PointList>
            </div>
          </div>
        </DeepPanel>
      </Wrap>
    </Band>
  );
}
