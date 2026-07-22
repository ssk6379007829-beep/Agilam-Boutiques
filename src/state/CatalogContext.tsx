import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { fetchProducts } from '@/data/products';
import { fetchApprovedBoutiques } from '@/data/boutiques';
import type { ProductWithBoutique, BoutiqueRow } from '@/data/types';
import type { Product, Boutique } from '@/data/demo';

/**
 * Live catalogue, adapted to the shapes the screens were built against.
 *
 * The buyer screens were composed around the demo `Product`/`Boutique` records
 * (`p.cat`, `p.image`, `b.insta`, matching products to a boutique by name…).
 * This context fetches the real rows from Supabase and maps them onto those
 * exact shapes, so the screens read from the database without a rewrite.
 * Approved boutiques and their products are public (RLS), so this loads for
 * anonymous buyers too.
 */

function instaHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/(^\.|\.$)/g, '');
}

/** URL-safe handle used for shareable profile links: "Pinky's Boutique" -> "pinkys-boutique". */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toProduct(p: ProductWithBoutique): Product {
  return {
    id: p.id,
    title: p.title,
    price: Number(p.price),
    cat: p.category,
    boutique: p.boutique?.name ?? '',
    city: p.boutique?.city ?? '',
    color: p.color ?? '',
    occasion: p.occasion ?? '',
    rating: Number(p.rating),
    reviews: p.reviews_count,
    tone: p.tone,
    featured: p.featured,
    stock: p.stock,
    fabric: p.fabric ?? '',
    image: p.image_url ?? '',
    description: p.description ?? '',
    mrp: p.mrp ?? null,
    sizes: p.sizes ?? [],
    washCare: p.wash_care ?? '',
    images: p.images ?? [],
  };
}

function toBoutique(b: BoutiqueRow, productCount: number): Boutique {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug || slugify(b.name),
    city: b.city,
    area: b.area || b.city,
    insta: b.instagram || instaHandle(b.name),
    phone: b.phone ?? '',
    since: b.established_year ?? (b.created_at ? new Date(b.created_at).getFullYear() : undefined),
    followers: b.followers_count ?? 0,
    positiveRating: b.positive_rating ?? 0,
    rating: Number(b.rating),
    reviews: b.reviews_count,
    tone: b.tone,
    verified: b.verified,
    featured: b.featured,
    products: productCount,
    desc: b.description,
    image: b.cover_url ?? '',
    logo: b.logo_url ?? '',
  };
}

type CatalogValue = {
  products: Product[];
  boutiques: Boutique[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  productById: (id: string | undefined) => Product | undefined;
  boutiqueById: (id: string | undefined) => Boutique | undefined;
  boutiqueBySlug: (slug: string | undefined) => Boutique | undefined;
};

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { data: rawProducts, loading: lp, error: ep, reload: reloadP } = useAsync(() => fetchProducts(), []);
  const { data: rawBoutiques, loading: lb, error: eb, reload: reloadB } = useAsync(() => fetchApprovedBoutiques(), []);

  const products = useMemo(() => (rawProducts ?? []).map(toProduct), [rawProducts]);

  const boutiques = useMemo(() => {
    const counts = new Map<string, number>();
    (rawProducts ?? []).forEach((p) => counts.set(p.boutique_id, (counts.get(p.boutique_id) ?? 0) + 1));
    return (rawBoutiques ?? []).map((b) => toBoutique(b, counts.get(b.id) ?? 0));
  }, [rawBoutiques, rawProducts]);

  const value = useMemo<CatalogValue>(() => ({
    products,
    boutiques,
    loading: lp || lb,
    error: ep ?? eb,
    reload: () => { reloadP(); reloadB(); },
    productById: (id) => products.find((p) => p.id === id),
    boutiqueById: (id) => boutiques.find((b) => b.id === id),
    boutiqueBySlug: (slug) => boutiques.find((b) => b.slug === slug),
  }), [products, boutiques, lp, lb, ep, eb, reloadP, reloadB]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used within a CatalogProvider');
  return ctx;
}
