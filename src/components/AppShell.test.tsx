import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, type ShellSummary } from './AppShell';

function renderShell(summary: ShellSummary) {
  render(
    <MemoryRouter>
      <AppShell activeLabel="文档管理" summary={summary}>
        <div>主体内容</div>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell 知识库概览', () => {
  it('shows document and chunk counts after a successful load', () => {
    renderShell({
      docCount: 3,
      chunkCount: 12,
      lastIngestedAt: '2026-10-28 16:20:00',
      loading: false,
      error: null,
    });

    expect(screen.getByText(/最近入库/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.queryByText('概览读取失败')).not.toBeInTheDocument();
  });

  it('shows a readable failure with retry instead of zero counts', () => {
    const onRetry = vi.fn();
    renderShell({
      docCount: 0,
      chunkCount: 0,
      lastIngestedAt: null,
      loading: false,
      error: '文档列表加载失败',
      onRetry,
    });

    expect(screen.getByText('概览读取失败')).toBeInTheDocument();
    expect(screen.queryByText(/最近入库/)).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
