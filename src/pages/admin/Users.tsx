import { useMemo, useState } from 'react';
import { css } from '@/lib/css';
import { fmtInr } from '@/lib/tokens';
import { useShop } from '@/state/ShopContext';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useDebounced } from '@/hooks/useDebounced';
import { logAdminAction } from '@/data/activityLog';
import {
  fetchUsers, setUserStatus, softDeleteUser, restoreUser, fetchUserDetail, usersToCsv,
  type AdminUserRow,
} from '@/data/adminUsers';
import type { Role } from '@/types/database';
import {
  DataTable, SearchInput, Select, GhostButton, IconButton, StatusPill, Avatar, Pagination,
  Drawer, ConfirmDialog, Field, EmptyState, Icon, T, type Column,
} from '@/components/admin/kit';

const PAGE_SIZE = 12;
const ROLE_PILL: Record<Role, { bg: string; fg: string }> = {
  buyer: { bg: '#E6F0FA', fg: '#3A6EA5' },
  seller: { bg: '#F3EAF5', fg: '#9B7FC7' },
  admin: { bg: '#FCE0EC', fg: '#D6336C' },
};

export function Users() {
  const { showToast } = useShop();
  const { profile } = useAuth();
  const [page, setPage] = useState(0);
  const [rawSearch, setRawSearch] = useState('');
  const search = useDebounced(rawSearch, 300);
  const [role, setRole] = useState<'all' | Role>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'blocked' | 'deleted'>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ user: AdminUserRow } | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset to first page whenever a filter changes.
  const q = useMemo(() => ({ page, pageSize: PAGE_SIZE, search, role, status }), [page, search, role, status]);
  const { data, loading, reload } = useAsync(() => fetchUsers(q), [q]);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const changeFilter = (fn: () => void) => { fn(); setPage(0); };
  const log = (action: string, entity_id: string, meta?: Record<string, unknown>) =>
    logAdminAction({ actor_id: profile?.id, actor_name: profile?.full_name ?? 'Admin', action, entity_type: 'profile', entity_id, meta });

  const toggleBlock = async (u: AdminUserRow) => {
    const next = u.status === 'blocked' ? 'active' : 'blocked';
    try {
      await setUserStatus(u.id, next);
      await log(next === 'blocked' ? 'user.block' : 'user.unblock', u.id, { name: u.full_name });
      showToast(`${u.full_name} ${next === 'blocked' ? 'blocked' : 'unblocked'}`);
      reload();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Update failed'); }
  };

  const doDelete = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await softDeleteUser(confirm.user.id);
      await log('user.delete', confirm.user.id, { name: confirm.user.full_name });
      showToast(`${confirm.user.full_name} removed`);
      setConfirm(null);
      reload();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusy(false); }
  };

  const doRestore = async (u: AdminUserRow) => {
    try {
      await restoreUser(u.id);
      await log('user.restore', u.id, { name: u.full_name });
      showToast(`${u.full_name} restored`);
      reload();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Restore failed'); }
  };

  const exportCsv = () => {
    const csv = usersToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agilam-users-page-${page + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported current page to CSV');
  };

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'user', header: 'USER', width: '2.2fr',
      render: (u) => (
        <div style={css('display:flex;align-items:center;gap:10px;min-width:0;')}>
          <Avatar name={u.full_name} tone={u.full_name.charCodeAt(0) % 8} />
          <div style={css('min-width:0;')}>
            <div style={css('font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{u.full_name}</div>
            <div style={css(`font-size:11.5px;color:${T.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`)}>{u.email ?? u.phone ?? '—'}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'ROLE', width: '.9fr', render: (u) => <span style={css(`font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:${ROLE_PILL[u.role].bg};color:${ROLE_PILL[u.role].fg};`)}>{u.role}</span> },
    { key: 'city', header: 'CITY', width: '1fr', render: (u) => <span style={css(`font-size:13px;color:#6B5560;`)}>{u.city || '—'}</span> },
    { key: 'orders', header: 'ORDERS', width: '.7fr', render: (u) => <span style={css('font-size:13px;color:#6B5560;')}>{u.orders}</span> },
    { key: 'spent', header: 'SPENT', width: '1fr', render: (u) => <span style={css(`font-size:13px;font-weight:700;color:${T.accent};`)}>{fmtInr(u.spent)}</span> },
    { key: 'status', header: 'STATUS', width: '1fr', render: (u) => <StatusPill status={u.deleted_at ? 'rejected' : u.status} label={u.deleted_at ? 'Deleted' : undefined} /> },
    {
      key: 'actions', header: 'ACTIONS', width: '1.2fr', align: 'right',
      render: (u) => (
        <div style={css('display:flex;gap:8px;justify-content:flex-end;')} onClick={(e) => e.stopPropagation()}>
          {u.deleted_at ? (
            <IconButton icon="restore_from_trash" tone="success" title="Restore" onClick={() => doRestore(u)} />
          ) : (
            <>
              <IconButton icon="visibility" title="View" onClick={() => setDetailId(u.id)} />
              <IconButton icon={u.status === 'blocked' ? 'lock_open' : 'block'} tone={u.status === 'blocked' ? 'success' : 'warn'} title={u.status === 'blocked' ? 'Unblock' : 'Block'} onClick={() => toggleBlock(u)} />
              <IconButton icon="delete" tone="danger" title="Delete" onClick={() => setConfirm({ user: u })} />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={css('display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;')}>
        <SearchInput value={rawSearch} onChange={(v) => changeFilter(() => setRawSearch(v))} placeholder="Search name, email, phone, city…" />
        <Select value={role} onChange={(v) => changeFilter(() => setRole(v as 'all' | Role))} options={[
          { value: 'all', label: 'All roles' }, { value: 'buyer', label: 'Buyers' }, { value: 'seller', label: 'Sellers' }, { value: 'admin', label: 'Admins' },
        ]} />
        <Select value={status} onChange={(v) => changeFilter(() => setStatus(v as typeof status))} options={[
          { value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }, { value: 'deleted', label: 'Deleted' },
        ]} />
        <GhostButton icon="download" onClick={exportCsv}>Export</GhostButton>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        getId={(u) => u.id}
        onRowClick={(u) => !u.deleted_at && setDetailId(u.id)}
        empty={<EmptyState icon="group" title="No users found" sub="Try a different search or filter." />}
      />
      {total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}

      <UserDrawer id={detailId} onClose={() => setDetailId(null)} row={rows.find((r) => r.id === detailId) ?? null} />

      <ConfirmDialog
        open={!!confirm}
        title="Remove user?"
        message={`${confirm?.user.full_name} will be soft-deleted. Their orders are kept and the account can be restored later.`}
        confirmLabel="Delete" danger busy={busy}
        onConfirm={doDelete} onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function UserDrawer({ id, row, onClose }: { id: string | null; row: AdminUserRow | null; onClose: () => void }) {
  const { data, loading } = useAsync(() => (id ? fetchUserDetail(id) : Promise.resolve(null)), [id]);
  return (
    <Drawer open={!!id} onClose={onClose} title={row?.full_name ?? 'User'}>
      {row && (
        <div style={css('display:flex;align-items:center;gap:12px;margin-bottom:16px;')}>
          <Avatar name={row.full_name} tone={row.full_name.charCodeAt(0) % 8} />
          <div>
            <div style={css('font-weight:800;font-size:15px;')}>{row.full_name}</div>
            <div style={css(`font-size:12.5px;color:${T.muted};`)}>{row.email ?? row.phone ?? '—'}</div>
          </div>
        </div>
      )}
      {row && (
        <div style={css('background:#fff;border-radius:14px;padding:4px 16px;margin-bottom:16px;')}>
          <Field label="Role" value={row.role} />
          <Field label="Status" value={<StatusPill status={row.deleted_at ? 'rejected' : row.status} label={row.deleted_at ? 'Deleted' : undefined} />} />
          <Field label="City" value={row.city || '—'} />
          <Field label="Address" value={row.address || '—'} />
          <Field label="Joined" value={new Date(row.created_at).toLocaleDateString('en-IN')} />
        </div>
      )}

      <div style={css('display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;')}>
        <Stat label="Orders" value={String(data?.orders.length ?? 0)} />
        <Stat label="Spent" value={fmtInr(data?.totalSpent ?? 0)} />
        <Stat label="Wishlist" value={String(data?.wishlist ?? 0)} />
      </div>

      <div style={css('font-weight:800;font-size:13px;margin-bottom:8px;')}>Order history</div>
      {loading && <div style={css(`color:${T.muted};font-size:13px;`)}>Loading…</div>}
      {!loading && (data?.orders.length ?? 0) === 0 && <EmptyState icon="receipt_long" title="No orders" />}
      <div style={css('display:flex;flex-direction:column;gap:8px;')}>
        {(data?.orders ?? []).map((o) => (
          <div key={o.id} style={css('background:#fff;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;')}>
            <Icon name="receipt_long" size={18} color="#B79AA6" />
            <div style={css('flex:1;min-width:0;')}>
              <div style={css('font-weight:700;font-size:12.5px;')}>{o.order_number}</div>
              <div style={css(`font-size:11px;color:${T.muted};`)}>{o.boutique} · {new Date(o.created_at).toLocaleDateString('en-IN')}</div>
            </div>
            <div style={css('text-align:right;')}>
              <div style={css('font-weight:800;font-size:12.5px;')}>{fmtInr(o.total)}</div>
              <StatusPill status={o.status} />
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={css('background:#fff;border-radius:12px;padding:12px;text-align:center;')}>
      <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:18px;line-height:1;")}>{value}</div>
      <div style={css(`font-size:11px;color:${T.muted};margin-top:3px;`)}>{label}</div>
    </div>
  );
}
