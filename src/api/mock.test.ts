import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginMockRound,
  finishMockRound,
  listConversationsMock,
  listMessagesMock,
  resetConversationsMock,
} from './mock';

function complete(question: string, answer: string) {
  const round = beginMockRound(null, question);
  finishMockRound(round, {
    status: 'DONE',
    content: answer,
    sources: [],
    provider: 'mock',
    elapsedMillis: 100,
    error: null,
  });
  return round;
}

describe('会话 mock 仓库', () => {
  beforeEach(() => {
    resetConversationsMock();
  });

  it('创建会话时标题按 20 个 code point 截断，并回传四个 meta 标识', async () => {
    const question = '一'.repeat(26);
    const round = beginMockRound(null, question);
    finishMockRound(round, {
      status: 'DONE',
      content: '',
      sources: [],
      provider: 'mock',
      elapsedMillis: 1,
      error: null,
    });

    expect(round.meta).toEqual({
      conversationId: round.conversationId,
      roundId: round.roundId,
      userMessageId: round.userMessageId,
      assistantMessageId: round.assistantMessageId,
    });
    const list = await listConversationsMock();
    expect(list[0]?.title).toBe('一'.repeat(20));
  });

  it('列表按更新时间倒序，同一秒内按创建顺序最新的在前', async () => {
    complete('较早的会话', '回答一');
    const latest = complete('最新的会话', '回答二');

    const list = await listConversationsMock();
    expect(list[0]?.conversationId).toBe(latest.conversationId);
    expect(list[0]?.title).toBe('最新的会话');
    expect(list).toHaveLength(2);
  });

  it('停止与失败的轮次在历史中保留终态和半截正文', async () => {
    const first = complete('第一轮', '完整回答');

    const stopped = beginMockRound(first.conversationId, '第二轮');
    finishMockRound(stopped, {
      status: 'STOPPED',
      content: '半截正文',
      sources: [],
      provider: null,
      elapsedMillis: null,
      error: null,
    });

    const failed = beginMockRound(first.conversationId, '第三轮');
    finishMockRound(failed, {
      status: 'FAILED',
      content: '失败前的正文',
      sources: [],
      provider: null,
      elapsedMillis: null,
      error: '模型服务暂不可用',
    });

    const history = await listMessagesMock(first.conversationId);
    const assistants = history.messages.filter((item) => item.role === 'ASSISTANT');
    expect(assistants.map((item) => item.status)).toEqual(['DONE', 'STOPPED', 'FAILED']);
    expect(assistants[1]?.content).toBe('半截正文');
    expect(assistants[2]?.error).toBe('模型服务暂不可用');
  });

  it('刷新即重置：重置后列表与历史都为空', async () => {
    complete('会消失的会话', '回答');
    expect(await listConversationsMock()).toHaveLength(1);

    resetConversationsMock();
    expect(await listConversationsMock()).toEqual([]);
  });

  it('会话忙碌时再次开启返回 409，会话不存在返回 404', () => {
    const round = beginMockRound(null, '首问');

    let busyError: unknown = null;
    try {
      beginMockRound(round.conversationId, '追问');
    } catch (cause) {
      busyError = cause;
    }
    expect(busyError).toMatchObject({ status: 409 });

    let missingError: unknown = null;
    try {
      beginMockRound('missing', '追问');
    } catch (cause) {
      missingError = cause;
    }
    expect(missingError).toMatchObject({ status: 404 });
  });
});
