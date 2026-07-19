import { useMemo, useState } from 'react';
import { css } from '@/lib/css';
import { fmtInr } from '@/lib/tokens';
import { useShop } from '@/state/ShopContext';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useDebounced } from '@/hooks/useDebounced';
import { logAdminAction } from '@/data/activityLog';
import {
  fetchProductsAdmin, setProductStatus, bulkSetProductStatus, setProductFeatured,
  softDeleteProduct, bulkSoftDeleteProducts, restoreProduct,
  type AdminProductRow, type ProductStatus,
} from '@/data/adminProducts';
import {
  DataTable, SearchInput, Select, IconButton, StatusPill, Avatar, Pagination,
  BulkBar, GhostButton, ConfirmDialog, EmptyState, T, type Column,
} from '@/components/admin/kit';

const PAGE_SIZE = 12;
const STATUS_OPTS: { value: ProductStatus; label: string }[] = [
  { value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }, { value: 'hidden', label: 'Hidden' }, { value: 'rejected', label: 'Rejected' },
];

export function ProductsAdmin() {
  const { showToast } = useShop();
  const { profile } = useAuth();
  const [page, setPage] = useState(0);
  const [rawSearch, setRawSearch] = useState('');
  const search = useDebounced(rawSearch, 300);
  const [status, setStatus] = useState<'all' | ProductStatus | 'deleted'>('all');
  const [lowStock, setLowStock] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<AdminProductRow | 'bulk' | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useMemo(() => ({ page, pageSize: PAGE_SIZE, search, status, lowStock }), [page, search, status, lowStock]);
  const { data, loading, reload } = useAsync(() => fetchProductsAdmin(q), [q]);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const changeFilter = (fn: () => void) => { fn(); setPage(0); setSelected(new Set()); };
  const log = (action: string, entity_id: string, meta?: Record<string, unknown>) =>
    logAdminAction({ actor_id: profile?.id, actor_name: profile?.full_name ?? 'Admin', action, entity_type: 'product', entity_id, meta });

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));

  const changeStatus = async (p: AdminProductRow, next: ProductStatus) => {
    try {
      await setProductStatus(p.id, next);
      await log(`product.${next}`, p.id, { title: p.title });
      showToast(`${p.title} → ${next}`);
      reload();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Update failed'); }
  };

  const toggleFeatured = async (p: AdminProductRow) => {
    try {
      await setProductFeatured(p.id, !p.featured);
      await log(p.featured ? 'product.unfeature' : 'product.feature', p.id, { title: p.title });
      showToast(`${p.title} ${p.featured ? 'unfeatured' : 'featured'}`);
      reload();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Update failed'); }
  };

  const bulk = async (next: ProductStatus) => {
    const ids = [...selected];
    try {
      await bulkSetProductStatus(ids, next);
      await log(`product.bulk_${next}`, ids.join(','), { count: ids.length });
      showToast(`${ids.length} products → ${next}`);
      setSelected(new Set());
      reload();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Bulk update failed'); }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      if (confirmDelete === 'bulk') {
        const ids = [...selected];
        await bulkSoftDeleteProducts(ids);
        await log('product.bulk_delete', ids.join(','), { count: ids.length });
        showToast(`${ids.length} products removed`);
        setSelected(new Set());
      } else if (confirmDelete) {
        await softDeleteProduct(confirmDelete.id);
        await log('product.delete', confirmDelete.id, { title: confirmDelete.title });
        showToast(`${confirmDelete.title} removed`);
      }
      setConfirmDelete(null);
      reload();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusy(false); }
  };

  const restore = async (p: AdminProductRow) => {
    try {
      await restoreProduct(p.id);
      await log('product.restore', p.id, { title: p.title });
      showToast(`${p.title} restored`);
      reload();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Restore failed'); }
  };

  const columns: Column<AdminProductRow>[] = [
    {
      key: 'product', header: 'PRODUCT', width: '2.4fr',
      render: (p) => (
        <div style={css('display:flex;align-items:center;gap:10px;min-width:0;')}>
          {p.image_url
            ? <img src={p.image_url} alt="" style={css('width:38px;height:38px;flex:none;border-radius:10px;object-fit:cover;')} />
            : <Avatar name={p.title} tone={p.tone} />}
          <div style={css('min-width:0;')}>
            <div style={css('font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{p.title}{p.featured && ' ⭐'}</div>
            <div style={css(`font-size:11.5px;color:${T.muted};`)}>{p.boutique?.name ?? '—'} · {p.category}</div>
          </div>
        </div>
      ),
    },
    { key: 'price', header: 'PRICE', width: '1fr', render: (p) => <span style={css('font-size:13px;font-weight:700;')}>{fmtInr(p.price)}</span> },
    {
      key: 'stock', header: 'STOCK', width: '.9fr',
      render: (p) => <span style={css(`font-size:13px;font-weight:700;color:${p.stock === 0 ? '#D6455A' : p.stock <= 5 ? '#C99A3F' : '#6B5560'};`)}>{p.stock}</span>,
    },
    { key: 'status', header: 'STATUS', width: '1fr', render: (p) => <StatusPill status={p.deleted_at ? 'rejected' : p.status} label={p.deleted_at ? 'Deleted' : undefined} /> },
    {
      key: 'actions', header: 'ACTIONS', width: '1.9fr', align: 'right',
      render: (p) => (
        <div style={css('display:flex;gap:8px;justify-content:flex-end;align-items:center;')} onClick={(e) => e.stopPropagation()}>
          {p.deleted_at ? (
            <IconButton icon="restore_from_trash" tone="success" title="Restore" onClick={() => restore(p)} />
          ) : (
            <>
              <select value={p.status} onChange={(e) => changeStatus(p, e.target.value as ProductStatus)} style={css(`height:34px;border:1.5px solid ${T.field};border-radius:10px;background:#FBF6F2;font-size:12px;font-weight:700;color:#6B5560;padding:0 6px;cursor:pointer;font-family:inherit;`)}>
                {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <IconButton icon={p.featured ? 'star' : 'star_outline'} tone="warn" title={p.featured ? 'Unfeature' : 'Feature'} onClick={() => toggleFeatured(p)} />
              <IconButton icon="delete" tone="danger" title="Delete" onClick={() => setConfirmDelete(p)} />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={css('display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;')}>
        <SearchInput value={rawSearch} onChange={(v) => changeFilter(() => setRawSearch(v))} placeholder="Search products, categories…" />
        <Select value={status} onChange={(v) => changeFilter(() => setStatus(v as typeof status))} options={[
          { value: 'all', label: 'All statuses' }, ...STATUS_OPTS, { value: 'deleted', label: 'Deleted' },
        ]} />
        <GhostButton icon={lowStock ? 'filter_alt' : 'filter_alt_off'} tone={lowStock ? 'primary' : 'default'} onClick={() => changeFilter(() => setLowStock(!lowStock))}>Low stock</GhostButton>
      </div>

      <BulkBar count={selected.size}>
        <button onClick={() => bulk('active')} style={bulkBtn('#218456')}>Approve</button>
        <button onClick={() => bulk('hidden')} style={bulkBtn('#8A7078')}>Hide</button>
        <button onClick={() => setConfirmDelete('bulk')} style={bulkBtn('#D6455A')}>Delete</button>
      </BulkBar>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        getId={(p) => p.id}
        selectable
        selectedIds={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        empty={<EmptyState icon="local_mall" title="No products found" sub="Try a different search or filter." />}
      />
      {total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete === 'bulk' ? 'Delete selected products?' : 'Delete product?'}
        message={confirmDelete === 'bulk' ? `${selected.size} products will be soft-deleted and hidden from buyers. They can be restored later.` : `${typeof confirmDelete === 'object' && confirmDelete ? confirmDelete.title : ''} will be soft-deleted and hidden from buyers. It can be restored later.`}
        confirmLabel="Delete" danger busy={busy}
        onConfirm={doDelete} onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

const bulkBtn = (bg: string) => css(`border:none;border-radius:9px;padding:8px 14px;font-weight:800;font-size:12.5px;cursor:pointer;color:#fff;background:${bg};display:flex;align-items:center;gap:5px;font-family:inherit;`);
