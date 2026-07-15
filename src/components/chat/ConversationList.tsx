import { Avatar } from '@/components/ui/Avatar';
import { toneHex } from '@/lib/tokens';
import type { ConversationWithPeer } from '@/data/types';

export function ConversationList({
  conversations,
  viewerRole,
  onOpen,
}: {
  conversations: ConversationWithPeer[];
  viewerRole: 'buyer' | 'seller';
  onOpen: (c: ConversationWithPeer) => void;
}) {
  return (
    <div className="flex flex-col">
      {conversations.map((c) => {
        const name = viewerRole === 'buyer' ? c.boutique_name : c.buyer_name;
        return (
          <div key={c.id} onClick={() => onOpen(c)} className="flex cursor-pointer items-center gap-3 border-b border-rose-borderSoft px-5 py-3">
            <Avatar name={name} size={52} radius={16} tone={toneHex(c.boutique_tone)} fontSize={22} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[14.5px] font-extrabold">{name}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="max-w-[210px] truncate text-[13px] text-rose-muted">{c.last_message}</span>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-[10px] bg-rose-primary px-1.5 text-[11px] font-extrabold text-white">
                    {c.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {conversations.length === 0 && <div className="px-5 pt-8 text-center text-sm text-rose-muted">No conversations yet.</div>}
    </div>
  );
}
