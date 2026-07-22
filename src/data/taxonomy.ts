import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/uploadImage';

/**
 * The catalogue vocabulary (migration 0024).
 *
 * One table backs three audiences: the seller picks from it, the admin owns it,
 * and the buyer app builds its filters and collection tiles from the approved
 * rows. Everything here is deliberately small — the whole vocabulary is a few
 * dozen rows, so it is fetched once and held in `TaxonomyContext` rather than
 * queried per screen.
 */

export type TaxonomyKind = 'category' | 'occasion' | 'fabric' | 'color' | 'size';
export type TaxonomyStatus = 'pending' | 'approved' | 'rejected';

/** The three vocabularies a seller may request an addition to. */
export const REQUESTABLE_KINDS: TaxonomyKind[] = ['category', 'occasion', 'fabric'];

export const KIND_LABEL: Record<TaxonomyKind, string> = {
  category: 'Category',
  occasion: 'Occasion',
  fabric: 'Fabric',
  color: 'Colour',
  size: 'Size',
};

export interface TaxonomyRow {
  id: string;
  kind: TaxonomyKind;
  name: string;
  name_key: string;
  status: TaxonomyStatus;
  hex: string | null;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  requested_by: string | null;
  boutique_id: string | null;
  note: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const COLUMNS =
  'id, kind, name, name_key, status, hex, icon, image_url, sort_order, requested_by, boutique_id, note, review_note, reviewed_at, created_at';

/**
 * Every term the caller is allowed to see: the approved vocabulary, plus their
 * own pending/rejected requests (RLS decides which, not this query). Ordered so
 * the admin's `sort_order` wins and ties fall back to alphabetical.
 */
export async function fetchTaxonomy(): Promise<TaxonomyRow[]> {
  const { data, error } = await supabase
    .from('taxonomy')
    .select(COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TaxonomyRow[];
}

/**
 * File a request for a term that is not in the list yet.
 *
 * `status`, `requested_by` and the decision fields are not passed and could not
 * be forged if they were — the INSERT policy in 0024 pins them. A duplicate
 * name comes back as a unique-violation, which the caller turns into "that one
 * already exists" rather than an error.
 */
export async function requestTaxonomy(input: {
  kind: TaxonomyKind;
  name: string;
  boutiqueId?: string | null;
  note?: string;
}): Promise<{ duplicate: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Sign in to request a new option');

  const { error } = await supabase.from('taxonomy').insert({
    kind: input.kind,
    name: input.name.trim(),
    // The trigger recomputes this; sent so the insert satisfies NOT NULL.
    name_key: input.name.trim().toLowerCase().replace(/\s+/g, ' '),
    requested_by: uid,
    boutique_id: input.boutiqueId ?? null,
    note: input.note?.trim() || null,
  });

  if (error) {
    if (error.code === '23505') return { duplicate: true };
    throw error;
  }
  return { duplicate: false };
}

// ── Admin ───────────────────────────────────────────────────────────────────

/** Everything, whatever its state — the admin policy widens the same select. */
export async function fetchAllTaxonomy(): Promise<TaxonomyRow[]> {
  const { data, error } = await supabase
    .from('taxonomy')
    .select(`${COLUMNS}, boutique:boutiques(name)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TaxonomyRow[];
}

export async function setTaxonomyStatus(id: string, status: TaxonomyStatus, reviewNote?: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('taxonomy')
    .update({
      status,
      review_note: reviewNote?.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user?.id ?? null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function createTaxonomy(input: {
  kind: TaxonomyKind;
  name: string;
  hex?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
}) {
  const { error } = await supabase.from('taxonomy').insert({
    kind: input.kind,
    name: input.name.trim(),
    name_key: input.name.trim().toLowerCase().replace(/\s+/g, ' '),
    status: 'approved',
    hex: input.hex ?? null,
    image_url: input.imageUrl ?? null,
    sort_order: input.sortOrder ?? 500,
  });
  if (error) throw error;
}

/**
 * Tile art for a category or occasion, in the admin-only `catalogue-images`
 * bucket (migration 0024). Grouped per vocabulary so the bucket stays readable
 * in the Supabase dashboard.
 */
export async function uploadTaxonomyImage(kind: TaxonomyKind, file: File): Promise<string> {
  return uploadImage('catalogue-images', kind, file, '0024');
}

export async function updateTaxonomy(
  id: string,
  patch: Partial<{ name: string; hex: string | null; image_url: string | null; sort_order: number }>,
) {
  // Keep the derived key in step even though the trigger would also do it —
  // the admin table sorts on `name`, and a rename must not leave a stale key.
  const next =
    patch.name != null
      ? { ...patch, name_key: patch.name.trim().toLowerCase().replace(/\s+/g, ' ') }
      : patch;
  const { error } = await supabase.from('taxonomy').update(next).eq('id', id);
  if (error) throw error;
}

export async function deleteTaxonomy(id: string) {
  const { error } = await supabase.from('taxonomy').delete().eq('id', id);
  if (error) throw error;
}

/**
 * How many live products use a term. Retiring "Sarees" while 60 listings sit
 * under it would strand every one of them, so the admin table shows this next
 * to the delete button.
 */
export async function countProductsUsing(kind: TaxonomyKind, name: string): Promise<number> {
  // Sizes live in an array column, so "how many products use it" is a different
  // question — and the admin never retires one, so it is not worth answering.
  if (kind === 'size') return 0;
  const column = kind as 'category' | 'occasion' | 'fabric' | 'color';
  const { count, error } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq(column, name)
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}
