import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginMockRound,
  finishMockRound,
  resetConversationsMock,
} from '@/api/mock';
import { useConversations } from './useConversations';

function seed(question: string): string {
  const round = beginMockRound(null, question);
  finishMockRound(round, {
    status: 'DONE',
    content: '回答',
    sources: [],
    provider: 'mock',
    elapsedMillis: 100,
    error: null,
  });
  return round.conversationId;
}

describe('useConversations', () => {
  beforeEach(() => {
    resetConversationsMock();
    window.history.replaceState({}, '', '/?mock=1');
  });

  it('loads the list without selecting any conversation', async () => {
    const first = seed('会话一');
    const second = seed('会话二');
    const { result } = renderHook(() => useConversations());

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => expect(result.current.listStatus).toBe('ready'));
    expect(result.current.mode).toBe('empty');
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.conversations.map((item) => item.conversationId)).toEqual([
      second,
      first,
    ]);
  });

  it('enters draft without touching the list, then adopts the first question', async () => {
    const existing = seed('已有会话');
    const { result } = renderHook(() => useConversations());

    await act(async () => {
      await result.current.load();
    });
    const before = result.current.conversations.length;

    act(() => {
      result.current.startDraft();
    });
    expect(result.current.mode).toBe('draft');
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.conversations).toHaveLength(before);

    act(() => {
      result.current.adopt('conversation-new', '新问题');
    });
    expect(result.current.mode).toBe('conversation');
    expect(result.current.activeConversationId).toBe('conversation-new');
    expect(result.current.conversations[0]?.conversationId).toBe('conversation-new');
    expect(result.current.conversations[0]?.title).toBe('新问题');
    expect(result.current.conversations).toHaveLength(before + 1);
    expect(result.current.conversations.some((item) => item.conversationId === existing)).toBe(
      true,
    );
  });

  it('removes a local entry and clears the active id', async () => {
    const existing = seed('待切换的会话');
    const { result } = renderHook(() => useConversations());
    await act(async () => {
      await result.current.load();
    });
    expect(result.current.activeConversationId).toBeNull();

    act(() => {
      result.current.select(existing);
    });
    expect(result.current.activeConversationId).toBe(existing);

    act(() => {
      result.current.removeLocal(existing);
    });
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.conversations).toEqual([]);
  });
});
