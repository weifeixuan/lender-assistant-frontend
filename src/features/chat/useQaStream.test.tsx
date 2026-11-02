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

  it('stop keeps the partial answer and arrived sources', async () => {
    const { result } = renderHook(() => useQaStream({ onMeta: vi.fn() }));
    act(() => {
      void result.current.ask('首套贷款成数上限是多少', null);
    });

    await waitFor(() => expect(result.current.turns[0]?.answer.length).toBeGreaterThan(0), {
      timeout: 4000,
    });
    act(() => {
      result.current.stop();
    });

    await waitFor(() => expect(result.current.turns[0]?.status).toBe('stopped'));
    const stopped = result.current.turns[0];
    expect(stopped?.answer.length).toBeGreaterThan(0);
    expect(stopped?.sources.length).toBeGreaterThan(0);
    expect(result.current.streamingTurnId).toBeNull();
  });

  it('marks error on an SSE error event and keeps sources', async () => {
    const { result } = renderHook(() => useQaStream({ onMeta: vi.fn() }));
    await act(async () => {
      await result.current.ask('请模拟生成失败', null);
    });

    const failed = result.current.turns[0];
    expect(failed?.status).toBe('error');
    expect(failed?.error).toContain('模拟生成失败');
    expect(failed?.answer.length).toBeGreaterThan(0);
    expect(failed?.sources.length).toBeGreaterThan(0);
    expect(result.current.streamingTurnId).toBeNull();
  });

  it('treats empty recall as a normal done round', async () => {
    const { result } = renderHook(() => useQaStream({ onMeta: vi.fn() }));
    await act(async () => {
      await result.current.ask('没有资料的问题', null);
    });

    const turn = result.current.turns[0];
    expect(turn?.status).toBe('done');
    expect(turn?.sources).toEqual([]);
    expect(turn?.meta?.sourceCount).toBe(0);
    expect(turn?.error).toBeNull();
  });

  it('retry starts a new round without touching the failed one', async () => {
    let conversationId: string | null = null;
    const { result } = renderHook(() =>
      useQaStream({
        onMeta: (meta) => {
          conversationId = meta.conversationId;
        },
      }),
    );

    await act(async () => {
      await result.current.ask('请模拟生成失败', null);
    });
    const failedRoundId = result.current.turns[0]?.roundId;

    await act(async () => {
      await result.current.ask('请模拟生成失败', conversationId);
    });

    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[0]?.status).toBe('error');
    expect(result.current.turns[0]?.roundId).toBe(failedRoundId);
    expect(result.current.turns[1]?.status).toBe('done');
    expect(result.current.turns[1]?.roundId).not.toBe(failedRoundId);
  });
});
