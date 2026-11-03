import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import {
  beginMockRound,
  finishMockRound,
  listConversationsMock,
  listMessagesMock,
  resetConversationsMock,
} from '@/api/mock';
import type { ConversationSummary, MessageList } from '@/api/types';
import { KnowledgeProvider } from '@/lib/knowledge';
import { ChatPage } from './ChatPage';

const { historySpy, listSpy } = vi.hoisted(() => ({
  historySpy: vi.fn<(conversationId: string, signal?: AbortSignal) => Promise<MessageList>>(),
  listSpy: vi.fn<() => Promise<ConversationSummary[]>>(),
}));

vi.mock('@/api/conversations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/conversations')>();
  return { ...actual, listMessages: historySpy, listConversations: listSpy };
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

function renderChatRaw() {
  render(
    <MemoryRouter>
      <KnowledgeProvider>
        <ChatPage />
      </KnowledgeProvider>
    </MemoryRouter>,
  );
}

/** 若侧栏仍处于收起态则展开，保证断言能查到列表 */
function renderChat() {
  renderChatRaw();
  const expand = screen.queryByRole('button', { name: '展开会话列表' });
  if (expand) fireEvent.click(expand);
}

function clickConversation(title: string) {
  fireEvent.click(sidebar().getByText(title).closest('button') as HTMLElement);
}

function sidebar() {
  return within(screen.getByRole('list'));
}

describe('ChatPage 启动引导', () => {
  beforeEach(() => {
    resetConversationsMock();
    window.history.replaceState({}, '', '/?mock=1');
    historySpy.mockReset();
    historySpy.mockImplementation((conversationId, signal) =>
      listMessagesMock(conversationId, signal),
    );
    listSpy.mockReset();
    listSpy.mockImplementation(() => listConversationsMock());
  });

  it('进入页面：列表渲染但不选中会话，也不请求历史', async () => {
    seed('会话一', '回答一');

    renderChat();

    await waitFor(() => expect(sidebar().getByText('会话一')).toBeInTheDocument());
    expect(sidebar().getByText('会话一').closest('button')).not.toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(historySpy).not.toHaveBeenCalled();
    expect(screen.getByText('开始一次知识库对话')).toBeInTheDocument();
  });

  it('点击第一个会话：真正请求历史并渲染正文', async () => {
    const firstId = seed('会话一', '回答一');
    seed('会话二', '回答二');

    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话一')).toBeInTheDocument());
    expect(historySpy).not.toHaveBeenCalled();

    clickConversation('会话一');

    await waitFor(() => expect(historySpy).toHaveBeenCalledWith(firstId, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByText('回答一')).toBeInTheDocument());
    expect(sidebar().getByText('会话一').closest('button')).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('左栏默认展开', async () => {
    seed('会话一', '回答一');

    renderChatRaw();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '收起会话列表' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: '展开会话列表' })).not.toBeInTheDocument();
  });

  it('历史加载 404：移除会话、切到下一项并给出提示', async () => {
    seed('会话一', '回答一');
    const secondId = seed('会话二', '回答二');
    historySpy.mockImplementation((conversationId, signal) =>
      conversationId === secondId
        ? Promise.reject(new ApiError('会话不存在或已删除', 404, 404))
        : listMessagesMock(conversationId, signal),
    );

    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话二')).toBeInTheDocument());
    clickConversation('会话二');

    await waitFor(() => expect(sidebar().queryByText('会话二')).not.toBeInTheDocument());
    expect(sidebar().getByText('会话一').closest('button')).toHaveAttribute('aria-current', 'true');
    await waitFor(() =>
      expect(screen.getByText('该会话已不存在，已从列表移除')).toBeInTheDocument(),
    );
    expect(screen.getByText('回答一')).toBeInTheDocument();
    expect(screen.queryByText('回答二')).not.toBeInTheDocument();
  });

  it('列表加载失败后重试：恢复列表并停在空态，点条目才加载历史', async () => {
    seed('会话一', '回答一');
    listSpy.mockRejectedValueOnce(new ApiError('会话列表加载失败', 500, 500));

    renderChat();

    await waitFor(() => expect(screen.getByText('会话列表加载失败')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(sidebar().getByText('会话一')).toBeInTheDocument());
    expect(sidebar().getByText('会话一').closest('button')).not.toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByText('开始一次知识库对话')).toBeInTheDocument();
    expect(historySpy).not.toHaveBeenCalled();

    clickConversation('会话一');

    await waitFor(() => expect(screen.getByText('回答一')).toBeInTheDocument());
    expect(screen.queryByText('这个会话还没有内容')).not.toBeInTheDocument();
    expect(sidebar().getByText('会话一').closest('button')).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('discards the draft text when switching to an existing conversation', async () => {
    seed('会话一', '回答一');
    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话一')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '新对话' }));
    const input = screen.getByLabelText('提问内容');
    fireEvent.change(input, { target: { value: '还没发出去的草稿' } });
    expect(input).toHaveValue('还没发出去的草稿');

    fireEvent.click(sidebar().getByText('会话一').closest('button') as HTMLElement);
    await waitFor(() => expect(screen.getByLabelText('提问内容')).toHaveValue(''));
  });

  it('keeps the draft mode when the list response arrives after the user switched', async () => {
    seed('会话一', '回答一');
    let release: ((list: ConversationSummary[]) => void) | null = null;
    listSpy.mockImplementationOnce(
      () =>
        new Promise<ConversationSummary[]>((resolve) => {
          release = resolve;
        }),
    );

    renderChat();
    fireEvent.click(screen.getByRole('button', { name: '新对话' }));
    expect(screen.getByText('草稿未保存')).toBeInTheDocument();

    const list = await listConversationsMock();
    await act(async () => {
      release?.(list);
    });

    expect(screen.getByText('草稿未保存')).toBeInTheDocument();
    expect(sidebar().getByText('会话一').closest('button')).not.toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('晚到的历史响应不会并进随后创建的新会话', async () => {
    const firstId = seed('会话一', '回答一');
    const firstHistory = await listMessagesMock(firstId);
    let releaseHistory: ((messages: MessageList) => void) | null = null;
    historySpy.mockImplementationOnce(
      () =>
        new Promise<MessageList>((resolve) => {
          releaseHistory = resolve;
        }),
    );

    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话一')).toBeInTheDocument());

    clickConversation('会话一');
    fireEvent.click(screen.getByRole('button', { name: '新对话' }));
    const input = screen.getByLabelText('提问内容');
    fireEvent.change(input, { target: { value: '首问' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(sidebar().getByText('首问')).toBeInTheDocument());

    await act(async () => {
      releaseHistory?.(firstHistory);
    });

    await waitFor(() => expect(screen.queryByText('回答一')).not.toBeInTheDocument());
    expect(sidebar().getByText('首问').closest('button')).toHaveAttribute('aria-current', 'true');
  });
});
