import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatView } from '@/components/chat/ChatView';
import { useCatalog } from '@/state/CatalogContext';
import { useShop } from '@/state/ShopContext';
import { ensureBuyerIdentity, getOrCreateConversation } from '@/data/chat';

/**
 * Buyer conversation. The route param is the boutique id (chats are opened from
 * a product or boutique page), so we mint/reuse the buyer's anonymous identity
 * and the one conversation they have with that boutique, then run live.
 */
export function Chat() {
  const { id: boutiqueId } = useParams();
  const { boutiqueById } = useCatalog();
  const { showToast } = useShop();
  const [live, setLive] = useState<{ conversationId: string; senderId: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!boutiqueId) return;
    let active = true;
    setLive(null);
    setFailed(false);
    (async () => {
      const buyerId = await ensureBuyerIdentity();
      const conversationId = await getOrCreateConversation(buyerId, boutiqueId);
      if (active) setLive({ conversationId, senderId: buyerId });
    })().catch((e) => {
      if (!active) return;
      setFailed(true);
      showToast(e instanceof Error ? e.message : 'Could not start chat');
    });
    return () => {
      active = false;
    };
  }, [boutiqueId, showToast]);

  const name = boutiqueById(boutiqueId)?.name ?? 'Boutique';

  return (
    <ChatView
      name={name}
      backTo="/buyer/messages"
      conversationId={live?.conversationId}
      senderId={live?.senderId}
      pending={!live && !failed}
    />
  );
}
