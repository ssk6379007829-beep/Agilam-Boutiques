import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';

export function OrderConfirmation() {
  const navigate = useNavigate();
  const { lastOrderId } = useShop();

  // The design tracks the previous order (#AGL-2481), which is the one that has
  // live tracking stages attached.
  const goTrack = () => navigate('/buyer/orders/%23AGL-2481/track');

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('max-width:560px;margin:0 auto;text-align:center;padding-top:20px;')}>
        <div style={css('width:96px;height:96px;margin:0 auto;border-radius:30px;background:linear-gradient(135deg,#2FA36B,#1E8455);display:flex;align-items:center;justify-content:center;box-shadow:0 22px 44px -20px rgba(47,163,107,.7);')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:56px;color:#fff;")}>check</span>
        </div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:34px;line-height:1.05;margin-top:22px;")}>Order confirmed!</div>
        <div style={css('color:#5C4650;font-size:15px;margin-top:8px;line-height:1.55;')}>Thank you, Priya. Your boutique has been notified and will start preparing your order.</div>

        <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:18px;margin-top:22px;box-shadow:0 16px 36px -28px rgba(107,20,54,.5);display:flex;align-items:center;justify-content:space-between;')}>
          <div style={css('text-align:left;')}>
            <div className="agx-eyebrow" style={css('font-size:9.5px;color:#8A7078;')}>Order ID</div>
            <div style={css("font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:19px;color:#B02454;margin-top:3px;")}>{lastOrderId}</div>
          </div>
          <span style={css('width:52px;height:52px;border-radius:15px;background:#FCE0EC;display:flex;align-items:center;justify-content:center;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:26px;")}>shopping_bag</span>
          </span>
        </div>

        <div style={css('background:#fff;border:1px solid #F2E4EA;border-radius:20px;padding:6px 16px;margin-top:14px;box-shadow:0 16px 36px -28px rgba(107,20,54,.5);text-align:left;')}>
          <div style={css('display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #F5E4EC;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#2FA36B;")}>sms</span>
            <div style={css('flex:1;')}>
              <div style={css('font-weight:800;font-size:13.5px;')}>SMS confirmation sent</div>
              <div style={css('color:#8A7078;font-size:12px;')}>to +91 98765 43210</div>
            </div>
            <span style={css("font-family:'Material Symbols Outlined';color:#2FA36B;font-size:20px;")}>check_circle</span>
          </div>
          <div style={css('display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #F5E4EC;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#25B04A;")}>chat</span>
            <div style={css('flex:1;')}>
              <div style={css('font-weight:800;font-size:13.5px;')}>WhatsApp updates enabled</div>
              <div style={css('color:#8A7078;font-size:12px;')}>Live order status on WhatsApp</div>
            </div>
            <span style={css("font-family:'Material Symbols Outlined';color:#2FA36B;font-size:20px;")}>check_circle</span>
          </div>
          <div style={css('display:flex;align-items:center;gap:12px;padding:13px 0;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#8A7078;")}>mail</span>
            <div style={css('flex:1;')}>
              <div style={css('font-weight:800;font-size:13.5px;')}>Email receipt</div>
              <div style={css('color:#8A7078;font-size:12px;')}>Optional · add an email in profile</div>
            </div>
            <span style={css("font-family:'Material Symbols Outlined';color:#CBB0BC;font-size:20px;")}>radio_button_unchecked</span>
          </div>
        </div>

        <div style={css('display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;')}>
          <button onClick={goTrack} style={css('flex:1;min-width:150px;height:54px;border:none;border-radius:15px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;font-size:14.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 16px 34px -16px rgba(214,51,108,.85);')}>
            <span style={css("font-family:'Material Symbols Outlined';font-size:20px;")}>pin_drop</span>Track order
          </button>
          <button onClick={() => navigate('/buyer/home')} style={css('flex:1;min-width:150px;height:54px;border:1.5px solid #F0D8E2;background:#fff;color:#B02454;border-radius:15px;font-weight:800;font-size:14.5px;cursor:pointer;')}>Continue shopping</button>
        </div>
      </div>
    </div>
  );
}
