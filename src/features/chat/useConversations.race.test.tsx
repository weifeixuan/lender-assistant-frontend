import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listConversations } from '@/api/conversations';
import type { ConversationSummary } from '@/api/types';
import { useConversations } from './useConversations';

vi.mock('@/api/conversations', () => ({
  listConversations: vi.fn(),
  deleteConversation: vi.fn(),
}));

const mockedList = vi.mocked(listConversations);

function summary(conversationId: string, title = conversationId): ConversationSummary {
  return {
    conversationId,
    title,
    createTime: '2026-01-01 10:00:00',
    updateTime: '2026-01-01 10:00:00',
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (cause: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useConversations request races', () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it('ignores a slow older load response when a newer load already finished', async () => {
    const older = deferred<ConversationSummary[]>();
    const newer = deferred<ConversationSummary[]>();
    mockedList.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    const { result } = renderHook(() => useConversations());
    act(() => {
      void result.current.load();
    });
    act(() => {
      void result.current.load();
    });

    await act(async () => {
      newer.resolve([summary('c-new')]);
      await newer.promise;
    });
    await waitFor(() => expect(result.current.listStatus).toBe('ready'));

    await act(async () => {
      older.resolve([summary('c-old')]);
      await older.promise;
    });

    expect(result.current.conversations.map((item) => item.conversationId)).toEqual(['c-new']);
  });

  it('keeps an optimistic conversation when a refresh response predates it', async () => {
    mockedList.mockResolvedValueOnce([summary('c-existing')]);
    const { result } = renderHook(() => useConversations());
    await act(async () => {
      await result.current.load();
    });

    act(() => {
      result.current.adopt('c-optimistic', '新会话');
    });
    expect(result.current.conversations.map((item) => item.conversationId)).toEqual([
      'c-optimistic',
      'c-existing',
    ]);

    mockedList.mockResolvedValueOnce([summary('c-existing')]);
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.conversations.map((item) => item.conversationId)).toEqual([
      'c-optimistic',
      'c-existing',
    ]);
  });

  it('drops the optimistic entry once the server list contains it', async () => {
    mockedList.mockResolvedValueOnce([summary('c-existing')]);
    const { result } = renderHook(() => useConversations());
    await act(async () => {
      await result.current.load();
    });

    act(() => {
      result.current.adopt('c-optimistic', '新会话');
    });

    mockedList.mockResolvedValueOnce([summary('c-optimistic'), summary('c-existing')]);
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.conversations.map((item) => item.conversationId)).toEqual([
      'c-optimistic',
      'c-existing',
    ]);
  });
});
