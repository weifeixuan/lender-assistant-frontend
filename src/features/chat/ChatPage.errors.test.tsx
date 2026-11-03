import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import {
  beginMockRound,
  finishMockRound,
  listConversationsMock,
  resetConversationsMock,
} from '@/api/mock';
import type { streamQa } from '@/api/qa';
import { KnowledgeProvider } from '@/lib/knowledge';
import { ChatPage } from './ChatPage';

const { streamSpy } = vi.hoisted(() => ({ streamSpy: vi.fn<typeof streamQa>() }));

vi.mock('@/api/qa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/qa')>();
  return { ...actual, streamQa: streamSpy };
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
  const expand = screen.queryByRole('button', { name: '展开会话列表' });
  if (expand) fireEvent.click(expand);
  const expandTrace = screen.queryByRole('button', { name: '展开检索过程' });
  if (expandTrace) fireEvent.click(expandTrace);
  return view;
}

function sidebar() {
  return within(screen.getByRole('list'));
}

/** 进入页面后不会自动选中会话，需要显式点开才有「当前会话」 */
async function selectConversation(title: string) {
  const list = await screen.findByRole('list');
  fireEvent.click(within(list).getByText(title).closest('button') as HTMLElement);
  await waitFor(() =>
    expect(within(list).getByText(title).closest('button')).toHaveAttribute(
      'aria-current',
      'true',
    ),
  );
}

function ask(question: string) {
  const input = screen.getByLabelText('提问内容');
  fireEvent.change(input, { target: { value: question } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('ChatPage 错误闭环', () => {
  beforeEach(async () => {
    resetConversationsMock();
    window.history.replaceState({}, '', '/?mock=1');
    const actual = await vi.importActual<typeof import('@/api/qa')>('@/api/qa');
    streamSpy.mockReset();
    streamSpy.mockImplementation(actual.streamQa);
  });

  it('404：移除会话并切走，保留服务端原文，且刷新不会带回该会话', async () => {
    seed('会话一', '回答一');
    const secondId = seed('会话二', '回答二');

    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话二')).toBeInTheDocument());
    await selectConversation('会话二');
    ask('404 已删除会话');

    await waitFor(() => expect(sidebar().queryByText('会话二')).not.toBeInTheDocument());
    expect(sidebar().getByText('会话一').closest('button')).toHaveAttribute('aria-current', 'true');
    await waitFor(() => expect(screen.getByText('会话不存在或已删除')).toBeInTheDocument());
    expect(screen.queryByText('404 已删除会话')).not.toBeInTheDocument();

    const list = await listConversationsMock();
    expect(list.map((item) => item.conversationId)).not.toContain(secondId);
  });

  it('409：回滚本轮气泡并把原问题放回输入框，不自动重试', async () => {
    seed('会话一', '回答一');
    seed('会话二', '回答二');

    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话二')).toBeInTheDocument());
    await selectConversation('会话二');
    ask('409 正在生成');

    await waitFor(() =>
      expect(screen.getByText('该会话正在生成回答，请稍后')).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('提问内容')).toHaveValue('409 正在生成');
    expect(screen.queryByText('409 正在生成', { ignore: 'textarea' })).toBeNull();
    expect(sidebar().getByText('会话二')).toBeInTheDocument();
    expect(streamSpy).toHaveBeenCalledTimes(1);
  });

  it('400：回滚本轮气泡、回填输入并展示服务端原文', async () => {
    seed('会话一', '回答一');

    streamSpy.mockRejectedValueOnce(new ApiError('请求参数不合法', 400, 400));
    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话一')).toBeInTheDocument());
    ask('参数有误的问题');

    await waitFor(() => expect(screen.getByText('请求参数不合法')).toBeInTheDocument());
    expect(screen.getByLabelText('提问内容')).toHaveValue('参数有误的问题');
    expect(screen.queryByText('参数有误的问题', { ignore: 'textarea' })).toBeNull();
    expect(streamSpy).toHaveBeenCalledTimes(1);
  });

  it('5xx：保留本轮错误气泡并给出重试，不丢失问题', async () => {
    seed('会话一', '回答一');

    streamSpy.mockRejectedValueOnce(new ApiError('模型服务暂不可用', 500, 500));
    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话一')).toBeInTheDocument());
    ask('会失败的问题');

    await waitFor(() => expect(screen.getByText('模型服务暂不可用')).toBeInTheDocument());
    expect(screen.getByText('会失败的问题')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(streamSpy).toHaveBeenCalledTimes(1);
  });

  it('流中网络中断：保留已到达正文并给出重试', async () => {
    seed('会话一', '回答一');

    renderChat();
    await waitFor(() => expect(sidebar().getByText('会话一')).toBeInTheDocument());
    ask('断网测试');

    await waitFor(
      () => expect(screen.getByText(/首套贷款成数上限为八成/)).toBeInTheDocument(),
      { timeout: 3000 },
    );
    await waitFor(() => expect(screen.getByText(/连接中断/)).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('来源明细')).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('草稿首问网络失败保持草稿，重试仍按首问创建会话', async () => {
    streamSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderChat();
    await waitFor(() =>
      expect(screen.getByText('还没有会话，提问后会自动出现在这里。')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    ask('草稿首问');

    await waitFor(() => expect(screen.getByText(/连接中断/)).toBeInTheDocument());
    expect(screen.getByText('草稿未保存')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(sidebar().getByText('草稿首问').closest('button')).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
