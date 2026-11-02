import { describe, expectTypeOf, it } from 'vitest';
import type {
  ConversationSummary,
  MessageItem,
  MessageList,
  MessageRole,
  MessageStatus,
  QaMeta,
  QaSourceItem,
} from './types';

describe('multi-turn contract mirror', () => {
  it('keeps nullable history fields nullable', () => {
    expectTypeOf<MessageItem['sources']>().toEqualTypeOf<QaSourceItem[] | null>();
    expectTypeOf<MessageItem['provider']>().toEqualTypeOf<string | null>();
    expectTypeOf<MessageItem['elapsedMillis']>().toEqualTypeOf<number | null>();
    expectTypeOf<MessageItem['error']>().toEqualTypeOf<string | null>();
  });

  it('mirrors message role and status literals', () => {
    expectTypeOf<MessageRole>().toEqualTypeOf<'USER' | 'ASSISTANT'>();
    expectTypeOf<MessageStatus>().toEqualTypeOf<'DONE' | 'FAILED' | 'STOPPED'>();
  });

  it('mirrors list, message list and meta fields', () => {
    expectTypeOf<ConversationSummary['conversationId']>().toBeString();
    expectTypeOf<ConversationSummary['title']>().toBeString();
    expectTypeOf<MessageList['messages']>().toEqualTypeOf<MessageItem[]>();
    expectTypeOf<QaMeta['assistantMessageId']>().toBeString();
    expectTypeOf<QaMeta['userMessageId']>().toBeString();
  });
});
