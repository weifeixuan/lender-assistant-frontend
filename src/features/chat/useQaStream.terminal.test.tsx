import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QaDone } from '@/api/types';
import { useQaStream } from './useQaStream';

const { streamSpy } = vi.hoisted(() => ({
  streamSpy: vi.fn<typeof import('@/api/qa').streamQa>(),
}));

vi.mock('@/api/qa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/qa')>();
  return { ...actual, streamQa: streamSpy };
});

function sseBody(blocks: string[]): string {
  return `${blocks.join('\n\n')}\n\n`;
}

const META = 'event: meta\ndata: {"conversationId":"conv-9","roundId":"r9","userMessageId":"u9","assistantMessageId":"a9"}';
const DONE: QaDone = { provider: 'DashScope', elapsedMillis: 900, sourceCount: 0 };

describe('useQaStream 终态兜底', () => {
  beforeEach(async () => {
    window.history.replaceState({}, '', '/');
    const actual = await vi.importActual<typeof import('@/api/qa')>('@/api/qa');
    streamSpy.mockReset();
    streamSpy.mockImplementation(actual.streamQa);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks the round as error when the stream closes without a done event', async () => {
    const body = sseBody([
      META,
      'event: sources\ndata: []',
      'event: delta\ndata: 半截正文',
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));

    const { result } = renderHook(() => useQaStream({ onMeta: vi.fn() }));
    await act(async () => {
      await result.current.ask('任意问题', null);
    });

    const turn = result.current.turns[0];
    expect(turn?.status).toBe('error');
    expect(turn?.error).toContain('连接提前结束');
    expect(result.current.streamingTurnId).toBeNull();
  });

  it('marks the round as error when the done payload cannot be parsed', async () => {
    const body = sseBody([META, 'event: delta\ndata: 正文', 'event: done\ndata: {}']);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));

    const { result } = renderHook(() => useQaStream({ onMeta: vi.fn() }));
    await act(async () => {
      await result.current.ask('任意问题', null);
    });

    const turn = result.current.turns[0];
    expect(turn?.status).toBe('error');
    expect(turn?.error).toContain('响应协议异常');
    expect(result.current.streamingTurnId).toBeNull();
  });

  it('keeps a finished round done when the controller aborts afterwards', async () => {
    streamSpy.mockImplementationOnce(async (_conversationId, _question, handlers) => {
      handlers.onMeta({
        conversationId: 'conv-9',
        roundId: 'r9',
        userMessageId: 'u9',
        assistantMessageId: 'a9',
      });
      handlers.onDone(DONE);
      throw new DOMException('Aborted', 'AbortError');
    });

    const { result } = renderHook(() => useQaStream({ onMeta: vi.fn() }));
    await act(async () => {
      await result.current.ask('任意问题', null);
    });

    const turn = result.current.turns[0];
    expect(turn?.status).toBe('done');
    expect(turn?.meta).toEqual(DONE);
  });
});
