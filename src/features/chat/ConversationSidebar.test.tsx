import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConversationSummary } from '@/api/types';
import { ConversationSidebar } from './ConversationSidebar';

const conversations: ConversationSummary[] = [
  {
    conversationId: 'c1',
    title: '首套贷款成数',
    createTime: '2026-10-21 10:00:00',
    updateTime: '2026-10-21 10:00:00',
  },
  {
    conversationId: 'c2',
    title: '抵押物评估流程',
    createTime: '2026-10-21 11:00:00',
    updateTime: '2026-10-21 11:00:00',
  },
];

function renderSidebar(overrides: Partial<ComponentProps<typeof ConversationSidebar>> = {}) {
  return render(
    <ConversationSidebar
      mode="conversation"
      conversations={conversations}
      activeConversationId="c1"
      listStatus="ready"
      listError={null}
      collapsed={false}
      onToggle={vi.fn()}
      onNewDraft={vi.fn()}
      onSelect={vi.fn()}
      onRetryLoad={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ConversationSidebar', () => {
  it('renders 新对话 and only the 最近 group', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: '新对话' })).toBeInTheDocument();
    expect(screen.getByText('最近')).toBeInTheDocument();
    expect(screen.queryByText('项目')).not.toBeInTheDocument();
  });

  it('marks the active conversation and selects another on click', () => {
    const onSelect = vi.fn();
    renderSidebar({ onSelect });
    expect(screen.getByText('首套贷款成数').closest('button')).toHaveAttribute(
      'aria-current',
      'true',
    );
    fireEvent.click(screen.getByText('抵押物评估流程'));
    expect(onSelect).toHaveBeenCalledWith('c2');
  });

  it('starts a draft without touching the list', () => {
    const onNewDraft = vi.fn();
    renderSidebar({ onNewDraft });
    fireEvent.click(screen.getByRole('button', { name: '新对话' }));
    expect(onNewDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByText('首套贷款成数')).toBeInTheDocument();
  });

  it('shows an empty hint when there is no conversation', () => {
    renderSidebar({ conversations: [], activeConversationId: null, mode: 'empty' });
    expect(screen.getByText('还没有会话，提问后会自动出现在这里。')).toBeInTheDocument();
  });

  it('shows the list error and retries', () => {
    const onRetryLoad = vi.fn();
    renderSidebar({ listStatus: 'error', listError: '会话列表加载失败', onRetryLoad });
    expect(screen.getByText('会话列表加载失败')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetryLoad).toHaveBeenCalledTimes(1);
  });

  it('renders delete buttons only when a handler is provided', () => {
    const onDelete = vi.fn();
    const { rerender } = renderSidebar();
    expect(screen.queryByRole('button', { name: /删除会话/ })).not.toBeInTheDocument();

    rerender(
      <ConversationSidebar
        mode="conversation"
        conversations={conversations}
        activeConversationId="c1"
        listStatus="ready"
        listError={null}
        collapsed={false}
        onToggle={vi.fn()}
        onNewDraft={vi.fn()}
        onSelect={vi.fn()}
        onDelete={onDelete}
        onRetryLoad={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '删除会话：抵押物评估流程' }));
    expect(onDelete).toHaveBeenCalledWith(conversations[1]);
  });
});
