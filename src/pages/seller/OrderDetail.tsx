import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { TONES, fmt } from '@/data/demo';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrder, updateOrderStatus } from '@/data/orders';
import { toOrderView } from '@/lib/orderView';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { buildWhatsAppLink, buildBillShareCaption } from '@/lib/whatsapp';
import { shareOrDownloadBillImage, openPendingWhatsAppTab } from '@/lib/billImage';
import { BillReceipt } from '@/components/seller/BillReceipt';

export function OrderDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showToast } = useShop();

  const { boutique } = useMyBoutique();
  const orderId = decodeURIComponent(id ?? '');
  const { data: row, loading, reload } = useAsync(() => (orderId ? fetchOrder(orderId) : Promise.resolve(null)), [orderId]);
  const [sharing, setSharing] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!row) {
    return (
      <div style={css('min-height:60vh;display:flex;align-items:center;justify-content:center;color:#8A7078;font-size:15px;')}>
        {loading ? 'Loading order…' : 'Order not found.'}
      </div>
    );
  }

  const o = toOrderView(row);
  const subtotal = o.amount;

  const setStatus = async (status: 'shipped' | 'delivered' | 'rejected', msg: string) => {
    try {
      await updateOrderStatus(o.id, status);
      showToast(msg);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const shareBillImage = async () => {
    if (!o.phone) {
      showToast('No phone number on this order');
      return;
    }
    if (!receiptRef.current) return;
    // Must open synchronously, still inside this click's user gesture — the
    // bill render below is async, and a window.open() issued after an await
    // gets silently blocked by the browser's popup blocker on most desktop
    // browsers, which is why this button could look like it does nothing.
    const pendingTab = openPendingWhatsAppTab();
    setSharing(true);
    try {
      const caption = buildBillShareCaption({
        boutiqueName: boutique?.name ?? 'Agilam Boutique',
        boutiqueSlug: boutique?.slug,
        buyerName: o.customer,
        billNumber: o.number,
        total: o.amount,
      });
      const result = await shareOrDownloadBillImage(receiptRef.current, `Bill-${o.number.replace('#', '')}.png`, caption);
      if (result === 'downloaded') {
        showToast('Bill image saved — attach it in the WhatsApp chat that just opened');
        if (pendingTab) pendingTab.location.href = buildWhatsAppLink(o.phone, caption);
      } else {
        pendingTab?.close();
        if (result === 'shared') showToast('Bill shared');
      }
    } catch (e) {
      pendingTab?.close();
      showToast(e instanceof Error ? e.message : 'Could not generate the bill image');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;display:flex;flex-direction:column;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/orders')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:22px;line-height:1;")}>Order {o.number}</div>
          <div style={css('font-size:12px;color:#8A7078;')}>Placed {o.date} · {o.status}</div>
        </div>
      </div>

      <div style={css('flex:1;padding:4px 20px 0;')}>
        <div style={css('background:#fff;border-radius:16px;padding:14px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
          <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.05em;')}>CUSTOMER</div>
          <div style={css('display:flex;align-items:center;gap:11px;margin-top:8px;')}>
            <div style={css("width:44px;height:44px;border-radius:13px;background:#F4D6E2;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.5);")}>{o.customer[0]}</div>
            <div style={css('flex:1;')}>
              <div style={css('font-weight:800;font-size:14px;')}>{o.customer}</div>
              <div style={css('font-size:12px;color:#8A7078;display:flex;align-items:center;gap:5px;flex-wrap:wrap;')}>
                <span>{o.city || 'Customer'}</span>
                {o.phone && (
                  <>
                    <span>·</span>
                    <a
                      href={buildWhatsAppLink(o.phone, '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={css('display:inline-flex;align-items:center;gap:3px;color:#2FA36B;font-weight:700;text-decoration:none;')}
                    >
                      {o.phone}
                      <span style={css("font-family:'Material Symbols Outlined';font-size:14px;")}>open_in_new</span>
                    </a>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => navigate('/seller/messages')} style={css('width:38px;height:38px;border-radius:11px;border:none;background:#FCE0EC;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
              <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;")}>chat</span>
            </button>
          </div>
          <button onClick={shareBillImage} disabled={sharing} style={css(`width:100%;margin-top:12px;height:44px;border:none;border-radius:13px;background:linear-gradient(135deg,#2FA36B,#1E8A57);color:#fff;font-weight:800;font-size:13.5px;cursor:${sharing ? 'default' : 'pointer'};opacity:${sharing ? 0.7 : 1};display:flex;align-items:center;justify-content:center;gap:7px;`)}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>share</span>{sharing ? 'Preparing…' : 'Share bill via WhatsApp'}
          </button>
        </div>

        {/* Hidden premium bill card, captured to an image on demand — never shown
            to the seller directly. Kept within normal viewport coordinates
            (opacity 0, not translated far off-screen) because html2canvas can
            fail to capture elements positioned way outside the viewport. */}
        <div style={css('position:absolute;top:0;left:0;opacity:0;pointer-events:none;z-index:-1;')} aria-hidden="true">
          <BillReceipt
            ref={receiptRef}
            boutiqueName={boutique?.name ?? 'Agilam Boutique'}
            boutiquePhone={boutique?.phone}
            billNumber={o.number}
            date={o.date}
            buyerName={o.customer}
            buyerPhone={o.phone ?? undefined}
            items={o.items.map((it) => ({ title: it.title, qty: it.qty, price: Number(it.price) }))}
            total={o.amount}
          />
        </div>

        <div style={css('background:#fff;border-radius:16px;padding:14px;margin-top:12px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
          <div style={css('font-size:12px;font-weight:800;color:#8A7078;letter-spacing:.05em;')}>ITEM</div>
          <div style={css('display:flex;gap:11px;align-items:center;margin-top:8px;')}>
            <div style={css(`width:56px;height:56px;flex:none;border-radius:13px;background:${TONES[o.tone]};position:relative;overflow:hidden;`)}>
              <div style={css('position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.3) 0 1px,transparent 1px 12px);')} />
            </div>
            <div style={css('flex:1;')}>
              <div style={css('font-weight:700;font-size:13.5px;')}>{o.item}</div>
              <div style={css('font-size:12px;color:#8A7078;')}>Size {o.size ?? 'Free'} · {o.color ?? '—'} · Qty {o.qty}</div>
            </div>
            <div style={css('font-weight:800;color:#B02454;')}>{fmt(o.amount)}</div>
          </div>
          <div style={css('border-top:1px solid #F5E4EC;margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;font-size:13px;color:#8A7078;')}>
            <span>Subtotal</span><span style={css('font-weight:700;color:#2A1A20;')}>{fmt(subtotal)}</span>
          </div>
          <div style={css('display:flex;justify-content:space-between;font-size:13px;color:#8A7078;margin-top:4px;')}>
            <span>Delivery</span><span style={css('font-weight:700;color:#2FA36B;')}>Free</span>
          </div>
          <div style={css('display:flex;justify-content:space-between;margin-top:8px;font-weight:800;font-size:15px;')}>
            <span>Total</span><span style={css('color:#B02454;')}>{fmt(subtotal)}</span>
          </div>
        </div>
      </div>

      <div style={css('position:sticky;bottom:0;background:#FBF6F2;padding:12px 20px 16px;display:flex;gap:10px;')}>
        <button onClick={() => setStatus('rejected', 'Order rejected')} style={css('flex:1;height:52px;border:1.5px solid #E7A7B4;background:#fff;color:#D6455A;border-radius:14px;font-weight:800;cursor:pointer;')}>Reject</button>
        <button onClick={() => setStatus('delivered', 'Marked delivered')} style={css('flex:1;height:52px;border:1.5px solid #D6336C;background:#fff;color:#B02454;border-radius:14px;font-weight:800;cursor:pointer;')}>Delivered</button>
        <button onClick={() => setStatus('shipped', 'Marked as shipped')} style={css('flex:1.4;height:52px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;cursor:pointer;')}>Mark Shipped</button>
      </div>
    </div>
  );
}
