import { describe, expect, it } from 'vitest';
import type { MessageItem, MessageStatus, QaSource } from '@/api/types';
import { buildTurns } from './history';

function message(overrides: Partial<MessageItem> & Pick<MessageItem, 'messageId' | 'roundId' | 'role'>): MessageItem {
  return {
    content: '',
    status: 'DONE',
    sources: null,
    provider: null,
    elapsedMillis: null,
    error: null,
    createTime: '2026-10-21 10:00:00',
    ...overrides,
  };
}

const source: QaSource = {
  idx: 1,
  docTitle: '管理办法',
  sectionPath: null,
  chunkId: 12,
  content: '正文',
  vectorDistance: 0.123,
  keywordHits: null,
  bothChannels: false,
  rrfScore: '0.03246',
};

describe('buildTurns', () => {
  it('pairs messages by roundId regardless of array order', () => {
    const turns = buildTurns([
      message({ messageId: 'a1', roundId: 'r1', role: 'ASSISTANT', content: '答案一' }),
      message({ messageId: 'u2', roundId: 'r2', role: 'USER', content: '问题二' }),
      message({ messageId: 'u1', roundId: 'r1', role: 'USER', content: '问题一' }),
      message({ messageId: 'a2', roundId: 'r2', role: 'ASSISTANT', content: '答案二' }),
    ]);

    expect(turns.map((turn) => turn.id)).toEqual(['a1', 'a2']);
    expect(turns[0]?.question).toBe('问题一');
    expect(turns[0]?.answer).toBe('答案一');
    expect(turns[0]?.userMessageId).toBe('u1');
    expect(turns[0]?.roundId).toBe('r1');
    expect(turns[0]?.origin).toBe('history');
  });

  it('skips rounds missing either role', () => {
    const turns = buildTurns([
      message({ messageId: 'u1', roundId: 'r1', role: 'USER', content: '只有问题' }),
      message({ messageId: 'a2', roundId: 'r2', role: 'ASSISTANT', content: '只有答案' }),
    ]);
    expect(turns).toEqual([]);
  });

  it('maps DONE with provider, elapsed and source count', () => {
    const turns = buildTurns([
      message({ messageId: 'u1', roundId: 'r1', role: 'USER', content: '问题' }),
      message({
        messageId: 'a1',
        roundId: 'r1',
        role: 'ASSISTANT',
        content: '答案',
        sources: [source],
        provider: 'DashScope',
        elapsedMillis: 1860,
      }),
    ]);
    const turn = turns[0];
    expect(turn?.status).toBe('done');
    expect(turn?.meta).toEqual({ provider: 'DashScope', elapsedMillis: 1860, sourceCount: 1 });
  });

  it('keeps provider and elapsed for FAILED and STOPPED rounds and keeps partial content', () => {
    const cases: Array<{ status: MessageStatus; expected: 'error' | 'stopped' }> = [
      { status: 'FAILED', expected: 'error' },
      { status: 'STOPPED', expected: 'stopped' },
    ];

    for (const item of cases) {
      const turns = buildTurns([
        message({ messageId: 'u1', roundId: 'r1', role: 'USER', content: '问题' }),
        message({
          messageId: 'a1',
          roundId: 'r1',
          role: 'ASSISTANT',
          content: '半截回答',
          status: item.status,
          sources: [source],
          provider: 'DashScope',
          elapsedMillis: 980,
          error: '模型超时',
        }),
      ]);
      expect(turns[0]?.status).toBe(item.expected);
      expect(turns[0]?.answer).toBe('半截回答');
      expect(turns[0]?.sources).toHaveLength(1);
      expect(turns[0]?.meta).toEqual({
        provider: 'DashScope',
        elapsedMillis: 980,
        sourceCount: 1,
      });
    }
  });

  it('falls back to 未知 / 0 when a FAILED round has no persisted provider or duration', () => {
    const turns = buildTurns([
      message({ messageId: 'u1', roundId: 'r1', role: 'USER', content: '问题' }),
      message({
        messageId: 'a1',
        roundId: 'r1',
        role: 'ASSISTANT',
        content: '半截回答',
        status: 'FAILED',
        sources: [source],
      }),
    ]);
    expect(turns[0]?.meta).toEqual({ provider: '未知', elapsedMillis: 0, sourceCount: 1 });
  });

  it('treats null sources as an empty list', () => {
    const turns = buildTurns([
      message({ messageId: 'u1', roundId: 'r1', role: 'USER', content: '问题' }),
      message({ messageId: 'a1', roundId: 'r1', role: 'ASSISTANT', content: '答案' }),
    ]);
    expect(turns[0]?.sources).toEqual([]);
  });
});
