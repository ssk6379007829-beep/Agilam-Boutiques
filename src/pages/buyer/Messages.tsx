import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchConversationsForBuyer } from '@/data/chat';
import { ConversationList } from '@/components/chat/ConversationList';

export function Messages() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: conversations } = useAsync(() => (profile ? fetchConversationsForBuyer(profile.id) : Promise.resolve([])), [profile?.id]);

  return (
    <div className="min-h-full bg-rose-card">
      <div className="px-5 pb-3 pt-1.5 font-serif text-[28px] font-bold">Messages</div>
      <ConversationList conversations={conversations ?? []} viewerRole="buyer" onOpen={(c) => navigate(`/buyer/chat/${c.id}`)} />
    </div>
  );
}
