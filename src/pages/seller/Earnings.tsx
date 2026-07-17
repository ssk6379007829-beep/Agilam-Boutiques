import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';

const REVENUE_BARS = [
  { d: 'M', h: '46%' }, { d: 'T', h: '62%' }, { d: 'W', h: '38%' }, { d: 'T', h: '78%' },
  { d: 'F', h: '92%' }, { d: 'S', h: '70%' }, { d: 'S', h: '54%' },
];

export function Earnings() {
  const navigate = useNavigate();

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/profile')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>Earnings</div>
      </div>

      <div style={css('margin:4px 20px 0;border-radius:20px;background:linear-gradient(150deg,#D6336C,#B02454);color:#fff;padding:20px;box-shadow:0 18px 40px -22px rgba(176,36,84,.9);')}>
        <div style={css('font-size:13px;opacity:.85;')}>Total revenue · This month</div>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:42px;line-height:1;margin-top:4px;")}>₹1,84,700</div>
        <div style={css('display:flex;gap:6px;align-items:center;margin-top:8px;font-size:13px;')}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>trending_up</span>+18% vs last month
        </div>
      </div>

      <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 20px 0;')}>
        <div style={css('background:#fff;border-radius:16px;padding:14px;box-shadow:0 12px 28px -22px rgba(107,20,54,.6);')}>
          <div style={css('font-size:12px;color:#8A7078;font-weight:700;')}>Orders paid</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>42</div>
        </div>
        <div style={css('background:#fff;border-radius:16px;padding:14px;box-shadow:0 12px 28px -22px rgba(107,20,54,.6);')}>
          <div style={css('font-size:12px;color:#8A7078;font-weight:700;')}>Pending payout</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;color:#C99A3F;")}>₹23,400</div>
        </div>
      </div>

      <div style={css("padding:20px 20px 10px;font-family:'Playfair Display',serif;font-weight:700;font-size:20px;")}>Weekly revenue</div>
      <div style={css('margin:0 20px;background:#fff;border-radius:18px;padding:18px 16px;box-shadow:0 12px 28px -22px rgba(107,20,54,.6);display:flex;align-items:flex-end;gap:10px;height:150px;')}>
        {REVENUE_BARS.map((b, i) => (
          <div key={i} style={css('flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;justify-content:flex-end;height:100%;')}>
            <div style={css(`width:100%;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,#E7719F,#D6336C);height:${b.h};`)} />
            <span style={css('font-size:10.5px;color:#B79AA6;font-weight:700;')}>{b.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
