import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import {
  beginMockRound,
  finishMockRound,
  listMessagesMock,
  resetConversationsMock,
} from '@/api/mock';
import type { DocSummary, MessageList } from '@/api/types';
import { KnowledgeProvider } from '@/lib/knowledge';
import { ChatPage } from './ChatPage';

const { historySpy, documentsSpy } = vi.hoisted(() => ({
  historySpy: vi.fn<(conversationId: string, signal?: AbortSignal) => Promise<MessageList>>(),
  documentsSpy: vi.fn<() => Promise<DocSummary[]>>(),
}));

vi.mock('@/api/conversations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/conversations')>();
  return { ...actual, listMessages: historySpy };
});

vi.mock('@/api/documents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/documents')>();
  return { ...actual, listDocuments: documentsSpy };
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
  render(
    <MemoryRouter>
      <KnowledgeProvider>
        <ChatPage />
      </KnowledgeProvider>
    </MemoryRouter>,
  );
  const expand = screen.queryByRole('button', { name: '展开会话列表' });
  if (expand) fireEvent.click(expand);
}

function sidebar() {
  return within(screen.getByRole('list'));
}

function clickConversation(title: string) {
  fireEvent.click(sidebar().getByText(title).closest('button') as HTMLElement);
}

describe('ChatPage 数据加载失败', () => {
  beforeEach(() => {
    resetConversationsMock();
    window.history.replaceState({}, '', '/?mock=1');
    historySpy.mockReset();
    historySpy.mockImplementation((conversationId, signal) =>
      listMessagesMock(conversationId, signal),
    );
    documentsSpy.mockReset();
    documentsSpy.mockResolvedValue([]);
  });

  it('shows an independent history failure state instead of the empty copy', async () => {
    seed('会话一', '回答一');
    historySpy.mockRejectedValue(new ApiError('历史消息读取失败', 500, 500));

    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话一')).toBeInTheDocument());
    clickConversation('会话一');

    await waitFor(() => expect(screen.getByText('会话历史加载失败')).toBeInTheDocument());
    expect(screen.getByText('历史消息读取失败')).toBeInTheDocument();
    expect(screen.queryByText('这个会话还没有内容')).not.toBeInTheDocument();

    historySpy.mockImplementation((conversationId, signal) =>
      listMessagesMock(conversationId, signal),
    );
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(screen.getByText('回答一')).toBeInTheDocument());
    expect(screen.queryByText('会话历史加载失败')).not.toBeInTheDocument();
  });

  it('surfaces a failed knowledge overview with retry instead of zero counts', async () => {
    documentsSpy.mockRejectedValue(new ApiError('文档列表加载失败', 500, 500));

    renderChat();

    await waitFor(() =>
      expect(screen.getByText(/知识库规模读取失败：文档列表加载失败/)).toBeInTheDocument(),
    );
    expect(screen.getByText('概览读取失败')).toBeInTheDocument();
    expect(screen.queryByText(/当前知识库/)).not.toBeInTheDocument();

    documentsSpy.mockResolvedValue([]);
    const retryButtons = screen.getAllByRole('button', { name: '重试' });
    fireEvent.click(retryButtons[0] as HTMLElement);

    await waitFor(() => expect(screen.getByText(/当前知识库 0 份文档/)).toBeInTheDocument());
    expect(screen.queryByText(/知识库规模读取失败/)).not.toBeInTheDocument();
  });
});
