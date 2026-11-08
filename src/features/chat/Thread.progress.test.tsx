import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QaPlan, QaPlanStep, QaStep } from '@/api/types';
import { Thread } from './Thread';
import type { Turn } from './useQaStream';

function step(overrides: Partial<QaPlanStep> & Pick<QaPlanStep, 'stepId' | 'order'>): QaPlanStep {
  return { title: `步骤${overrides.order}`, tool: 'kb.search', ...overrides };
}

function plan(steps: QaPlanStep[], degraded = false): QaPlan {
  return { degraded, goal: '对比两家机构', steps };
}

function turn(overrides: Partial<Turn>): Turn {
  return {
    id: 'a1',
    messageId: 'a1',
    roundId: 'r1',
    userMessageId: 'u1',
    question: '问题',
    answer: '',
    sources: [],
    status: 'streaming',
    error: null,
    meta: null,
    origin: 'live',
    createTime: null,
    route: null,
    plan: null,
    steps: [],
    ...overrides,
  };
}

function renderThread(turns: Turn[]) {
  return render(<Thread turns={turns} onCite={vi.fn()} onRetry={vi.fn()} onStop={vi.fn()} />);
}

const THREE_STEPS = [
  step({ stepId: 's1', order: 1, title: '检索华信接口' }),
  step({ stepId: 's2', order: 2, title: '查询客户画像' }),
  step({ stepId: 's3', order: 3, title: '汇总结论' }),
];

const running: QaStep = { stepId: 's1', status: 'RUNNING', elapsedMillis: null };

describe('Thread 执行进度', () => {
  it('PLAN 路由到达但计划未到：显示「正在规划」', () => {
    renderThread([turn({ route: { route: 'PLAN', confidence: 0.9 } })]);
    expect(screen.getByText('正在规划')).toBeInTheDocument();
  });

  it('KNOWLEDGE 路由不产生额外提示', () => {
    renderThread([turn({ route: { route: 'KNOWLEDGE', confidence: 0.9 } })]);
    expect(screen.queryByText('正在规划')).not.toBeInTheDocument();
  });

  it('计划只渲染一次，给出步骤数与步骤标题', () => {
    renderThread([
      turn({
        route: { route: 'PLAN', confidence: 0.9 },
        plan: plan(THREE_STEPS),
        steps: [running],
      }),
    ]);

    expect(screen.getAllByText('计划 3 步')).toHaveLength(1);
    expect(screen.getByText('检索华信接口')).toBeInTheDocument();
    expect(screen.getByText('查询客户画像')).toBeInTheDocument();
    expect(screen.getByText('汇总结论')).toBeInTheDocument();
  });

  it('按 step.order 排序渲染，不依赖后端数组顺序', () => {
    renderThread([
      turn({
        plan: plan([THREE_STEPS[2], THREE_STEPS[0], THREE_STEPS[1]]),
        steps: [running],
      }),
    ]);

    const titles = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(titles[0]).toContain('检索华信接口');
    expect(titles[1]).toContain('查询客户画像');
    expect(titles[2]).toContain('汇总结论');
    expect(titles[0]).toMatch(/1\./);
  });

  it('按 stepId 展示各步骤状态与耗时，状态样式可区分', () => {
    renderThread([
      turn({
        plan: plan(THREE_STEPS),
        steps: [
          { stepId: 's1', status: 'DONE', elapsedMillis: 480 },
          { stepId: 's2', status: 'FAILED', elapsedMillis: 120 },
          { stepId: 's3', status: 'SKIPPED', elapsedMillis: null },
        ],
      }),
    ]);

    expect(screen.getByText('完成')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('已跳过')).toBeInTheDocument();
    expect(screen.getByText(/480 ms/)).toBeInTheDocument();
    expect(screen.getByText(/120 ms/)).toBeInTheDocument();
  });

  it('降级与已中止也能区分', () => {
    renderThread([
      turn({
        status: 'stopped',
        plan: plan(THREE_STEPS),
        steps: [
          { stepId: 's1', status: 'DEGRADED', elapsedMillis: 900 },
          { stepId: 's2', status: 'RUNNING', elapsedMillis: null },
        ],
      }),
    ]);

    expect(screen.getByText('降级')).toBeInTheDocument();
    expect(screen.queryByText('运行中')).not.toBeInTheDocument();
    expect(screen.getByText('已中止')).toBeInTheDocument();
  });

  it('首个 delta 到达后从进度切到正文流式渲染', () => {
    const { rerender } = renderThread([turn({ plan: plan(THREE_STEPS), steps: [running] })]);
    expect(screen.getByText('计划 3 步')).toBeInTheDocument();

    rerender(
      <Thread
        turns={[turn({ answer: '正文第一段', plan: plan(THREE_STEPS), steps: [running] })]}
        onCite={vi.fn()}
        onRetry={vi.fn()}
        onStop={vi.fn()}
      />,
    );
    expect(screen.queryByText('计划 3 步')).not.toBeInTheDocument();
    expect(screen.getByText(/正文第一段/)).toBeInTheDocument();
  });

  it('失败时进度收敛为终态，不残留「运行中」', () => {
    renderThread([
      turn({
        status: 'error',
        error: '问答失败：模型超时',
        plan: plan(THREE_STEPS),
        steps: [
          { stepId: 's1', status: 'DONE', elapsedMillis: 300 },
          { stepId: 's2', status: 'RUNNING', elapsedMillis: null },
        ],
      }),
    ]);

    expect(screen.getByText('问答失败：模型超时')).toBeInTheDocument();
    expect(screen.queryByText('运行中')).not.toBeInTheDocument();
    expect(screen.getByText('已中止')).toBeInTheDocument();
  });

  it('IRRELEVANT 规则轮显示「规则提示」，不显示模型名、引用条数与未召回', () => {
    renderThread([
      turn({
        status: 'done',
        answer: '这个问题与知识库无关。',
        meta: { provider: 'rule', elapsedMillis: 12, sourceCount: 0 },
      }),
    ]);

    expect(screen.getByText(/规则提示/)).toBeInTheDocument();
    expect(screen.queryByText(/引用/)).not.toBeInTheDocument();
    expect(screen.queryByText('未召回')).not.toBeInTheDocument();
    expect(screen.queryByText(/rule/)).not.toBeInTheDocument();
  });

  it('非规则轮 sourceCount 为 0 时保留未召回文案，且不显示「引用 0 条」', () => {
    renderThread([
      turn({
        status: 'done',
        answer: '暂时没有相关资料。',
        meta: { provider: 'DashScope', elapsedMillis: 800, sourceCount: 0 },
      }),
    ]);

    expect(screen.getByText('未召回')).toBeInTheDocument();
    expect(screen.queryByText(/引用 0 条/)).not.toBeInTheDocument();
  });
});
