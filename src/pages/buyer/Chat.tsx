import { useParams } from 'react-router-dom';
import { ChatView } from '@/components/chat/ChatView';
import { BOUTIQUES, MESSAGES } from '@/data/demo';

export function Chat() {
  const { id } = useParams();

  // Chats are opened either from the inbox (thread id) or from a product /
  // boutique page (boutique id), so resolve the name from both sources.
  const thread = MESSAGES.find((m) => m.id === id);
  const boutique = BOUTIQUES.find((b) => b.id === id);
  const name = thread?.name ?? boutique?.name ?? 'Elegance Boutique';

  return <ChatView name={name} backTo="/buyer/messages" />;
}
