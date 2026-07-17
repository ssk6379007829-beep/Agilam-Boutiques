import { ThreadList } from '@/components/chat/ThreadList';
import { SELLER_MSGS } from '@/data/demo';

export function Messages() {
  return <ThreadList threads={SELLER_MSGS} chatBase="/seller/chat" />;
}
