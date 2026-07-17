import { useParams } from 'react-router-dom';
import { ChatView } from '@/components/chat/ChatView';
import { SELLER_MSGS } from '@/data/demo';

export function Chat() {
  const { id } = useParams();
  const thread = SELLER_MSGS.find((m) => m.id === id);

  return <ChatView name={thread?.name ?? 'Priya Sharma'} backTo="/seller/messages" />;
}
