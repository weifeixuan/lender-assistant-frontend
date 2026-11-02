import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './client';
import {
  beginMockRound,
  deleteConversationMock,
  finishMockRound,
  listConversationsMock,
  listMessagesMock,
  resetConversationsMock,
} from './mock';

describe('mock conversation repository', () => {
  beforeEach(() => {
    resetConversationsMock();
  });

  it('creates a conversation lazily and lists it first', async () => {
    const first = beginMockRound(null, '第一个会话的问题');
    finishMockRound(first, {
      status: 'DONE',
      content: '答案一',
      sources: [],
      provider: 'mock',
      elapsedMillis: 120,
      error: null,
    });
    const second = beginMockRound(null, '第二个会话的问题');
    finishMockRound(second, {
      status: 'DONE',
      content: '答案二',
      sources: [],
      provider: 'mock',
      elapsedMillis: 130,
      error: null,
    });

    const list = await listConversationsMock();
    expect(list).toHaveLength(2);
    expect(list[0]?.conversationId).toBe(second.conversationId);
    expect(list[1]?.conversationId).toBe(first.conversationId);
  });

  it('returns messages grouped by roundId in creation order', async () => {
    const round = beginMockRound(null, '首问');
    finishMockRound(round, {
      status: 'DONE',
      content: '回答',
      sources: [],
      provider: 'mock',
      elapsedMillis: 100,
      error: null,
    });

    const history = await listMessagesMock(round.conversationId);
    expect(history.conversationId).toBe(round.conversationId);
    expect(history.messages).toHaveLength(2);
    expect(history.messages[0]?.role).toBe('USER');
    expect(history.messages[0]?.roundId).toBe(round.roundId);
    expect(history.messages[1]?.role).toBe('ASSISTANT');
    expect(history.messages[1]?.messageId).toBe(round.assistantMessageId);
  });

  it('rejects 404 for unknown conversations on history and delete', async () => {
    await expect(listMessagesMock('missing')).rejects.toBeInstanceOf(ApiError);
    await expect(deleteConversationMock('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('deletes an existing conversation and refuses the second delete', async () => {
    const round = beginMockRound(null, '待删除的会话');
    finishMockRound(round, {
      status: 'DONE',
      content: '回答',
      sources: [],
      provider: 'mock',
      elapsedMillis: 100,
      error: null,
    });

    await expect(deleteConversationMock(round.conversationId)).resolves.toEqual({
      conversationId: round.conversationId,
      deleted: true,
    });
    await expect(deleteConversationMock(round.conversationId)).rejects.toMatchObject({
      status: 404,
    });
    await expect(listConversationsMock()).resolves.toEqual([]);
  });
});
