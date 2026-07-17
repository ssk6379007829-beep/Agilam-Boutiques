import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { NOTIFS } from '@/data/demo';

const TABS = ['All', 'Orders', 'Messages', 'Updates'];

export function Notifications() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('All');

  const notifs = NOTIFS.filter((n) => tab === 'All' || n.type === tab);

  return (
    <div style={css('min-height:100%;background:#FBF6F2;padding-bottom:20px;')}>
      <div style={css('padding:6px 20px 8px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={() => navigate('/seller/profile')} style={css('width:42px;height:42px;border-radius:12px;border:none;background:#fff;box-shadow:0 6px 18px -12px rgba(107,20,54,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("font-family:'Playfair Display',serif;font-weight:700;font-size:26px;")}>Notifications</div>
      </div>

      <div className="agx-scroll" style={css('display:flex;gap:8px;overflow-x:auto;padding:4px 20px 10px;')}>
        {TABS.map((t) => {
          const on = tab === t;
          return (
            <button key={t} onClick={() => setTab(t)} style={css(`flex:none;padding:7px 15px;border:none;border-radius:999px;font-size:12.5px;font-weight:700;cursor:pointer;background:${on ? '#B02454' : '#fff'};color:${on ? '#fff' : '#6B5560'};`)}>
              {t}
            </button>
          );
        })}
      </div>

      <div style={css('display:flex;flex-direction:column;gap:10px;padding:0 20px;')}>
        {notifs.map((n) => (
          <div key={n.title} style={css(`background:${n.unread ? '#FFF3F8' : '#fff'};border-radius:16px;padding:13px;display:flex;gap:11px;align-items:flex-start;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);`)}>
            <div style={css(`width:40px;height:40px;flex:none;border-radius:12px;background:${n.tint};display:flex;align-items:center;justify-content:center;`)}>
              <span style={css(`font-family:'Material Symbols Outlined';font-size:20px;color:${n.ic};`)}>{n.icon}</span>
            </div>
            <div style={css('flex:1;')}>
              <div style={css('display:flex;justify-content:space-between;align-items:center;')}>
                <span style={css('font-weight:800;font-size:13.5px;')}>{n.title}</span>
                <span style={css('font-size:11px;color:#B79AA6;')}>{n.time}</span>
              </div>
              <div style={css('font-size:12.5px;color:#8A7078;line-height:1.4;margin-top:2px;')}>{n.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
