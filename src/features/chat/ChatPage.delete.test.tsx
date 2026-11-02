import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import {
  beginMockRound,
  deleteConversationMock,
  finishMockRound,
  resetConversationsMock,
} from '@/api/mock';
import type { ConversationDeleteResult } from '@/api/types';
import { KnowledgeProvider } from '@/lib/knowledge';
import { ChatPage } from './ChatPage';

const { deleteSpy } = vi.hoisted(() => ({
  deleteSpy: vi.fn<(conversationId: string) => Promise<ConversationDeleteResult>>(),
}));

vi.mock('@/api/conversations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/conversations')>();
  return { ...actual, deleteConversation: deleteSpy };
});

function seed(question: string, answer: string): string {
  const round = beginMockRound(null, question);
  finishMockRound(round, {
    status: 'DONE',
    content: answer,
    sources: [],
    provider: 'mock',
    elapsedMillis: 100,
    error: null,
  });
  return round.conversationId;
}

function renderChat() {
  const view = render(
    <MemoryRouter>
      <KnowledgeProvider>
        <ChatPage />
      </KnowledgeProvider>
    </MemoryRouter>,
  );
  // jsdom 宽度小于 1280，侧栏默认收起；测试里先展开
  const expand = screen.queryByRole('button', { name: '展开会话列表' });
  if (expand) fireEvent.click(expand);
  return view;
}

/** 侧栏列表是页面上唯一的 ul，用它限定查询，避免与对话正文里的同名问题文本混淆 */
function sidebar() {
  return within(screen.getByRole('list'));
}

async function openDeleteDialog(title: string) {
  const list = await screen.findByRole('list');
  const button = await within(list).findByRole('button', { name: `删除会话：${title}` });
  act(() => button.focus());
  fireEvent.click(button);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  return button;
}

describe('ChatPage 删除会话', () => {
  beforeEach(() => {
    resetConversationsMock();
    window.history.replaceState({}, '', '/?mock=1');
    deleteSpy.mockReset();
    deleteSpy.mockImplementation((conversationId) => deleteConversationMock(conversationId));
  });

  it('opens the confirm dialog without sending DELETE, and returns focus on cancel', async () => {
    seed('会话一', '回答一');
    seed('会话二', '回答二');

    renderChat();
    const trigger = await openDeleteDialog('会话一');

    expect(screen.getByRole('dialog')).toHaveTextContent('会话一');
    expect(screen.getByRole('dialog')).toHaveTextContent('删除后不可恢复');
    expect(deleteSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(sidebar().getByText('会话一')).toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('deletes the current conversation and switches to the remaining one', async () => {
    seed('会话一', '回答一');
    const secondId = seed('会话二', '回答二');

    renderChat();
    await openDeleteDialog('会话二');
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => expect(sidebar().queryByText('会话二')).not.toBeInTheDocument());
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith(secondId);

    await waitFor(() =>
      expect(sidebar().getByText('会话一').closest('button')).toHaveAttribute(
        'aria-current',
        'true',
      ),
    );
    await waitFor(() => expect(screen.getByText('回答一')).toBeInTheDocument());
  });

  it('keeps the current conversation when another one is deleted', async () => {
    const firstId = seed('会话一', '回答一');
    seed('会话二', '回答二');

    renderChat();
    await openDeleteDialog('会话一');
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => expect(sidebar().queryByText('会话一')).not.toBeInTheDocument());
    expect(deleteSpy).toHaveBeenCalledWith(firstId);
    expect(sidebar().getByText('会话二').closest('button')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('回答二')).toBeInTheDocument();
  });

  it('keeps the dialog and the entry when deletion fails, showing the server message', async () => {
    seed('会话一', '回答一');
    seed('会话二', '回答二');

    deleteSpy.mockRejectedValueOnce(new ApiError('服务繁忙，请稍后重试', 500, 500));
    renderChat();
    await openDeleteDialog('会话一');
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() =>
      expect(screen.getByRole('dialog')).toHaveTextContent('服务繁忙，请稍后重试'),
    );
    expect(sidebar().getByText('会话一')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('treats a 404 as already deleted and removes the entry', async () => {
    seed('会话一', '回答一');
    const secondId = seed('会话二', '回答二');

    renderChat();
    await openDeleteDialog('会话二');
    await act(async () => {
      await deleteConversationMock(secondId);
    });
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => expect(sidebar().queryByText('会话二')).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/已不存在/)).toBeInTheDocument());
  });

  it('adds no draft entry while the 新对话 list stays deletable', async () => {
    seed('会话一', '回答一');
    seed('会话二', '回答二');

    renderChat();
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: '新对话' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('草稿未保存')).toBeInTheDocument();
  });
});
