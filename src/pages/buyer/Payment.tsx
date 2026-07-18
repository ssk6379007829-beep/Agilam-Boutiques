import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';
import { payWithRazorpay } from '@/lib/razorpay';
import { PAY_METHODS, fmt } from '@/data/demo';

export function Payment() {
  const navigate = useNavigate();
  const { payMethod, setPayMethod, subtotal, discount, shipFee, total, guest, placeOrder, showToast } = useShop();
  const [processing, setProcessing] = useState(false);

  const isOnline = payMethod !== 'cod';

  const onPlaceOrder = async () => {
    if (total < 1) {
      showToast('Your bag is empty');
      return;
    }

    setProcessing(true);
    try {
      // Cash on Delivery skips the gateway; online pays first, then we record
      // the order server-side with the verified payment.
      const payment = isOnline
        ? await payWithRazorpay({
            amountPaise: Math.round(total * 100),
            name: 'Agilam Boutiques',
            description: 'Order payment',
            prefill: { name: guest.name, contact: guest.phone },
          })
        : null;

      await placeOrder(
        payment
          ? {
              razorpay_order_id: payment.orderId,
              razorpay_payment_id: payment.paymentId,
              razorpay_signature: payment.signature,
            }
          : null,
      );
      navigate('/buyer/order-confirmation');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('max-width:980px;margin:0 auto;')}>
        <div style={css('padding:4px 0 2px;')}>
          <div className="agx-eyebrow" style={css('font-size:10.5px;color:#B02454;')}>Step 3 of 3 · Payment</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(28px,3vw,40px);line-height:1.05;margin-top:4px;")}>How would you like to pay?</div>
        </div>

        <div className="agx-cart-grid" style={css('display:grid;gap:22px;align-items:start;margin-top:18px;')}>
          <div style={css('display:flex;flex-direction:column;gap:12px;')}>
            {PAY_METHODS.map((m) => {
              const on = payMethod === m.key;
              return (
                <div
                  key={m.key}
                  onClick={() => setPayMethod(m.key)}
                  style={css(`display:flex;align-items:center;gap:13px;padding:15px 16px;border-radius:16px;cursor:pointer;border:1.5px solid ${on ? '#D6336C' : '#F0D8E2'};background:${on ? '#FCE0EC' : '#fff'};`)}
                >
                  <span style={css(`width:46px;height:46px;flex:none;border-radius:13px;background:${on ? '#D6336C' : '#FCE0EC'};display:flex;align-items:center;justify-content:center;`)}>
                    <span style={css(`font-family:'Material Symbols Outlined';color:${on ? '#fff' : '#D6336C'};`)}>{m.icon}</span>
                  </span>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('font-weight:800;font-size:14.5px;')}>{m.label}</div>
                    <div style={css('color:#8A7078;font-size:12.5px;margin-top:2px;')}>{m.sub}</div>
                  </div>
                  <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;")}>{on ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
                </div>
              );
            })}
            <div style={css('display:flex;align-items:center;gap:9px;margin-top:6px;color:#8A7078;font-size:12.5px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:18px;color:#2FA36B;")}>lock</span>100% secure payments · encrypted end-to-end
            </div>
          </div>

          <div className="agx-cart-sticky" style={css('background:#fff;border:1px solid #F2E4EA;border-radius:22px;padding:20px;box-shadow:0 20px 44px -30px rgba(107,20,54,.55);position:sticky;top:80px;')}>
            <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>Order total</div>
            <div style={css('display:flex;flex-direction:column;gap:11px;margin-top:16px;font-size:14px;')}>
              <div style={css('display:flex;justify-content:space-between;color:#5C4650;')}><span>Subtotal</span><span style={css('font-weight:700;')}>{fmt(subtotal)}</span></div>
              {discount > 0 && (
                <div style={css('display:flex;justify-content:space-between;color:#2FA36B;')}><span>Discount</span><span style={css('font-weight:800;')}>– {fmt(discount)}</span></div>
              )}
              <div style={css('display:flex;justify-content:space-between;color:#5C4650;')}><span>Delivery</span><span style={css('font-weight:800;color:#2FA36B;')}>{shipFee === 0 ? 'FREE' : fmt(shipFee)}</span></div>
            </div>
            <div style={css('height:1px;background:#F0E2E9;margin:16px 0;')} />
            <div style={css('display:flex;justify-content:space-between;align-items:baseline;')}>
              <span style={css('font-weight:800;')}>To pay</span>
              <span style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:26px;")}>{fmt(total)}</span>
            </div>
            <button onClick={onPlaceOrder} disabled={processing} style={css(`width:100%;height:54px;margin-top:18px;border:none;border-radius:15px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:15px;cursor:${processing ? 'wait' : 'pointer'};opacity:${processing ? '.7' : '1'};display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 16px 34px -16px rgba(214,51,108,.85);`)}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>lock</span>
              {processing ? 'Processing…' : isOnline ? `Pay ${fmt(total)}` : 'Place order'}
            </button>
            <button onClick={() => navigate('/buyer/checkout')} style={css('width:100%;height:44px;margin-top:9px;border:none;background:none;cursor:pointer;color:#8A7078;font-weight:800;font-size:13px;')}>Back to delivery</button>
          </div>
        </div>
      </div>
    </div>
  );
}
