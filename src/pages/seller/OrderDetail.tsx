import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrder, updateOrderStatus } from '@/data/orders';
import { getOrCreateConversation } from '@/data/chat';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { fmtInr } from '@/lib/tokens';
import { useToast } from '@/components/ui/Toast';

export function OrderDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { data: order, reload } = useAsync(() => fetchOrder(id), [id]);

  if (!order) return null;
  const currentOrder = order;

  async function openChat() {
    if (!profile) return;
    const conversationId = await getOrCreateConversation(currentOrder.buyer_id, currentOrder.boutique_id);
    navigate(`/seller/chat/${conversationId}`);
  }

  async function setStatus(status: 'shipped' | 'delivered' | 'rejected') {
    await updateOrderStatus(currentOrder.id, status);
    toast(status === 'rejected' ? 'Order rejected' : status === 'shipped' ? 'Marked as shipped' : 'Order accepted');
    reload();
  }

  return (
    <div className="flex min-h-full flex-col bg-rose-card">
      <ScreenHeader
        title={
          <div>
            <div className="text-[22px] leading-none">Order {order.order_number}</div>
            <div className="mt-1 text-xs font-sans font-normal text-rose-muted">
              {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} ·{' '}
              {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        }
        onBack={() => navigate('/seller/orders')}
      />
      <div className="flex-1 px-5">
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <div className="text-xs font-extrabold tracking-wide text-rose-muted">CUSTOMER</div>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-rose-chip font-serif font-bold text-black/50">
              {order.buyer?.full_name?.[0]}
            </div>
            <div className="flex-1">
              <div className="text-sm font-extrabold">{order.buyer?.full_name}</div>
              <div className="text-xs text-rose-muted">
                {order.buyer?.city} · {order.buyer?.phone}
              </div>
            </div>
            <button onClick={openChat} className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border-none bg-rose-chip">
              <Icon name="chat" style={{ color: '#D6336C' }} />
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-3.5 shadow-card">
          <div className="text-xs font-extrabold tracking-wide text-rose-muted">ITEMS</div>
          {order.items?.map((it) => (
            <div key={it.id} className="mt-2 flex items-center gap-2.5">
              <div className="h-14 w-14 flex-none rounded-[13px] bg-rose-chip" />
              <div className="flex-1">
                <div className="text-[13.5px] font-bold">{it.title}</div>
                <div className="text-xs text-rose-muted">
                  {it.size && `Size ${it.size} · `}
                  {it.color && `${it.color} · `}Qty {it.qty}
                </div>
              </div>
              <div className="font-extrabold text-rose-primaryDark">{fmtInr(it.price)}</div>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t border-rose-borderSoft pt-2.5 text-[13px] text-rose-muted">
            <span>Subtotal</span>
            <span className="font-bold text-rose-text">{fmtInr(order.total)}</span>
          </div>
          <div className="mt-1 flex justify-between text-[13px] text-rose-muted">
            <span>Delivery</span>
            <span className="font-bold text-good">Free</span>
          </div>
          <div className="mt-2 flex justify-between text-[15px] font-extrabold">
            <span>Total</span>
            <span className="text-rose-primaryDark">{fmtInr(order.total)}</span>
          </div>
        </div>
      </div>

      {order.status !== 'delivered' && order.status !== 'rejected' && (
        <div className="sticky bottom-0 flex gap-2.5 bg-rose-card px-5 pb-4 pt-3">
          <button onClick={() => setStatus('rejected')} className="h-[52px] flex-1 rounded-2xl border-[1.5px] border-rose-dangerBorder bg-white font-extrabold text-rose-danger">
            Reject
          </button>
          {order.status === 'pending' && (
            <button onClick={() => setStatus('shipped')} className="h-[52px] flex-1 rounded-2xl border-[1.5px] border-rose-primary bg-white font-extrabold text-rose-primaryDark">
              Accept
            </button>
          )}
          <button
            onClick={() => setStatus(order.status === 'pending' ? 'shipped' : 'delivered')}
            className="h-[52px] flex-[1.4] rounded-2xl border-none font-extrabold text-white"
            style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
          >
            {order.status === 'pending' ? 'Mark Shipped' : 'Mark Delivered'}
          </button>
        </div>
      )}
    </div>
  );
}
