import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { CHAT_THREAD } from '@/data/demo';
import { useShop } from '@/state/ShopContext';

type Bubble = { me: boolean; text: string; time: string };

/** Conversation view, shared by the buyer and seller chats. */
export function ChatView({ name, backTo }: { name: string; backTo: string }) {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const [thread, setThread] = useState<Bubble[]>(CHAT_THREAD);
  const [draft, setDraft] = useState('');

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    setThread((t) => [...t, { me: true, text, time }]);
    setDraft('');
    showToast('Message sent');
  };

  return (
    <div style={css('min-height:100%;height:100%;background:#FBF6F2;display:flex;flex-direction:column;')}>
      <div style={css('flex:none;background:#fff;padding:8px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #F3DFE8;')}>
        <button onClick={() => navigate(backTo)} style={css('width:38px;height:38px;border-radius:11px;border:none;background:#FBF6F2;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;")}>arrow_back</span>
        </button>
        <div style={css("width:40px;height:40px;border-radius:12px;background:#F4D6E2;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;color:rgba(42,26,32,.55);")}>{name[0]}</div>
        <div style={css('flex:1;')}>
          <div style={css('font-weight:800;font-size:14.5px;')}>{name}</div>
          <div style={css('font-size:12px;color:#2FA36B;font-weight:600;')}>● Online</div>
        </div>
      </div>

      <div className="agx-scroll" style={css('flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;')}>
        <div style={css('align-self:center;background:#F4DDE8;color:#8A7078;font-size:11px;font-weight:700;padding:4px 12px;border-radius:10px;')}>Today</div>
        {thread.map((c, i) => (
          <div
            key={i}
            style={css(`max-width:78%;align-self:${c.me ? 'flex-end' : 'flex-start'};background:${c.me ? '#D6336C' : '#fff'};color:${c.me ? '#fff' : '#2A1A20'};padding:10px 13px;border-radius:${c.me ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};font-size:13.5px;line-height:1.4;box-shadow:0 6px 16px -12px rgba(107,20,54,.5);`)}
          >
            {c.text}
            <div style={css('font-size:10px;opacity:.6;margin-top:3px;text-align:right;')}>{c.time}</div>
          </div>
        ))}
      </div>

      <div style={css('flex:none;background:#fff;padding:10px 14px 16px;display:flex;gap:10px;align-items:center;border-top:1px solid #F3DFE8;')}>
        <div style={css('flex:1;display:flex;align-items:center;gap:8px;background:#FBF6F2;border-radius:14px;padding:0 14px;height:46px;')}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Message…"
            style={css('border:none;background:none;flex:1;font-size:14px;')}
          />
        </div>
        <button onClick={send} style={css('width:46px;height:46px;border-radius:14px;border:none;background:linear-gradient(135deg,#D6336C,#B02454);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#fff;")}>send</span>
        </button>
      </div>
    </div>
  );
}
