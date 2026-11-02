import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConversationsMock } from '@/api/mock';
import { useQaStream } from './useQaStream';

describe('useQaStream', () => {
  beforeEach(() => {
    resetConversationsMock();
    window.history.replaceState({}, '', '/?mock=1');
  });

  it('starts with a tmp id and adopts the meta assistantMessageId', async () => {
    const onMeta = vi.fn();
    const { result } = renderHook(() => useQaStream({ onMeta }));

    act(() => {
      void result.current.ask('首套贷款成数上限是多少', null);
    });

    const first = result.current.turns[0];
    expect(first?.id).toBe('tmp-1');
    expect(first?.messageId).toBeNull();
    expect(result.current.streamingTurnId).toBe('tmp-1');

    await waitFor(() => expect(result.current.turns[0]?.status).toBe('done'), {
      timeout: 5000,
    });

    const turn = result.current.turns[0];
    expect(onMeta).toHaveBeenCalledTimes(1);
    expect(turn?.id).toBe('mock-assistant-2');
    expect(turn?.messageId).toBe('mock-assistant-2');
    expect(turn?.roundId).not.toBeNull();
    expect(turn?.userMessageId).not.toBeNull();
    expect(turn?.answer.length).toBeGreaterThan(0);
    expect(result.current.streamingTurnId).toBeNull();
  });

  it('keeps turns when a second question is asked in the same conversation', async () => {
    let conversationId: string | null = null;
    const { result } = renderHook(() =>
      useQaStream({
        onMeta: (meta) => {
          conversationId = meta.conversationId;
        },
      }),
    );

    await act(async () => {
      await result.current.ask('第一问', null);
    });
    await act(async () => {
      await result.current.ask('第二问', conversationId);
    });

    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[1]?.roundId).not.toBe(result.current.turns[0]?.roundId);
  });

  it('resetTurns replaces the visible history', async () => {
    const { result } = renderHook(() => useQaStream({ onMeta: vi.fn() }));
    await act(async () => {
      await result.current.ask('第一问', null);
    });
    act(() => {
      result.current.resetTurns([]);
    });
    expect(result.current.turns).toEqual([]);
  });
});
