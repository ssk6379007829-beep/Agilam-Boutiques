import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';

const PLAN_FEATURES = [
  'Unlimited product listings',
  'Direct customer chat + WhatsApp',
  'Order & inventory management',
  'Monthly earnings reports',
];

export function Subscription() {
  const navigate = useNavigate();
  const { showToast } = useShop();

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/profile')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>Subscription</div>
      </div>

      <div style={css('margin:4px 20px 0;background:#fff;border-radius:20px;padding:18px;box-shadow:0 14px 34px -24px rgba(107,20,54,.7);')}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
          <div style={css('font-weight:800;font-size:15px;')}>Boutique Plan</div>
          <span style={css('background:#E5F3EC;color:#2FA36B;font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;')}>ACTIVE</span>
        </div>
        <div style={css('display:flex;align-items:baseline;gap:4px;margin-top:10px;')}>
          <span style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:40px;")}>₹299</span>
          <span style={css('color:#8A7078;font-weight:700;')}>/ account</span>
        </div>
        <div style={css('font-size:13px;color:#8A7078;margin-top:2px;')}>Renews 1 Aug 2026</div>
        <div style={css('display:flex;flex-direction:column;gap:9px;margin-top:14px;')}>
          {PLAN_FEATURES.map((fe) => (
            <div key={fe} style={css('display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600;color:#4B3840;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:19px;color:#2FA36B;")}>check_circle</span>{fe}
            </div>
          ))}
        </div>
      </div>

      <div style={css('margin:14px 20px 0;background:linear-gradient(150deg,#C99A3F,#9E7524);border-radius:20px;padding:18px;color:#fff;box-shadow:0 16px 36px -22px rgba(158,117,36,.9);')}>
        <div style={css('display:flex;align-items:center;gap:8px;')}>
          <span style={css("font-family:'Material Symbols Outlined';")}>workspace_premium</span>
          <span style={css('font-weight:800;font-size:15px;')}>Upgrade to Featured</span>
        </div>
        <div style={css('font-size:13px;opacity:.92;margin-top:6px;line-height:1.5;')}>
          Get a gold badge, priority placement in search and a spot on the Home hero carousel.
        </div>
        <button onClick={() => showToast('Upgrade coming soon')} style={css('margin-top:14px;background:#fff;color:#8A6420;border:none;border-radius:12px;padding:11px 18px;font-weight:800;font-size:14px;cursor:pointer;')}>
          Upgrade · ₹799/mo
        </button>
      </div>
    </div>
  );
}
