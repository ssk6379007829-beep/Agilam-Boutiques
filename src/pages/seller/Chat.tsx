import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { fetchConversationPeerName } from '@/data/chat';
import { ChatView } from '@/components/chat/ChatView';

export function Chat() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: peerName } = useAsync(() => fetchConversationPeerName(id, 'seller'), [id]);

  if (!profile) return null;

  return <ChatView conversationId={id} peerName={peerName ?? '…'} viewerId={profile.id} onBack={() => navigate('/seller/messages')} />;
}
