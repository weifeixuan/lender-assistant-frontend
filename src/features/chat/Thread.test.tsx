import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QaSource } from '@/api/types';
import { Thread } from './Thread';
import type { Turn } from './useQaStream';

function source(idx: number): QaSource {
  return {
    idx,
    docTitle: `文档${idx}`,
    sectionPath: null,
    chunkId: idx,
    content: '切片内容',
    vectorDistance: 0.123,
    keywordHits: null,
    bothChannels: false,
    rrfScore: '0.01234',
  };
}

function turn(overrides: Partial<Turn>): Turn {
  return {
    id: 'a1',
    messageId: 'a1',
    roundId: 'r1',
    userMessageId: 'u1',
    question: '问题',
    answer: '答案',
    sources: [],
    status: 'done',
    error: null,
    meta: null,
    route: null,
    plan: null,
    steps: [],
    origin: 'history',
    createTime: '2026-10-21 10:00:00',
    ...overrides,
  };
}

function renderThread(turns: Turn[]) {
  return render(<Thread turns={turns} onCite={vi.fn()} onRetry={vi.fn()} onStop={vi.fn()} />);
}

describe('Thread 历史态', () => {
  it('shows 未召回 for a DONE round without sources', () => {
    renderThread([turn({ meta: { provider: 'DashScope', elapsedMillis: 500, sourceCount: 0 } })]);
    expect(screen.getByText('未召回')).toBeInTheDocument();
    expect(screen.queryByText('回答生成中')).not.toBeInTheDocument();
  });

  it('shows the server error and retries the same question', () => {
    const onRetry = vi.fn();
    render(
      <Thread
        turns={[turn({ status: 'error', error: '模型超时' })]}
        onCite={vi.fn()}
        onRetry={onRetry}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText('模型超时')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledWith('问题');
  });

  it('shows 已停止 for STOPPED and keeps partial content', () => {
    renderThread([turn({ status: 'stopped', answer: '半截回答' })]);
    expect(screen.getByText('已停止')).toBeInTheDocument();
    expect(screen.getByText(/半截回答/)).toBeInTheDocument();
    expect(screen.queryByText('停止')).not.toBeInTheDocument();
  });

  it('renders — for missing provider and elapsed on failed history rounds', () => {
    renderThread([
      turn({ id: 'a2', status: 'error', error: '模型超时' }),
      turn({ id: 'a3', status: 'stopped' }),
    ]);
    expect(screen.getAllByText(/耗时 —/)).toHaveLength(2);
  });

  it('does not offer retry while a round is streaming', () => {
    const onRetry = vi.fn();
    render(
      <Thread
        turns={[turn({ status: 'error', error: '模型超时' })]}
        onCite={vi.fn()}
        onRetry={onRetry}
        onStop={vi.fn()}
        retryDisabled
      />,
    );
    const retry = screen.getByRole('button', { name: '重试' });
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('shows the footer for live failed/stopped rounds and hides citations only when stopped', () => {
    renderThread([
      turn({
        id: 'live-failed',
        origin: 'live',
        status: 'error',
        error: '模型超时',
        sources: [source(1), source(2)],
      }),
      turn({
        id: 'live-stopped',
        origin: 'live',
        status: 'stopped',
        sources: [source(1), source(2)],
      }),
    ]);

    expect(screen.getAllByText(/耗时 —/)).toHaveLength(2);
    expect(screen.getAllByText(/引用 2 条/)).toHaveLength(1);
    const stoppedFooter = screen.getAllByText(/耗时 —/).at(1);
    expect(within(stoppedFooter as HTMLElement).queryByText(/引用/)).not.toBeInTheDocument();
  });
});
