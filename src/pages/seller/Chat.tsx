import { useParams } from 'react-router-dom';
import { ChatView } from '@/components/chat/ChatView';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchConversationPeerName } from '@/data/chat';

export function Chat() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { data: name } = useAsync(() => (id ? fetchConversationPeerName(id, 'seller') : Promise.resolve('Customer')), [id]);

  return (
    <ChatView
      name={name ?? 'Customer'}
      backTo="/seller/messages"
      conversationId={id}
      senderId={profile?.id}
    />
  );
}
