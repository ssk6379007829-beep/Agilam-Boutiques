import { useNavigate } from 'react-router-dom';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { useAsync } from '@/hooks/useAsync';
import { fetchConversationsForBoutique } from '@/data/chat';
import { ConversationList } from '@/components/chat/ConversationList';

export function Messages() {
  const navigate = useNavigate();
  const { boutique } = useMyBoutique();
  const { data: conversations } = useAsync(() => (boutique ? fetchConversationsForBoutique(boutique.id) : Promise.resolve([])), [boutique?.id]);

  return (
    <div className="min-h-full bg-rose-card">
      <div className="px-5 pb-3 pt-1.5 font-serif text-[28px] font-bold">Messages</div>
      <ConversationList conversations={conversations ?? []} viewerRole="seller" onOpen={(c) => navigate(`/seller/chat/${c.id}`)} />
    </div>
  );
}
