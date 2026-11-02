import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Thread } from './Thread';
import type { Turn } from './useQaStream';

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
    origin: 'history',
    createTime: '2026-10-21 10:00:00',
    ...overrides,
  };
}

function renderThread(turns: Turn[]) {
  return render(
    <Thread turns={turns} onCite={vi.fn()} onRetry={vi.fn()} onStop={vi.fn()} />,
  );
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
      <Thread turns={[turn({ status: 'error', error: '模型超时' })]} onCite={vi.fn()} onRetry={onRetry} onStop={vi.fn()} />,
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
});
