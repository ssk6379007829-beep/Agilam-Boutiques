import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { useShop } from '@/state/ShopContext';

const FAQS = [
  'How do I add a new product?',
  'When do I receive payouts?',
  'How does the ₹299 plan work?',
  'How do I get the Verified badge?',
];

export function Help() {
  const navigate = useNavigate();
  const { showToast } = useShop();

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/profile')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:24px;")}>Help &amp; Support</div>
      </div>

      <div style={css('margin:4px 20px 0;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -20px rgba(107,20,54,.6);')}>
        {FAQS.map((q, i) => (
          <div key={q} onClick={() => showToast(q)} style={css(`display:flex;align-items:center;gap:11px;padding:15px 14px;border-bottom:${i === FAQS.length - 1 ? 'none' : '1px solid #F5E4EC'};cursor:pointer;`)}>
            <span style={css("font-family:'Material Symbols Outlined';color:#D6336C;font-size:20px;")}>help</span>
            <span style={css('flex:1;font-weight:700;font-size:13.5px;')}>{q}</span>
            <span style={css("font-family:'Material Symbols Outlined';color:#CBB0BC;")}>expand_more</span>
          </div>
        ))}
      </div>

      <button onClick={() => showToast('Contacting support…')} style={css('margin:16px 20px 0;width:calc(100% - 40px);height:52px;border:none;border-radius:14px;background:linear-gradient(135deg,#D6336C,#B02454);color:#fff;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;')}>
        <span style={css("font-family:'Material Symbols Outlined';")}>support_agent</span>Contact Support
      </button>
    </div>
  );
}
