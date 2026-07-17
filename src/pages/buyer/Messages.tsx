import { ThreadList } from '@/components/chat/ThreadList';
import { MESSAGES } from '@/data/demo';

export function Messages() {
  return <ThreadList threads={MESSAGES} chatBase="/buyer/chat" />;
}
