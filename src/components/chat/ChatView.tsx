import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { fetchMessages, parseProductCard, sendMessage, subscribeToMessages } from '@/data/chat';
import { TONES, fmt } from '@/data/demo';

type Bubble = { id?: string; me: boolean; text: string; time: string };

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * Conversation view, shared by the buyer and seller chats.
 *
 * It always runs live: once `conversationId` and `senderId` are supplied,
 * messages load from the database, stream in over realtime, and the composer
 * inserts real rows that the other side sees instantly. While the caller is
 * still resolving those ids (e.g. the buyer's anonymous identity is being
 * created), pass `pending` to show a connecting state instead.
 */
export function ChatView({
  name,
  backTo,
  conversationId,
  senderId,
  pending,
  onProductClick,
}: {
  name: string;
  backTo: string;
  conversationId?: string;
  senderId?: string;
  pending?: boolean;
  onProductClick?: (productId: string) => void;
}) {
  const navigate = useNavigate();
  const { showToast } = useShop();
  const live = Boolean(conversationId && senderId);
  const [thread, setThread] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId || !senderId) return;
    let active = true;
    setThread([]);
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

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !live || !conversationId || !senderId) return;
    setDraft('');
    try {
      await sendMessage(conversationId, senderId, text);
      // Realtime echoes the inserted row back; no optimistic append needed.
    } catch (e) {
      setDraft(text);
      showToast(e instanceof Error ? e.message : 'Could not send');
    }
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
          <div style={css(`font-size:12px;font-weight:600;color:${live ? '#2FA36B' : '#B79AA6'};`)}>{live ? '● Online' : pending ? 'Connecting…' : '○ Offline'}</div>
        </div>
      </div>

      <div ref={scrollRef} className="agx-scroll" style={css('flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;')}>
        {pending && thread.length === 0 && (
          <div style={css('margin:auto;color:#B79AA6;font-size:13px;font-weight:600;')}>Starting your chat…</div>
        )}
        {live && thread.length === 0 && !pending && (
          <div style={css('margin:auto;text-align:center;color:#B79AA6;font-size:13px;font-weight:600;max-width:240px;')}>No messages yet. Say hello 👋</div>
        )}
        {thread.length > 0 && (
          <div style={css('align-self:center;background:#F4DDE8;color:#8A7078;font-size:11px;font-weight:700;padding:4px 12px;border-radius:10px;')}>Today</div>
        )}
        {thread.map((c, i) => {
          const card = parseProductCard(c.text);
          if (card) {
            return (
              <div
                key={c.id ?? i}
                onClick={onProductClick ? () => onProductClick(card.id) : undefined}
                style={css(`max-width:78%;width:250px;align-self:${c.me ? 'flex-end' : 'flex-start'};background:#fff;border:1px solid #F0E2E9;border-radius:16px;overflow:hidden;box-shadow:0 8px 20px -14px rgba(107,20,54,.55);cursor:${onProductClick ? 'pointer' : 'default'};`)}
              >
                <div style={css('display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid #F5E6EE;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:15px;color:#B02454;")}>sell</span>
                  <span className="agx-eyebrow" style={css('font-size:9px;letter-spacing:.14em;color:#B02454;')}>Enquiry about this product</span>
                </div>
                <div style={css('display:flex;gap:11px;padding:11px 12px;')}>
                  <div style={css(`width:60px;height:76px;flex:none;border-radius:11px;overflow:hidden;background:${TONES[card.tone % TONES.length]};position:relative;`)}>
                    <ImageSlot src={card.image} placeholder={card.title} style={css('position:absolute;inset:0;')} />
                  </div>
                  <div style={css('flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;')}>
                    {card.cat && <div className="agx-eyebrow" style={css('font-size:9px;color:#8A7078;')}>{card.cat}</div>}
                    <div style={css('font-size:13.5px;font-weight:700;color:#241019;line-height:1.25;margin-top:2px;')}>{card.title}</div>
                    <div style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:16px;margin-top:4px;")}>{fmt(card.price)}</div>
                  </div>
                </div>
                <div style={css('font-size:10px;color:#B79AA6;padding:0 12px 8px;text-align:right;')}>{c.time}</div>
              </div>
            );
          }
          return (
            <div
              key={c.id ?? i}
              style={css(`max-width:78%;align-self:${c.me ? 'flex-end' : 'flex-start'};background:${c.me ? '#D6336C' : '#fff'};color:${c.me ? '#fff' : '#2A1A20'};padding:10px 13px;border-radius:${c.me ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};font-size:13.5px;line-height:1.4;box-shadow:0 6px 16px -12px rgba(107,20,54,.5);`)}
            >
              {c.text}
              <div style={css('font-size:10px;opacity:.6;margin-top:3px;text-align:right;')}>{c.time}</div>
            </div>
          );
        })}
      </div>

      <div style={css('flex:none;background:#fff;padding:10px 14px 16px;display:flex;gap:10px;align-items:center;border-top:1px solid #F3DFE8;')}>
        <div style={css('flex:1;display:flex;align-items:center;gap:8px;background:#FBF6F2;border-radius:14px;padding:0 14px;height:46px;')}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={!live}
            placeholder={live ? 'Message…' : 'Connecting…'}
            style={css('border:none;background:none;flex:1;font-size:14px;')}
          />
        </div>
        <button onClick={send} disabled={!live} style={css(`width:46px;height:46px;border-radius:14px;border:none;background:linear-gradient(135deg,#D6336C,#B02454);cursor:${live ? 'pointer' : 'not-allowed'};opacity:${live ? 1 : 0.5};display:flex;align-items:center;justify-content:center;`)}>
          <span style={css("font-family:'Material Symbols Outlined';color:#fff;")}>send</span>
        </button>
      </div>
    </div>
  );
}
