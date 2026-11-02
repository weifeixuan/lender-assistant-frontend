import { useCallback, useState } from 'react';
import { ApiError } from '@/api/client';
import { deleteConversation, listConversations } from '@/api/conversations';
import type { ConversationSummary } from '@/api/types';
import { formatDateTime } from '@/lib/format';

export type ChatMode = 'empty' | 'draft' | 'conversation';
export type ListStatus = 'loading' | 'ready' | 'error';
export type DeleteOutcome = 'deleted' | 'missing';

/**
 * 侧栏会话列表与模式状态。
 * mode 显式区分空态 / 草稿态 / 会话态，避免用 activeConversationId === null 同时表达两者。
 */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [mode, setMode] = useState<ChatMode>('empty');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [listStatus, setListStatus] = useState<ListStatus>('loading');
  const [listError, setListError] = useState<string | null>(null);

  /** 首次加载：非空时自动选中首项，返回该 id 供调用方加载历史 */
  const load = useCallback(async (): Promise<string | null> => {
    setListStatus('loading');
    setListError(null);
    try {
      const list = await listConversations();
      setConversations(list);
      setListStatus('ready');
      if (list.length > 0) {
        const first = list[0];
        setMode('conversation');
        setActiveConversationId(first.conversationId);
        return first.conversationId;
      }
      setMode('empty');
      setActiveConversationId(null);
      return null;
    } catch (cause) {
      setListStatus('error');
      setListError(cause instanceof Error ? cause.message : '会话列表加载失败');
      return null;
    }
  }, []);

  /** 每轮结束后的静默刷新：失败不改变当前视图 */
  const refresh = useCallback(async () => {
    try {
      const list = await listConversations();
      setConversations(list);
      setListStatus('ready');
      setListError(null);
    } catch {
      // 列表刷新失败不影响当前对话
    }
  }, []);

  const startDraft = useCallback(() => {
    setMode('draft');
    setActiveConversationId(null);
  }, []);

  const select = useCallback((conversationId: string) => {
    setMode('conversation');
    setActiveConversationId(conversationId);
  }, []);

  /** 首问收到 meta 后转正：插入乐观条目，等下一轮列表刷新覆盖 */
  const adopt = useCallback((conversationId: string, title: string) => {
    setMode('conversation');
    setActiveConversationId(conversationId);
    setConversations((previous) => {
      if (previous.some((item) => item.conversationId === conversationId)) return previous;
      const now = formatDateTime(new Date());
      return [
        { conversationId, title, createTime: now, updateTime: now },
        ...previous,
      ];
    });
  }, []);

  const removeLocal = useCallback((conversationId: string) => {
    setConversations((previous) =>
      previous.filter((item) => item.conversationId !== conversationId),
    );
    setActiveConversationId((current) => (current === conversationId ? null : current));
  }, []);

  const enterEmpty = useCallback(() => {
    setMode('empty');
    setActiveConversationId(null);
  }, []);

  /** 软删会话；404 视为已删除（幂等），其余错误原样抛出 */
  const remove = useCallback(
    async (conversationId: string): Promise<DeleteOutcome> => {
      try {
        await deleteConversation(conversationId);
        removeLocal(conversationId);
        return 'deleted';
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) {
          removeLocal(conversationId);
          return 'missing';
        }
        throw cause;
      }
    },
    [removeLocal],
  );

  return {
    mode,
    activeConversationId,
    conversations,
    listStatus,
    listError,
    load,
    refresh,
    startDraft,
    select,
    adopt,
    remove,
    removeLocal,
    enterEmpty,
  };
}
