import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQaStream } from './useQaStream';

const { streamSpy } = vi.hoisted(() => ({
  streamSpy: vi.fn<typeof import('@/api/qa').streamQa>(),
}));

vi.mock('@/api/qa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/qa')>();
  return { ...actual, streamQa: streamSpy };
});

const META = {
  conversationId: 'conv-7',
  roundId: 'r7',
  userMessageId: 'u7',
  assistantMessageId: 'a7',
};
const PLAN = {
  degraded: false,
  goal: '对比两家机构',
  steps: [
    { stepId: 's1', order: 1, title: '检索华信接口', tool: 'kb.search' },
    { stepId: 's2', order: 2, title: '查询客户画像', tool: 'customer.profile' },
  ],
};

describe('useQaStream 计划进度', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    streamSpy.mockReset();
  });

  it('挂载 route / plan / steps，并按 stepId 覆盖同一步骤', async () => {
    streamSpy.mockImplementationOnce(async (_conversationId, _question, handlers) => {
      handlers.onMeta(META);
      handlers.onRoute({ route: 'PLAN', confidence: 0.91 });
      handlers.onPlan(PLAN);
      handlers.onStep({ stepId: 's1', status: 'RUNNING', elapsedMillis: null });
      handlers.onStep({ stepId: 's1', status: 'DONE', elapsedMillis: 480 });
      handlers.onStep({ stepId: 's2', status: 'DEGRADED', elapsedMillis: 900 });
      handlers.onDone({ provider: 'DashScope', elapsedMillis: 1500, sourceCount: 0 });
    });

    const { result } = renderHook(() => useQaStream({ onMeta: vi.fn() }));
    await act(async () => {
      await result.current.ask('对比两家机构', null);
    });

    const turn = result.current.turns[0];
    expect(turn?.route).toEqual({ route: 'PLAN', confidence: 0.91 });
    expect(turn?.plan).toEqual(PLAN);
    expect(turn?.steps).toEqual([
      { stepId: 's1', status: 'DONE', elapsedMillis: 480 },
      { stepId: 's2', status: 'DEGRADED', elapsedMillis: 900 },
    ]);
    expect(turn?.status).toBe('done');
  });

  it('失败时保留已到达的计划与步骤', async () => {
    streamSpy.mockImplementationOnce(async (_conversationId, _question, handlers) => {
      handlers.onMeta(META);
      handlers.onRoute({ route: 'PLAN', confidence: 0.8 });
      handlers.onPlan(PLAN);
      handlers.onStep({ stepId: 's1', status: 'DONE', elapsedMillis: 300 });
      handlers.onStep({ stepId: 's2', status: 'RUNNING', elapsedMillis: null });
      handlers.onError('问答失败：模型超时');
    });

    const { result } = renderHook(() => useQaStream({ onMeta: vi.fn() }));
    await act(async () => {
      await result.current.ask('对比两家机构', null);
    });

    const turn = result.current.turns[0];
    expect(turn?.status).toBe('error');
    expect(turn?.plan?.steps).toHaveLength(2);
    expect(turn?.steps).toHaveLength(2);
    expect(result.current.streamingTurnId).toBeNull();
  });
});
