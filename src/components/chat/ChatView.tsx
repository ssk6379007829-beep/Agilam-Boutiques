import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@/lib/css';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { useShop } from '@/state/ShopContext';
import { fetchMessages, parseOrderCard, parseProductCard, sendMessage, subscribeToMessages } from '@/data/chat';
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
  onOrderClick,
}: {
  name: string;
  backTo: string;
  conversationId?: string;
  senderId?: string;
  pending?: boolean;
  onProductClick?: (productId: string) => void;
  onOrderClick?: (orderId: string) => void;
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

  const monogram = (name.trim()[0] ?? '·').toUpperCase();
  const statusLabel = live ? 'Online now' : pending ? 'Connecting…' : 'Offline';

  return (
    <div className="agx-chat-root" style={css('position:fixed;inset:0;z-index:40;background:radial-gradient(120% 60% at 50% 0%,#FDF3F7 0%,#FBF6F2 42%,#F7EEF1 100%);display:flex;flex-direction:column;')}>
      <div style={css('max-width:900px;width:100%;margin:0 auto;height:100%;display:flex;flex-direction:column;')}>
        {/* Premium glass header */}
        <div style={css('flex:none;background:rgba(255,255,255,.82);backdrop-filter:blur(16px) saturate(1.3);padding:10px 14px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #F1DEE7;box-shadow:0 10px 30px -26px rgba(107,20,54,.6);')}>
          <button onClick={() => navigate(backTo)} aria-label="Back" style={css('width:40px;height:40px;flex:none;border-radius:13px;border:none;background:#FBF1F5;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:22px;")}>arrow_back</span>
          </button>
          <div style={css('position:relative;flex:none;')}>
            <div style={css("width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#E14A7E,#B02454 70%,#8E1C44);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-weight:700;font-size:18px;color:#fff;box-shadow:0 1px 0 rgba(255,255,255,.35) inset,0 12px 26px -14px rgba(176,36,84,.9);")}>{monogram}</div>
            {live && <span className="agx-online-dot" style={css('position:absolute;right:-2px;bottom:-2px;width:13px;height:13px;border-radius:50%;background:#2FA36B;border:2.5px solid #fff;')} />}
          </div>
          <div style={css('flex:1;min-width:0;')}>
            <div style={css('font-weight:800;font-size:15.5px;color:#241019;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{name}</div>
            <div style={css(`font-size:11.5px;font-weight:700;color:${live ? '#2FA36B' : '#B79AA6'};display:flex;align-items:center;gap:5px;`)}>
              {live && <span style={css('width:6px;height:6px;border-radius:50%;background:#2FA36B;')} />}{statusLabel}
            </div>
          </div>
          <div style={css('flex:none;display:flex;align-items:center;gap:6px;background:#FBF1F5;border:1px solid #F3DDE8;border-radius:11px;padding:6px 10px;')}>
            <span style={css("font-family:'Material Symbols Outlined';color:#2FA36B;font-size:15px;")}>lock</span>
            <span className="agx-hide-sm" style={css('font-size:10.5px;font-weight:700;color:#8A7078;')}>Secure</span>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="agx-scroll" style={css('flex:1;min-height:0;overflow-y:auto;padding:18px 16px 8px;display:flex;flex-direction:column;gap:9px;')}>
          {pending && thread.length === 0 && (
            <div style={css('margin:auto;display:flex;flex-direction:column;align-items:center;gap:10px;color:#B79AA6;font-size:13px;font-weight:600;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:30px;color:#E7A9C1;")}>chat</span>Starting your chat…
            </div>
          )}
          {live && thread.length === 0 && !pending && (
            <div style={css('margin:auto;text-align:center;color:#B79AA6;font-size:13px;font-weight:600;max-width:240px;display:flex;flex-direction:column;align-items:center;gap:10px;')}>
              <span style={css("font-family:'Material Symbols Outlined';font-size:34px;color:#E7A9C1;")}>waving_hand</span>No messages yet. Say hello 👋
            </div>
          )}
          {thread.length > 0 && (
            <div style={css('align-self:center;background:rgba(180,64,116,.1);color:#9A5B76;font-size:10.5px;font-weight:800;letter-spacing:.03em;padding:4px 13px;border-radius:999px;margin-bottom:4px;')}>Today</div>
          )}
          {thread.map((c, i) => {
          const order = parseOrderCard(c.text);
          if (order) {
            return (
              <div
                key={c.id ?? i}
                onClick={onOrderClick ? () => onOrderClick(order.orderId) : undefined}
                style={css(`max-width:78%;width:250px;align-self:${c.me ? 'flex-end' : 'flex-start'};background:#fff;border:1px solid #F0E2E9;border-radius:16px;overflow:hidden;box-shadow:0 8px 20px -14px rgba(107,20,54,.55);cursor:${onOrderClick ? 'pointer' : 'default'};`)}
              >
                <div style={css('display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid #F5E6EE;')}>
                  <span style={css("font-family:'Material Symbols Outlined';font-size:15px;color:#B02454;")}>receipt_long</span>
                  <span className="agx-eyebrow" style={css('font-size:9px;letter-spacing:.14em;color:#B02454;')}>Enquiry about this order · {order.orderId}</span>
                </div>
                <div style={css('display:flex;gap:11px;padding:11px 12px;')}>
                  <div style={css(`width:60px;height:76px;flex:none;border-radius:11px;overflow:hidden;background:${TONES[order.tone % TONES.length]};position:relative;`)}>
                    <ImageSlot src={order.image} placeholder={order.title} style={css('position:absolute;inset:0;')} />
                  </div>
                  <div style={css('flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;')}>
                    {order.status && <div className="agx-eyebrow" style={css('font-size:9px;color:#8A7078;')}>{order.status}</div>}
                    <div style={css('font-size:13.5px;font-weight:700;color:#241019;line-height:1.25;margin-top:2px;')}>{order.title}</div>
                    <div style={css('display:flex;align-items:baseline;gap:8px;margin-top:4px;')}>
                      {order.amount != null && <span style={css("font-family:'Playfair Display',serif;font-weight:700;color:#B02454;font-size:16px;")}>{fmt(order.amount)}</span>}
                      {order.qty != null && <span style={css('font-size:11px;color:#8A7078;font-weight:600;')}>Qty {order.qty}</span>}
                    </div>
                  </div>
                </div>
                <div style={css('font-size:10px;color:#B79AA6;padding:0 12px 8px;text-align:right;')}>{c.time}</div>
              </div>
            );
          }
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
              style={css(`position:relative;max-width:80%;align-self:${c.me ? 'flex-end' : 'flex-start'};background:${c.me ? 'linear-gradient(135deg,#E8558A,#B02454 88%)' : '#fff'};color:${c.me ? '#fff' : '#2A1A20'};padding:9px 13px 7px;border-radius:${c.me ? '18px 18px 5px 18px' : '18px 18px 18px 5px'};font-size:13.5px;line-height:1.45;border:${c.me ? 'none' : '1px solid #F2E3EA'};box-shadow:${c.me ? '0 10px 22px -14px rgba(176,36,84,.85)' : '0 8px 20px -16px rgba(107,20,54,.5)'};`)}
            >
              {c.text}
              <div style={css(`font-size:9.5px;margin-top:3px;text-align:right;color:${c.me ? 'rgba(255,255,255,.75)' : '#B79AA6'};font-weight:600;`)}>{c.time}</div>
            </div>
          );
        })}
      </div>

      {/* Floating composer — sits just above the nav dock (see .agx-chat-root). */}
      <div style={css('flex:none;padding:8px 12px 4px;')}>
        <div style={css('display:flex;gap:9px;align-items:center;background:rgba(255,255,255,.9);backdrop-filter:blur(18px) saturate(1.3);border:1px solid #F1DEE7;border-radius:22px;padding:7px 8px 7px 8px;box-shadow:0 2px 0 rgba(255,255,255,.6) inset,0 22px 44px -22px rgba(107,20,54,.5);')}>
          <button
            onClick={() => showToast('Photo sharing is coming soon')}
            disabled={!live}
            aria-label="Attach"
            style={css(`width:42px;height:42px;flex:none;border-radius:15px;border:none;background:#FBF1F5;cursor:${live ? 'pointer' : 'not-allowed'};opacity:${live ? 1 : 0.5};display:flex;align-items:center;justify-content:center;`)}
          >
            <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:22px;")}>add_photo_alternate</span>
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={!live}
            placeholder={live ? 'Type a message…' : pending ? 'Connecting…' : 'Message…'}
            style={css('border:none;background:none;flex:1;font-size:14.5px;font-weight:500;color:#241019;min-width:0;padding:0 4px;')}
          />
          <button
            onClick={send}
            disabled={!live || !draft.trim()}
            aria-label="Send"
            style={css(`width:44px;height:44px;flex:none;border-radius:15px;border:none;background:linear-gradient(135deg,#E14A7E,#B02454 75%,#8E1C44);cursor:${live && draft.trim() ? 'pointer' : 'not-allowed'};opacity:${live && draft.trim() ? 1 : 0.5};display:flex;align-items:center;justify-content:center;box-shadow:0 12px 24px -12px rgba(176,36,84,.9);transition:opacity .2s ease;`)}
          >
            <span style={css("font-family:'Material Symbols Outlined';color:#fff;font-size:21px;")}>send</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
