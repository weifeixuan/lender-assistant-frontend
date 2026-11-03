import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginMockRound,
  finishMockRound,
  resetConversationsMock,
} from '@/api/mock';
import type { HistoryResult } from './useConversationHistory';
import { useConversationHistory } from './useConversationHistory';

function seedConversation(question: string): string {
  const round = beginMockRound(null, question);
  finishMockRound(round, {
    status: 'DONE',
    content: `回答：${question}`,
    sources: [],
    provider: 'mock',
    elapsedMillis: 100,
    error: null,
  });
  return round.conversationId;
}

describe('useConversationHistory', () => {
  beforeEach(() => {
    resetConversationsMock();
    window.history.replaceState({}, '', '/?mock=1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('aborts the in-flight request when unmounted', async () => {
    window.history.replaceState({}, '', '/');
    const captured: { signal: AbortSignal | null } = { signal: null };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured.signal = init?.signal ?? null;
        return new Promise<Response>(() => undefined);
      }),
    );

    const { result, unmount } = renderHook(() => useConversationHistory());
    act(() => {
      void result.current.load('conv-x');
    });
    await waitFor(() => expect(captured.signal).not.toBeNull());

    unmount();
    expect(captured.signal?.aborted).toBe(true);
  });

  it('discards the earlier response when switching quickly', async () => {
    const firstId = seedConversation('会话一');
    const secondId = seedConversation('会话二');
    const { result } = renderHook(() => useConversationHistory());

    const results: HistoryResult[] = [];

    await act(async () => {
      const first = result.current.load(firstId);
      const second = result.current.load(secondId);
      const [a, b] = await Promise.all([first, second]);
      results.push(a, b);
    });

    expect(results.at(0)).toEqual({ kind: 'cancelled' });
    const secondResult = results.at(1);
    if (!secondResult || secondResult.kind !== 'ok') throw new Error('第二次加载应成功');
    expect(secondResult.messages[0]?.content).toBe('会话二');
    expect(result.current.status).toBe('ready');
  });

  it('returns missing for a deleted conversation', async () => {
    const { result } = renderHook(() => useConversationHistory());
    const outcomes: HistoryResult[] = [];
    await act(async () => {
      outcomes.push(await result.current.load('missing-conversation'));
    });
    expect(outcomes.at(0)).toEqual({ kind: 'missing' });
    expect(result.current.status).toBe('ready');
  });
});
