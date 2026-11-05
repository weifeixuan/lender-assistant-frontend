import type { MessageItem } from '@/api/types';
import type { Turn, TurnStatus } from './useQaStream';

/** 历史消息按 roundId 分组，不依赖数组相邻顺序，也不依赖 createTime */
export function buildTurns(messages: MessageItem[]): Turn[] {
  const groups = new Map<string, { user?: MessageItem; assistant?: MessageItem }>();

  for (const message of messages) {
    const group = groups.get(message.roundId) ?? {};
    if (message.role === 'USER') group.user = message;
    else group.assistant = message;
    groups.set(message.roundId, group);
  }

  const turns: Turn[] = [];
  for (const [roundId, group] of groups) {
    if (!group.user || !group.assistant) continue;
    const assistant = group.assistant;
    const sources = assistant.sources ?? [];
    const status: TurnStatus =
      assistant.status === 'DONE' ? 'done' : assistant.status === 'FAILED' ? 'error' : 'stopped';

    turns.push({
      id: assistant.messageId,
      messageId: assistant.messageId,
      roundId,
      userMessageId: group.user.messageId,
      question: group.user.content,
      answer: assistant.content,
      sources,
      status,
      error: assistant.error,
      meta:
        assistant.status === 'DONE'
          ? {
              provider: assistant.provider ?? '未知',
              elapsedMillis: assistant.elapsedMillis ?? 0,
              sourceCount: sources.length,
            }
          : null,
      route: null,
      plan: null,
      steps: [],
      origin: 'history',
      createTime: assistant.createTime,
    });
  }

  return turns;
}
