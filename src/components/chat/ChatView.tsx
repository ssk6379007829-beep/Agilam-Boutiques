import { useEffect, useRef, useState } from 'react';
import { fetchMessages, sendMessage, subscribeToMessages } from '@/data/chat';
import type { MessageRow } from '@/data/types';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toast';

export function ChatView({
  conversationId,
  peerName,
  viewerId,
  onBack,
}: {
  conversationId: string;
  peerName: string;
  viewerId: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState('');
  const toast = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages(conversationId).then(setMessages);
    const unsubscribe = subscribeToMessages(conversationId, (msg) => setMessages((prev) => [...prev, msg]));
    return unsubscribe;
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend() {
    if (!text.trim()) return;
    const body = text.trim();
    setText('');
    await sendMessage(conversationId, viewerId, body);
  }

  return (
    <div className="flex h-full min-h-full flex-col bg-rose-card">
      <div className="flex flex-none items-center gap-2.5 border-b border-rose-borderMid bg-white px-4 py-2">
        <IconButton icon="arrow_back" onClick={onBack} size={38} iconSize={18} bg="#FDEEF4" />
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-chip font-serif font-bold text-black/55">
          {peerName?.[0]}
        </div>
        <div className="flex-1">
          <div className="text-[14.5px] font-extrabold">{peerName}</div>
          <div className="text-xs font-semibold text-good">● Online</div>
        </div>
        <button
          onClick={() => toast('Opening WhatsApp…')}
          className="flex items-center gap-1.5 rounded-xl border-none bg-[#25A566] px-3 py-2 text-xs font-bold text-white"
        >
          <Icon name="chat_bubble" className="text-base" />
          WhatsApp
        </button>
      </div>
      <div className="no-scrollbar flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.sender_id === viewerId;
          return (
            <div
              key={m.id}
              className="max-w-[78%] px-3.5 py-2.5 text-[13.5px] leading-snug shadow-[0_6px_16px_-12px_rgba(107,20,54,.5)]"
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                background: mine ? '#D6336C' : '#fff',
                color: mine ? '#fff' : '#2A1A20',
                borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              }}
            >
              {m.body}
              <div className="mt-0.5 text-right text-[10px] opacity-60">
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <div className="pt-6 text-center text-sm text-rose-muted">Say hello 👋</div>}
        <div ref={bottomRef} />
      </div>
      <div className="flex flex-none items-center gap-2.5 border-t border-rose-borderMid bg-white px-3.5 py-2.5">
        <div className="flex h-[46px] flex-1 items-center gap-2 rounded-2xl bg-rose-card px-3.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message…"
            className="flex-1 border-none bg-transparent text-sm outline-none"
          />
        </div>
        <button
          onClick={handleSend}
          className="flex h-[46px] w-[46px] items-center justify-center rounded-2xl border-none"
          style={{ background: 'linear-gradient(135deg,#D6336C,#B02454)' }}
        >
          <Icon name="send" className="text-white" />
        </button>
      </div>
    </div>
  );
}
