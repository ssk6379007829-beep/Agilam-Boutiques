import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { css } from '@/lib/css';
import { usePageMeta } from '@/lib/pageMeta';
import { graph, organizationSchema, breadcrumbSchema } from '@/lib/schema';
import { useCatalog } from '@/state/CatalogContext';
import { BoutiqueLogo } from '@/components/buyer/BoutiqueLogo';
import { Icon } from '@/components/ui/Icon';
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
  Lede,
  Point,
  PointList,
  PrimaryCta,
  PullQuote,
  Rule,
  Text,
  Wrap,
} from './parts';
import { FACE, HEADING_SM, LABEL, SUBHEAD } from './type';
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
      <SellReach />
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
    <Band
      style={css(
        'position:relative;overflow:hidden;background:var(--ag-ink);color:var(--ag-bg);' +
          'min-height:clamp(560px,86svh,900px);display:flex;flex-direction:column;justify-content:center;',
      )}
    >
      <HeroParticles />
      <Wrap
        wide
        style={css(
          'position:relative;z-index:1;padding-top:clamp(28px,3.5vw,52px);padding-bottom:clamp(28px,3.5vw,52px);',
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

            <HeroStats terms={terms} />
          </div>

          {/* The stage — the seller on the ink field, lifted off a berry accent
              panel with a soft glow, two truthful proof chips overlapping her.
              Panel + glow are decorative (aria-hidden); the figure is the hero's
              LCP (145KB transparent WebP, eager). */}
          <div className="agx-sell-hero-stage">
            <div className="agx-sell-hero-panel" aria-hidden="true" />
            <div className="agx-sell-hero-glow" aria-hidden="true" />
            <img
              className="agx-sell-hero-figure-img"
              src="/sell-hero.webp"
              alt="A boutique owner in her shop, ready to sell her collection across India on MangaiMart"
              width={675}
              height={1300}
              loading="eager"
              decoding="async"
            />
            <div className="agx-sell-hero-chip agx-sell-hero-chip--a">
              <Icon name="verified_user" style={css('font-size:20px;color:var(--ag-good-text);flex:none;')} />
              <div>
                <strong>Paid before you pack</strong>
                <span>Every order is prepaid &mdash; there is no cash on delivery.</span>
              </div>
            </div>
            <div className="agx-sell-hero-chip agx-sell-hero-chip--b">
              <Icon name="savings" style={css('font-size:20px;color:var(--ag-gold-text);flex:none;')} />
              <div>
                <strong>Cancelled or returned? &#8377;0</strong>
                <span>The fee lands only on an order that actually arrives.</span>
              </div>
            </div>
          </div>
        </div>
      </Wrap>
    </Band>
  );
}

/* ── Hero stat tiles ──────────────────────────────────────────────────────── */

/**
 * Three real figures under the hero copy, in gold. Every one is true and
 * checkable: nothing to join, the single live platform fee, and that every
 * order is prepaid (there is no cash on delivery — migration 0085). No seller
 * count and no GMV — rule 2 of sellContent.ts still stands.
 */
function HeroStats({ terms }: { terms: ReturnType<typeof useSellerTerms> }) {
  const stats: Array<[string, string]> = [
    ['₹0', 'to join, to list, to stay'],
    [`${terms.commissionPct}%`, 'one fee, only on delivery'],
    ['100%', 'prepaid before you pack'],
  ];
  return (
    <div className="agx-sell-hero-stats">
      {stats.map(([n, label]) => (
        <div key={label} className="agx-sell-hero-stat">
          <div
            className="agx-sell-hero-stat-n"
            style={css(
              `font-family:${FACE};font-variation-settings:'wdth' 110,'wght' 640;` +
                "font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1;",
            )}
          >
            {n}
          </div>
          <div className="agx-sell-hero-stat-l">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Hero backdrop particles ──────────────────────────────────────────────── */

/**
 * Decorative only — `aria-hidden`. A sparse scatter of petals and dots in gold
 * and berry on the ink field; the two soft glows behind them come from CSS.
 * Pure SVG, no animation that could cost a frame on a cheap phone.
 */
function HeroParticles() {
  const petal = 'M0 0 C 11 -15 11 -36 0 -50 C -11 -36 -11 -15 0 0 Z';
  return (
    <div className="agx-sell-hero-particles" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <path id="sell-petal" d={petal} />
        </defs>
        <g fill="var(--ag-gold)">
          <circle cx="110" cy="150" r="3.5" opacity=".55" />
          <circle cx="330" cy="80" r="2.5" opacity=".4" />
          <circle cx="1290" cy="120" r="4" opacity=".5" />
          <circle cx="1390" cy="430" r="2.5" opacity=".45" />
          <circle cx="620" cy="60" r="2" opacity=".35" />
          <circle cx="90" cy="520" r="2.5" opacity=".4" />
          <circle cx="1180" cy="780" r="3" opacity=".4" />
        </g>
        <g fill="var(--ag-bg)">
          <circle cx="210" cy="300" r="2" opacity=".25" />
          <circle cx="1360" cy="260" r="2.5" opacity=".22" />
          <circle cx="470" cy="820" r="2" opacity=".2" />
          <circle cx="980" cy="150" r="2" opacity=".22" />
        </g>
        <g>
          <use href="#sell-petal" transform="translate(250 650) rotate(28) scale(1.8)" fill="var(--ag-crimson)" opacity=".5" />
          <use href="#sell-petal" transform="translate(1320 600) rotate(-18) scale(1.5)" fill="var(--ag-gold)" opacity=".3" />
          <use href="#sell-petal" transform="translate(160 760) rotate(10) scale(1.2)" fill="var(--ag-gold)" opacity=".35" />
          <use href="#sell-petal" transform="translate(1250 320) rotate(-40) scale(1.1)" fill="var(--ag-crimson)" opacity=".4" />
        </g>
      </svg>
    </div>
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
/* ── Reach: the searches that bring a seller here (SEO + GEO surface) ──────── */

/** Garment types this marketplace actually carries, each linking to its live
 *  collection page. Labels are rendered as "Sell <x> online" — the exact phrase
 *  a boutique owner searches. Nothing here is a keyword without a page behind it
 *  (rule 2 of sellContent.ts). Slugs match the buyer collection routes. */
const SELL_GARMENTS: Array<[string, string]> = [
  ['sarees', 'sarees'],
  ['kurtis', 'kurtis'],
  ['kurta sets', 'kurta-sets'],
  ['lehengas', 'lehengas'],
  ['salwar suits', 'salwar-suits'],
  ['anarkali suits', 'anarkali-suits'],
  ['half sarees', 'half-sarees'],
  ['blouses', 'blouses'],
];

/**
 * A real, crawlable surface for the intent that brings a boutique owner here —
 * "how to sell sarees online", "sell kurtis online in Tamil Nadu". The garments
 * link to live collection pages (so a seller sees the demand); the geography is
 * named in prose. The same content is mirrored into the `/sell` crawl body in
 * middleware.js, for the AI-search bots that never run the React app.
 */
function SellReach() {
  return (
    <Band tone="panel">
      <Wrap wide>
        <Eyebrow>Sell online from anywhere in India</Eyebrow>
        <Display>From a boutique in your town to buyers across the country.</Display>
        <Lede>
          Boutiques open on MangaiMart from every corner of India &mdash; from Coimbatore, Chennai,
          Erode, Tiruppur, Madurai and Salem across Tamil Nadu to Bengaluru, Hyderabad, Kochi,
          Mumbai and Delhi, and the towns in between. Your shop&rsquo;s address only sets your
          delivery zones; it never decides whether you can join.
        </Lede>

        <div style={css('margin-top:40px;')}>
          <h3 style={css(`${LABEL}color:var(--ag-muted);margin:0 0 16px;`)}>What boutiques sell here</h3>
          <div className="agx-sell-tagrow">
            {SELL_GARMENTS.map(([label, slug]) => (
              <Link key={slug} to={`/collections/${slug}`} className="agx-sell-tag">
                Sell {label} online
              </Link>
            ))}
          </div>
        </div>
      </Wrap>
    </Band>
  );
}

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
            <Text>
              You will see marketplaces advertise 0% commission. None of them run for free — it comes
              back as a charge to list, paid placement you have to buy just to be seen, or a slice of
              every delivery. Here it is one fee, only on an order that arrives, and that is the whole
              of what we take.
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
