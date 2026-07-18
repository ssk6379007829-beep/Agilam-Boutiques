import { ThreadList } from '@/components/chat/ThreadList';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchConversationsForBoutique } from '@/data/chat';
import type { Thread } from '@/data/demo';

const relTime = (iso: string | null) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return m + 'm';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h';
  return Math.round(h / 24) + 'd';
};

export function Messages() {
  const { boutique } = useMyBoutique();
  const { data: convos } = useAsync(() => (boutique ? fetchConversationsForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);

  const threads: Thread[] = (convos ?? []).map((c, i) => ({
    id: c.id,
    name: c.buyer_name || 'Customer',
    last: c.last_message,
    time: relTime(c.last_message_at),
    unread: c.unread,
    online: false,
    tone: i % 8,
  }));

  return <ThreadList threads={threads} chatBase="/seller/chat" />;
}
