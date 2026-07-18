import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { CHAT_THREAD } from '@/data/demo';
import { useShop } from '@/state/ShopContext';
import { fetchMessages, sendMessage, subscribeToMessages } from '@/data/chat';

type Bubble = { id?: string; me: boolean; text: string; time: string };

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Conversation view, shared by the buyer and seller chats.
 *
 * When `conversationId` and `senderId` are supplied it runs live: messages load
 * from the database and stream in over realtime, and the composer inserts real
 * rows. Without them it falls back to the demo transcript (buyers browse without
 * an account, so their chat stays local).
 */
export function ChatView({
  name,
  backTo,
  conversationId,
  senderId,
}: {
  name: string;
  backTo: string;
  conversationId?: string;
  senderId?: string;
}) {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const live = Boolean(conversationId && senderId);
  const [thread, setThread] = useState<Bubble[]>(live ? [] : CHAT_THREAD);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!conversationId || !senderId) return;
    let active = true;
    fetchMessages(conversationId)
      .then((rows) => {
        if (active) setThread(rows.map((m) => ({ id: m.id, me: m.sender_id === senderId, text: m.body, time: fmtTime(m.created_at) })));
      })
      .catch(() => {});
    const unsub = subscribeToMessages(conversationId, (m) => {
      setThread((t) => (t.some((b) => b.id === m.id) ? t : [...t, { id: m.id, me: m.sender_id === senderId, text: m.body, time: fmtTime(m.created_at) }]));
    });
    return () => {
      active = false;
      unsub();
    };
  }, [conversationId, senderId]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    if (live && conversationId && senderId) {
      try {
        await sendMessage(conversationId, senderId, text);
        // Realtime echoes the inserted row back; no optimistic append needed.
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not send');
      }
      return;
    }
    setThread((t) => [...t, { me: true, text, time: fmtTime(new Date().toISOString()) }]);
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
