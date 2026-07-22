/**
 * The collections a buyer can browse by, derived from the live catalogue.
 *
 * `CATEGORIES` in @/data/demo is six hand-drawn tiles from the design file. It
 * is the right thing for the Home rail — the art is deliberate and the row has
 * to be short — but it is the wrong thing for a See-all page: it hardcodes a
 * "More" tile that means nothing, and it silently hides any category a seller
 * has actually listed under (Dupattas, Blouses, Kids) simply because the design
 * did not draw a circle for it.
 *
 * So the See-all page reads the catalogue instead, and borrows the design's
 * artwork wherever the names line up. Every tile carries a live count, because
 * a tile that opens onto an empty grid is worse than no tile at all — anything
 * with a count of 0 is never rendered.
 */

import { CATEGORIES, COLORS, OCCASIONS, TONES } from '@/data/demo';
import type { Product } from '@/data/demo';

export type CategoryTile = {
  name: string;
  count: number;
  /** Design artwork when the catalogue name matches a drawn tile. */
  image?: string;
  icon: string;
  toneHex: string;
  /** Cheapest piece in the category — "from ₹1,899" under the name. */
  from: number;
};

export type OccasionTile = { name: string; count: number; icon: string; toneHex: string };
export type ColourTile = { name: string; count: number; hex: string };
export type BudgetTile = { label: string; maxPrice: number; count: number };
export type FabricTile = { name: string; count: number };

/**
 * Budget bands are a ladder ("Under ₹3,000"), not slices ("₹2,000–3,000").
 *
 * The filter model carries a single `maxPrice` and no floor, so a slice cannot
 * be expressed without a schema change — and a ladder is the better shopping
 * affordance anyway: a buyer with ₹3,000 wants everything they can afford, not
 * only the things that cost nearly that much.
 */
const BUDGET_STEPS = [1500, 3000, 5000, 10000];

const rupees = (n: number) => '₹' + n.toLocaleString('en-IN');

/** Fallback art for a category the design never drew a circle for. */
const GENERIC_ICON = 'checkroom';

function count<T>(items: T[], pick: (t: T) => string | undefined | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = pick(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export type Collections = {
  categories: CategoryTile[];
  occasions: OccasionTile[];
  budgets: BudgetTile[];
  colours: ColourTile[];
  fabrics: FabricTile[];
};

export function buildCollections(products: Product[]): Collections {
  const drawn = new Map(CATEGORIES.map((c) => [c.name.toLowerCase(), c]));

  const catCounts = count(products, (p) => p.cat);
  const categories: CategoryTile[] = [...catCounts.entries()]
    .map(([name, n]) => {
      const art = drawn.get(name.toLowerCase());
      const cheapest = Math.min(...products.filter((p) => p.cat === name).map((p) => p.price));
      const sample = products.find((p) => p.cat === name);
      return {
        name,
        count: n,
        image: art?.image,
        icon: art?.icon ?? GENERIC_ICON,
        toneHex: art?.toneHex ?? TONES[sample?.tone ?? 0],
        from: cheapest,
      };
    })
    // Biggest edits first — the page should lead with what there is most of.
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const occCounts = count(products, (p) => p.occasion);
  // The design's occasion order is a narrative (bridal → casual), so keep it and
  // append anything the sellers have added that the design did not anticipate.
  const occOrder = [...OCCASIONS, ...[...occCounts.keys()].filter((o) => !OCCASIONS.includes(o))];
  const occasions: OccasionTile[] = occOrder
    .filter((name) => (occCounts.get(name) ?? 0) > 0)
    .map((name, i) => ({
      name,
      count: occCounts.get(name) ?? 0,
      icon: OCCASION_ICON[name] ?? 'celebration',
      toneHex: TONES[i % TONES.length],
    }));

  const budgets: BudgetTile[] = BUDGET_STEPS.map((maxPrice) => ({
    label: `Under ${rupees(maxPrice)}`,
    maxPrice,
    count: products.filter((p) => p.price <= maxPrice).length,
  })).filter((b) => b.count > 0);

  const colourCounts = count(products, (p) => p.color);
  const known = new Map(COLORS.map((c) => [c.name.toLowerCase(), c.hex]));
  const colours: ColourTile[] = [...colourCounts.entries()]
    .map(([name, n]) => ({ name, count: n, hex: known.get(name.toLowerCase()) ?? '#C9A9B6' }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const fabricCounts = count(products, (p) => p.fabric);
  const fabrics: FabricTile[] = [...fabricCounts.entries()]
    .map(([name, n]) => ({ name, count: n }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { categories, occasions, budgets, colours, fabrics };
}

/** Material Symbols glyph per occasion, so the row is scannable at a glance. */
const OCCASION_ICON: Record<string, string> = {
  Bridal: 'diamond',
  Wedding: 'favorite',
  Reception: 'nightlife',
  Festive: 'celebration',
  Party: 'local_bar',
  Casual: 'wb_sunny',
};
