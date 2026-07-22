import { useMemo, useState } from 'react';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { useAsync } from '@/hooks/useAsync';
import {
  T, Card, DataTable, EmptyState, GhostButton, IconButton, Icon,
  SearchInput, Select, StatusPill, Drawer, ConfirmDialog, type Column,
} from '@/components/admin/kit';
import {
  fetchAllTaxonomy, setTaxonomyStatus, createTaxonomy, updateTaxonomy, deleteTaxonomy,
  countProductsUsing, KIND_LABEL, type TaxonomyKind, type TaxonomyRow,
} from '@/data/taxonomy';

/**
 * Catalogue vocabulary — the words the whole marketplace shops by.
 *
 * Sellers pick categories, occasions and fabrics from a managed list rather
 * than typing them, so this page is where that list is decided. Two jobs, in
 * the order they matter:
 *
 *   1. **The queue.** A seller asked for a name that does not exist. Their
 *      product is already live under it — what is waiting is whether buyers can
 *      *browse* by it. Approving adds a collection tile and a filter chip
 *      everywhere at once; rejecting asks them to pick the closest existing one
 *      and needs a reason, because "no" with no explanation leaves them nothing
 *      to act on.
 *   2. **The list.** Rename, retire, or add a term directly. Retiring shows the
 *      live product count first: pulling "Sarees" while sixty listings sit
 *      under it would strand every one of them.
 */

const KINDS: TaxonomyKind[] = ['category', 'occasion', 'fabric', 'color', 'size'];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

type WithBoutique = TaxonomyRow & { boutique?: { name: string } | null };

export function Catalogue() {
  const { showToast } = useShop();
  const { data, loading, reload } = useAsync(() => fetchAllTaxonomy(), []);

  const [kind, setKind] = useState<'all' | TaxonomyKind>('all');
  const [query, setQuery] = useState('');
  const [review, setReview] = useState<WithBoutique | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ kind: 'category' as TaxonomyKind, name: '', hex: '', icon: '' });

  const [retire, setRetire] = useState<{ row: TaxonomyRow; uses: number } | null>(null);
  const [renaming, setRenaming] = useState<TaxonomyRow | null>(null);
  const [renameTo, setRenameTo] = useState('');

  // Memoised so `live` below is not recomputed on every keystroke elsewhere —
  // `data ?? []` is a fresh array each render otherwise.
  const all = useMemo(() => (data ?? []) as WithBoutique[], [data]);
  const pending = all.filter((r) => r.status === 'pending');

  const live = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => r.status !== 'pending')
      .filter((r) => kind === 'all' || r.kind === kind)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [all, kind, query]);

  const decide = async (row: TaxonomyRow, status: 'approved' | 'rejected', note?: string) => {
    if (status === 'rejected' && !note?.trim()) {
      showToast('Add a reason — the seller needs something to act on');
      return;
    }
    setBusy(true);
    try {
      await setTaxonomyStatus(row.id, status, note);
      showToast(
        status === 'approved'
          ? `“${row.name}” is now live for buyers to browse`
          : `“${row.name}” turned down`,
      );
      setReview(null);
      setReviewNote('');
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const askRetire = async (row: TaxonomyRow) => {
    try {
      setRetire({ row, uses: await countProductsUsing(row.kind, row.name) });
    } catch {
      setRetire({ row, uses: 0 });
    }
  };

  const doRetire = async () => {
    if (!retire) return;
    setBusy(true);
    try {
      await deleteTaxonomy(retire.row.id);
      showToast(`“${retire.row.name}” removed from the list`);
      setRetire(null);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not remove it');
    } finally {
      setBusy(false);
    }
  };

  const doRename = async () => {
    if (!renaming || !renameTo.trim()) return;
    setBusy(true);
    try {
      await updateTaxonomy(renaming.id, { name: renameTo.trim() });
      showToast('Renamed');
      setRenaming(null);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Rename failed');
    } finally {
      setBusy(false);
    }
  };

  const doAdd = async () => {
    if (draft.name.trim().length < 2) {
      showToast('Enter a name');
      return;
    }
    setBusy(true);
    try {
      await createTaxonomy({
        kind: draft.kind,
        name: draft.name,
        hex: draft.kind === 'color' ? draft.hex || null : null,
        icon: draft.icon || null,
      });
      showToast(`“${draft.name.trim()}” added`);
      setAdding(false);
      setDraft({ kind: 'category', name: '', hex: '', icon: '' });
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not add it');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<WithBoutique>[] = [
    {
      key: 'name',
      header: 'Term',
      width: '2fr',
      render: (r) => (
        <span style={css('display:flex;align-items:center;gap:9px;min-width:0;')}>
          {r.hex && <span style={css(`width:18px;height:18px;flex:none;border-radius:50%;background:${r.hex};box-shadow:0 0 0 1px ${T.field};`)} />}
          {r.icon && !r.hex && <Icon name={r.icon} size={18} color={T.accent} />}
          <span style={css('font-weight:700;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{r.name}</span>
        </span>
      ),
    },
    { key: 'kind', header: 'List', width: '110px', render: (r) => <span style={css(`color:${T.muted};font-size:13px;`)}>{KIND_LABEL[r.kind]}</span> },
    { key: 'status', header: 'Status', width: '110px', render: (r) => <StatusPill status={r.status} /> },
    {
      key: 'origin',
      header: 'Added by',
      width: '1.2fr',
      render: (r) => (
        <span style={css(`color:${T.muted};font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`)}>
          {r.boutique?.name ?? (r.requested_by ? 'A seller' : 'Agilam')}
        </span>
      ),
    },
    { key: 'created', header: 'Added', width: '120px', render: (r) => <span style={css(`color:${T.muted};font-size:12.5px;`)}>{fmtDate(r.created_at)}</span> },
    {
      key: 'actions',
      header: '',
      width: '96px',
      align: 'right',
      render: (r) => (
        <span style={css('display:flex;gap:6px;justify-content:flex-end;')}>
          <IconButton icon="edit" title="Rename" onClick={() => { setRenaming(r); setRenameTo(r.name); }} />
          <IconButton icon="delete" tone="danger" title="Remove from the list" onClick={() => askRetire(r)} />
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* ── The queue ──────────────────────────────────────────────────── */}
      <Card style="margin-bottom:16px;">
        <div style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;')}>
          <div>
            <div style={css('font-weight:800;font-size:15px;display:flex;align-items:center;gap:9px;')}>
              Requests from sellers
              {pending.length > 0 && (
                <span style={css('min-width:22px;height:22px;padding:0 7px;border-radius:11px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-size:12px;display:inline-flex;align-items:center;justify-content:center;')}>
                  {pending.length}
                </span>
              )}
            </div>
            <div style={css(`color:${T.muted};font-size:12.5px;margin-top:4px;line-height:1.5;max-width:620px;`)}>
              Their product is already live under the requested name. What you are deciding is whether buyers get a collection tile and a filter chip for it.
            </div>
          </div>
          <GhostButton icon="add" tone="primary" onClick={() => setAdding(true)}>Add a term</GhostButton>
        </div>

        <div style={css('margin-top:16px;')}>
          {loading && <div style={css(`color:${T.muted};font-size:13px;`)}>Loading…</div>}

          {!loading && pending.length === 0 && (
            <EmptyState icon="inbox" title="Nothing waiting" sub="Seller requests for a new category, occasion or fabric land here." />
          )}

          <div style={css('display:flex;flex-direction:column;gap:10px;')}>
            {pending.map((r) => (
              <div
                key={r.id}
                style={css(`display:flex;align-items:center;gap:14px;padding:14px 16px;border:1.5px solid ${T.field};border-radius:14px;background:#FFFDFE;flex-wrap:wrap;`)}
              >
                <span style={css(`width:38px;height:38px;flex:none;border-radius:11px;background:${T.head};display:flex;align-items:center;justify-content:center;`)}>
                  <Icon name={r.kind === 'fabric' ? 'texture' : r.kind === 'occasion' ? 'celebration' : 'checkroom'} size={19} color={T.accent} />
                </span>
                <span style={css('min-width:140px;flex:1;')}>
                  <span style={css('display:block;font-weight:800;font-size:14.5px;')}>{r.name}</span>
                  <span style={css(`display:block;color:${T.muted};font-size:12px;margin-top:2px;`)}>
                    {KIND_LABEL[r.kind]} · {r.boutique?.name ?? 'a seller'} · {fmtDate(r.created_at)}
                  </span>
                </span>
                {r.note && <span style={css(`flex:1;min-width:180px;color:${T.muted};font-size:12.5px;font-style:italic;`)}>“{r.note}”</span>}
                <span style={css('display:flex;gap:8px;')}>
                  <GhostButton icon="close" onClick={() => { setReview(r); setReviewNote(''); }}>Turn down</GhostButton>
                  <GhostButton icon="check" tone="primary" onClick={() => decide(r, 'approved')}>Approve</GhostButton>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── The list ───────────────────────────────────────────────────── */}
      <div style={css('display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;')}>
        <SearchInput value={query} onChange={setQuery} placeholder="Search terms…" />
        <Select
          value={kind}
          onChange={(v) => setKind(v as 'all' | TaxonomyKind)}
          options={[{ value: 'all', label: 'All lists' }, ...KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))]}
        />
      </div>

      <DataTable
        columns={columns}
        rows={live}
        loading={loading}
        getId={(r) => r.id}
        empty={<EmptyState icon="sell" title="No terms yet" sub="Apply migration 0024, or add the first one above." />}
      />

      {/* ── Turn down, with a reason ───────────────────────────────────── */}
      <Drawer
        open={!!review}
        onClose={() => setReview(null)}
        title={review ? `Turn down “${review.name}”` : ''}
        footer={
          <div style={css('display:flex;gap:10px;')}>
            <GhostButton onClick={() => setReview(null)}>Cancel</GhostButton>
            <div style={css('flex:1;')} />
            <GhostButton icon="block" tone="danger" onClick={() => review && decide(review, 'rejected', reviewNote)}>
              {busy ? 'Working…' : 'Turn down'}
            </GhostButton>
          </div>
        }
      >
        <div style={css(`color:${T.muted};font-size:13.5px;line-height:1.6;`)}>
          The seller sees this on their product form, so write it as advice: which existing term should they use instead?
        </div>
        <textarea
          value={reviewNote}
          onChange={(e) => setReviewNote(e.target.value)}
          autoFocus
          placeholder="e.g. Please list this under “Sarees” — we keep fabric detail in the Fabric field."
          style={css(`width:100%;margin-top:14px;min-height:120px;border:1.5px solid ${T.field};border-radius:14px;padding:12px 14px;font-size:13.5px;font-family:inherit;resize:vertical;color:#2A1A20;`)}
        />
      </Drawer>

      {/* ── Add a term directly ────────────────────────────────────────── */}
      <Drawer
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a term"
        footer={
          <div style={css('display:flex;gap:10px;')}>
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
            <div style={css('flex:1;')} />
            <GhostButton icon="check" tone="primary" onClick={doAdd}>{busy ? 'Adding…' : 'Add'}</GhostButton>
          </div>
        }
      >
        <div style={css('display:flex;flex-direction:column;gap:14px;')}>
          <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
            List
            <div style={css('margin-top:6px;')}>
              <Select
                value={draft.kind}
                onChange={(v) => setDraft({ ...draft, kind: v as TaxonomyKind })}
                options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              />
            </div>
          </label>
          <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
            Name
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Dupattas"
              style={css(`width:100%;margin-top:6px;height:48px;border:1.5px solid ${T.field};border-radius:13px;padding:0 14px;font-size:14px;font-weight:600;font-family:inherit;color:#2A1A20;`)}
            />
          </label>
          {draft.kind === 'color' && (
            <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
              Swatch — buyers filter by this dot, so it has to look like the cloth
              <div style={css('display:flex;gap:10px;align-items:center;margin-top:6px;')}>
                <input
                  type="color"
                  value={draft.hex || '#E7719F'}
                  onChange={(e) => setDraft({ ...draft, hex: e.target.value })}
                  style={css(`width:52px;height:48px;border:1.5px solid ${T.field};border-radius:13px;background:#fff;cursor:pointer;padding:4px;`)}
                />
                <input
                  value={draft.hex}
                  onChange={(e) => setDraft({ ...draft, hex: e.target.value })}
                  placeholder="#E7719F"
                  style={css(`flex:1;height:48px;border:1.5px solid ${T.field};border-radius:13px;padding:0 14px;font-size:14px;font-weight:600;font-family:'IBM Plex Mono',monospace;color:#2A1A20;`)}
                />
              </div>
            </label>
          )}
          {(draft.kind === 'category' || draft.kind === 'occasion') && (
            <label style={css('font-size:13px;font-weight:700;color:#7A5C67;')}>
              Icon — a Material Symbols name, optional
              <input
                value={draft.icon}
                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                placeholder="checkroom"
                style={css(`width:100%;margin-top:6px;height:48px;border:1.5px solid ${T.field};border-radius:13px;padding:0 14px;font-size:14px;font-weight:600;font-family:inherit;color:#2A1A20;`)}
              />
            </label>
          )}
        </div>
      </Drawer>

      {/* ── Rename ─────────────────────────────────────────────────────── */}
      <Drawer
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename term"
        footer={
          <div style={css('display:flex;gap:10px;')}>
            <GhostButton onClick={() => setRenaming(null)}>Cancel</GhostButton>
            <div style={css('flex:1;')} />
            <GhostButton icon="check" tone="primary" onClick={doRename}>{busy ? 'Saving…' : 'Save'}</GhostButton>
          </div>
        }
      >
        <div style={css(`color:${T.muted};font-size:13.5px;line-height:1.6;`)}>
          This renames the browsing term only. Products already listed keep the
          old spelling on their record, so rename to correct a typo — not to
          repurpose a term that has stock under it.
        </div>
        <input
          value={renameTo}
          onChange={(e) => setRenameTo(e.target.value)}
          autoFocus
          style={css(`width:100%;margin-top:14px;height:48px;border:1.5px solid ${T.field};border-radius:13px;padding:0 14px;font-size:14px;font-weight:600;font-family:inherit;color:#2A1A20;`)}
        />
      </Drawer>

      <ConfirmDialog
        open={!!retire}
        title={`Remove “${retire?.row.name ?? ''}”?`}
        message={
          retire && retire.uses > 0
            ? `${retire.uses} live ${retire.uses === 1 ? 'product is' : 'products are'} listed under this. They stay on sale and stay searchable, but buyers lose the tile and the filter chip for them.`
            : 'Nothing is listed under this term, so removing it costs nothing.'
        }
        confirmLabel="Remove"
        danger
        busy={busy}
        onCancel={() => setRetire(null)}
        onConfirm={doRetire}
      />
    </div>
  );
}
