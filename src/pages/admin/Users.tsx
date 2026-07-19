import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import {
  DataTable,
  SearchInput,
  Select,
  GhostButton,
  IconButton,
  StatusPill,
  Avatar,
  Pagination,
  Drawer,
  ConfirmDialog,
  Field,
  EmptyState,
  Icon,
  T,
  type Column,
} from '@/components/admin/kit';
import { logAdminAction } from '@/data/activityLog';
import {
  fetchUsers,
  setUserStatus,
  softDeleteUser,
  restoreUser,
  fetchUserDetail,
  usersToCsv,
  createUser,
  type AdminUserRow,
  type CreateUserInput,
} from '@/data/adminUsers';
import { useAsync } from '@/hooks/useAsync';
import { useDebounced } from '@/hooks/useDebounced';
import { css } from '@/lib/css';
import { fmtInr } from '@/lib/tokens';
import { useShop } from '@/state/ShopContext';
import type { Role } from '@/types/database';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [createData, setCreateData] = useState<CreateUserInput>({
    email: '',
    fullName: '',
    phone: '',
    city: '',
    role: 'buyer',
  });

  const q = useMemo(() => ({ page, pageSize: PAGE_SIZE, search, role, status }), [page, search, role, status]);
  const { data, loading, reload } = useAsync(() => fetchUsers(q), [q]);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const changeFilter = (fn: () => void) => {
    fn();
    setPage(0);
  };

  const log = (action: string, entityId: string, meta?: Record<string, unknown>) =>
    logAdminAction({
      actor_id: profile?.id,
      actor_name: profile?.full_name ?? 'Admin',
      action,
      entity_type: 'profile',
      entity_id: entityId,
      meta,
    });

  const toggleBlock = async (user: AdminUserRow) => {
    const next = user.status === 'blocked' ? 'active' : 'blocked';
    try {
      await setUserStatus(user.id, next);
      await log(next === 'blocked' ? 'user.block' : 'user.unblock', user.id, { name: user.full_name });
      showToast(`${user.full_name} ${next === 'blocked' ? 'blocked' : 'unblocked'}`);
      reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Update failed');
    }
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
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async (user: AdminUserRow) => {
    try {
      await restoreUser(user.id);
      await log('user.restore', user.id, { name: user.full_name });
      showToast(`${user.full_name} restored`);
      reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Restore failed');
    }
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

  const doCreate = async () => {
    if (!createData.email.trim() || !createData.fullName.trim()) {
      showToast('Email and name are required');
      return;
    }

    setBusy(true);
    try {
      const result = await createUser(createData);
      await log('user.create', result.userId, { name: createData.fullName, role: createData.role });
      showToast(result.message);
      setCreateOpen(false);
      setCreateData({ email: '', fullName: '', phone: '', city: '', role: 'buyer' });
      reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Creation failed');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminUserRow>[] = [
    {
      key: 'user',
      header: 'USER',
      width: '2.2fr',
      render: (user) => (
        <div style={css('display:flex;align-items:center;gap:10px;min-width:0;')}>
          <Avatar name={user.full_name} tone={user.full_name.charCodeAt(0) % 8} />
          <div style={css('min-width:0;')}>
            <div style={css('font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>
              {user.full_name}
            </div>
            <div style={css(`font-size:11.5px;color:${T.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`)}>
              {user.email ?? user.phone ?? '-'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'ROLE',
      width: '.9fr',
      render: (user) => (
        <span style={css(`font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:${ROLE_PILL[user.role].bg};color:${ROLE_PILL[user.role].fg};`)}>
          {user.role}
        </span>
      ),
    },
    {
      key: 'city',
      header: 'CITY',
      width: '1fr',
      render: (user) => <span style={css('font-size:13px;color:#6B5560;')}>{user.city || '-'}</span>,
    },
    {
      key: 'orders',
      header: 'ORDERS',
      width: '.7fr',
      render: (user) => <span style={css('font-size:13px;color:#6B5560;')}>{user.orders}</span>,
    },
    {
      key: 'spent',
      header: 'SPENT',
      width: '1fr',
      render: (user) => <span style={css(`font-size:13px;font-weight:700;color:${T.accent};`)}>{fmtInr(user.spent)}</span>,
    },
    {
      key: 'status',
      header: 'STATUS',
      width: '1fr',
      render: (user) => <StatusPill status={user.deleted_at ? 'rejected' : user.status} label={user.deleted_at ? 'Deleted' : undefined} />,
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      width: '1.2fr',
      align: 'right',
      render: (user) => (
        <div style={css('display:flex;gap:8px;justify-content:flex-end;')} onClick={(e) => e.stopPropagation()}>
          {user.deleted_at ? (
            <IconButton icon="restore_from_trash" tone="success" title="Restore" onClick={() => doRestore(user)} />
          ) : (
            <>
              <IconButton icon="visibility" title="View" onClick={() => setDetailId(user.id)} />
              <IconButton
                icon={user.status === 'blocked' ? 'lock_open' : 'block'}
                tone={user.status === 'blocked' ? 'success' : 'warn'}
                title={user.status === 'blocked' ? 'Unblock' : 'Block'}
                onClick={() => toggleBlock(user)}
              />
              <IconButton icon="delete" tone="danger" title="Delete" onClick={() => setConfirm({ user })} />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={css('display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;')}>
        <SearchInput
          value={rawSearch}
          onChange={(value) => changeFilter(() => setRawSearch(value))}
          placeholder="Search name, email, phone, city..."
        />
        <Select
          value={role}
          onChange={(value) => changeFilter(() => setRole(value as 'all' | Role))}
          options={[
            { value: 'all', label: 'All roles' },
            { value: 'buyer', label: 'Buyers' },
            { value: 'seller', label: 'Sellers' },
            { value: 'admin', label: 'Admins' },
          ]}
        />
        <Select
          value={status}
          onChange={(value) => changeFilter(() => setStatus(value as typeof status))}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'blocked', label: 'Blocked' },
            { value: 'deleted', label: 'Deleted' },
          ]}
        />
        <GhostButton icon="download" onClick={exportCsv}>Export</GhostButton>
        <GhostButton icon="person_add" tone="primary" onClick={() => setCreateOpen(true)}>Create User</GhostButton>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        getId={(user) => user.id}
        onRowClick={(user) => !user.deleted_at && setDetailId(user.id)}
        empty={<EmptyState icon="group" title="No users found" sub="Try a different search or filter." />}
      />
      {total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}

      <UserDrawer id={detailId} onClose={() => setDetailId(null)} row={rows.find((row) => row.id === detailId) ?? null} />

      <ConfirmDialog
        open={!!confirm}
        title="Remove user?"
        message={`${confirm?.user.full_name} will be soft-deleted. Their orders are kept and the account can be restored later.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />

      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New User"
        footer={(
          <div style={css('display:flex;gap:10px;')}>
            <GhostButton onClick={() => setCreateOpen(false)}>Cancel</GhostButton>
            <button
              type="submit"
              form="admin-create-user-form"
              disabled={busy}
              style={css(`height:42px;border:none;border-radius:12px;padding:0 14px;font-weight:700;font-size:13px;cursor:${busy ? 'not-allowed' : 'pointer'};display:flex;align-items:center;gap:6px;font-family:inherit;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;opacity:${busy ? 0.7 : 1};`)}
            >
              <Icon name="person_add" size={18} />
              {busy ? 'Creating...' : 'Create User'}
            </button>
          </div>
        )}
      >
        <form
          id="admin-create-user-form"
          onSubmit={(e) => {
            e.preventDefault();
            void doCreate();
          }}
          style={css('display:flex;flex-direction:column;gap:14px;')}
        >
          <div>
            <label style={css('display:block;font-weight:700;font-size:12.5px;margin-bottom:6px;color:#6B5560;')}>Full Name *</label>
            <input
              value={createData.fullName}
              onChange={(e) => setCreateData({ ...createData, fullName: e.target.value })}
              placeholder="John Doe"
              style={css('width:100%;border:1.5px solid #F0D8E2;background:#fff;border-radius:12px;padding:10px 14px;font-size:14px;font-family:inherit;')}
            />
          </div>
          <div>
            <label style={css('display:block;font-weight:700;font-size:12.5px;margin-bottom:6px;color:#6B5560;')}>Email *</label>
            <input
              value={createData.email}
              onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
              placeholder="john@example.com"
              type="email"
              style={css('width:100%;border:1.5px solid #F0D8E2;background:#fff;border-radius:12px;padding:10px 14px;font-size:14px;font-family:inherit;')}
            />
          </div>
          <div>
            <label style={css('display:block;font-weight:700;font-size:12.5px;margin-bottom:6px;color:#6B5560;')}>Phone</label>
            <input
              value={createData.phone}
              onChange={(e) => setCreateData({ ...createData, phone: e.target.value })}
              placeholder="+91 98765 43210"
              style={css('width:100%;border:1.5px solid #F0D8E2;background:#fff;border-radius:12px;padding:10px 14px;font-size:14px;font-family:inherit;')}
            />
          </div>
          <div>
            <label style={css('display:block;font-weight:700;font-size:12.5px;margin-bottom:6px;color:#6B5560;')}>City</label>
            <input
              value={createData.city}
              onChange={(e) => setCreateData({ ...createData, city: e.target.value })}
              placeholder="Chennai"
              style={css('width:100%;border:1.5px solid #F0D8E2;background:#fff;border-radius:12px;padding:10px 14px;font-size:14px;font-family:inherit;')}
            />
          </div>
          <div>
            <label style={css('display:block;font-weight:700;font-size:12.5px;margin-bottom:6px;color:#6B5560;')}>Role *</label>
            <select
              value={createData.role}
              onChange={(e) => setCreateData({ ...createData, role: e.target.value as Role })}
              style={css('width:100%;border:1.5px solid #F0D8E2;background:#fff;border-radius:12px;padding:10px 14px;font-size:14px;font-family:inherit;cursor:pointer;')}
            >
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div style={css('background:#FCE0EC;border-left:4px solid #B02454;padding:12px;border-radius:8px;font-size:12px;color:#6B5560;line-height:1.5;')}>
            <strong>Note:</strong> A temporary password will be generated and sent to the email address. The user must change it on first login.
          </div>
        </form>
      </Drawer>
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
            <div style={css(`font-size:12.5px;color:${T.muted};`)}>{row.email ?? row.phone ?? '-'}</div>
          </div>
        </div>
      )}

      {row && (
        <div style={css('background:#fff;border-radius:14px;padding:4px 16px;margin-bottom:16px;')}>
          <Field label="Role" value={row.role} />
          <Field label="Status" value={<StatusPill status={row.deleted_at ? 'rejected' : row.status} label={row.deleted_at ? 'Deleted' : undefined} />} />
          <Field label="City" value={row.city || '-'} />
          <Field label="Address" value={row.address || '-'} />
          <Field label="Joined" value={new Date(row.created_at).toLocaleDateString('en-IN')} />
        </div>
      )}

      <div style={css('display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;')}>
        <Stat label="Orders" value={String(data?.orders.length ?? 0)} />
        <Stat label="Spent" value={fmtInr(data?.totalSpent ?? 0)} />
        <Stat label="Wishlist" value={String(data?.wishlist ?? 0)} />
      </div>

      <div style={css('font-weight:800;font-size:13px;margin-bottom:8px;')}>Order history</div>
      {loading && <div style={css(`color:${T.muted};font-size:13px;`)}>Loading...</div>}
      {!loading && (data?.orders.length ?? 0) === 0 && <EmptyState icon="receipt_long" title="No orders" />}
      <div style={css('display:flex;flex-direction:column;gap:8px;')}>
        {(data?.orders ?? []).map((order) => (
          <div key={order.id} style={css('background:#fff;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;')}>
            <Icon name="receipt_long" size={18} color="#B79AA6" />
            <div style={css('flex:1;min-width:0;')}>
              <div style={css('font-weight:700;font-size:12.5px;')}>{order.order_number}</div>
              <div style={css(`font-size:11px;color:${T.muted};`)}>
                {order.boutique} · {new Date(order.created_at).toLocaleDateString('en-IN')}
              </div>
            </div>
            <div style={css('text-align:right;')}>
              <div style={css('font-weight:800;font-size:12.5px;')}>{fmtInr(order.total)}</div>
              <StatusPill status={order.status} />
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
