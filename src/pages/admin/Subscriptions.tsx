import { css } from '@/lib/css';
import { SUBSCRIPTIONS } from '@/data/adminDemo';

const GRID = 'display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr;';

export function Subscriptions() {
  return (
    <div>
      <div style={css('display:grid;grid-template-columns:repeat(3,1fr);gap:16px;')}>
        <div style={css('background:#fff;border-radius:18px;padding:20px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
          <div style={css('color:#8A7078;font-size:13px;font-weight:700;')}>Active subscriptions</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:34px;")}>218</div>
          <div style={css('font-size:12px;color:#218456;font-weight:700;')}>₹65,182 / mo recurring</div>
        </div>
        <div style={css('background:#fff;border-radius:18px;padding:20px;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);')}>
          <div style={css('color:#8A7078;font-size:13px;font-weight:700;')}>Commission rate</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:34px;")}>8%</div>
          <div style={css('font-size:12px;color:#8A7078;font-weight:700;')}>per completed order</div>
        </div>
        <div style={css('background:linear-gradient(150deg,#C99A3F,#9E7524);color:#fff;border-radius:18px;padding:20px;box-shadow:0 16px 36px -26px rgba(158,117,36,.9);')}>
          <div style={css('font-size:13px;font-weight:700;opacity:.9;')}>Featured upgrades</div>
          <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:34px;")}>37</div>
          <div style={css('font-size:12px;font-weight:700;opacity:.9;')}>₹799 / mo each</div>
        </div>
      </div>

      <div style={css('background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(107,20,54,.6);margin-top:16px;')}>
        <div style={css(`${GRID}padding:14px 20px;background:#F7EAF0;font-size:12px;font-weight:800;color:#8A7078;`)}>
          <span>BOUTIQUE</span><span>PLAN</span><span>RENEWAL</span><span>STATUS</span>
        </div>
        {SUBSCRIPTIONS.map((su) => (
          <div key={su.name} style={css(`${GRID}padding:14px 20px;align-items:center;border-top:1px solid #F5E4EC;`)}>
            <span style={css('font-weight:700;font-size:13.5px;')}>{su.name}</span>
            <span style={css('font-size:13px;color:#6B5560;')}>{su.plan}</span>
            <span style={css('font-size:13px;color:#6B5560;')}>{su.renewal}</span>
            <span><span style={css(`font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:${su.bg};color:${su.fg};`)}>{su.status}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
