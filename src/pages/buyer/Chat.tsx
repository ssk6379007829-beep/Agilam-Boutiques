import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChatView } from '@/components/chat/ChatView';
import { BuyerDetailsSheet } from '@/components/buyer/BuyerDetailsSheet';
import { useCatalog } from '@/state/CatalogContext';
import { useShop } from '@/state/ShopContext';
import {
  ensureBuyerIdentity,
  encodeProductCard,
  fetchMessages,
  getOrCreateConversation,
  parseProductCard,
  sendMessage,
  syncBuyerProfile,
  type ProductCard,
} from '@/data/chat';

/**
 * Buyer conversation. The route param is the boutique id (chats are opened from
 * a product or boutique page). Before running we make sure the buyer has given
 * their name + phone (the lightweight identity gate); then we mint/reuse their
 * anonymous identity and the one conversation they have with that boutique.
 */
export function Chat() {
  const { id: boutiqueId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { boutiqueById } = useCatalog();
  const { hasBuyerDetails, showToast } = useShop();
  const [gateOpen, setGateOpen] = useState(!hasBuyerDetails);
  const [live, setLive] = useState<{ conversationId: string; senderId: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const pendingProduct = (location.state as { product?: ProductCard } | null)?.product ?? null;
  const sharedRef = useRef(false);

  useEffect(() => {
    // Hold until the buyer has provided contact details.
    if (!boutiqueId || gateOpen) return;
    let active = true;
    setLive(null);
    setFailed(false);
    (async () => {
      const buyerId = await ensureBuyerIdentity();
      await syncBuyerProfile();
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
  }, [boutiqueId, gateOpen, showToast]);

  // Once live, if the buyer arrived from a product's Chat button, post that
  // product as a card so the seller sees which item the enquiry is about. Skip
  // if the same product is already the most recent one shared, to avoid spam.
  useEffect(() => {
    if (!live || !pendingProduct || sharedRef.current) return;
    sharedRef.current = true;
    const { conversationId, senderId } = live;
    const product = pendingProduct;
    (async () => {
      try {
        const msgs = await fetchMessages(conversationId);
        const lastCard = [...msgs].reverse().map((m) => parseProductCard(m.body)).find(Boolean);
        if (lastCard?.id === product.id) return;
        await sendMessage(conversationId, senderId, encodeProductCard(product));
      } catch {
        /* non-fatal: the buyer can still chat */
      }
    })();
  }, [live, pendingProduct]);

  const name = boutiqueById(boutiqueId)?.name ?? 'Boutique';

  return (
    <>
      <ChatView
        name={name}
        backTo="/buyer/messages"
        conversationId={live?.conversationId}
        senderId={live?.senderId}
        pending={!gateOpen && !live && !failed}
        onProductClick={(pid) => navigate(`/buyer/product/${pid}`)}
      />
      {gateOpen && (
        <BuyerDetailsSheet
          title={`Chat with ${name}`}
          subtitle="Share your name and number so the boutique knows who they're talking to."
          cta="Start chat"
          onDone={() => setGateOpen(false)}
          onClose={() => navigate('/buyer/messages')}
        />
      )}
    </>
  );
}
