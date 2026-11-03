import { useCallback, useRef, useState } from 'react';
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
  /** 同步镜像：并发回调（首屏历史晚于切换返回）里读不到最新 state，只能读 ref */
  const conversationsRef = useRef<ConversationSummary[]>([]);
  const activeIdRef = useRef<string | null>(null);
  /** 模式同步镜像：列表响应晚到时要判断用户是否已经改变了模式 */
  const modeRef = useRef<ChatMode>('empty');

  const setChatMode = useCallback((next: ChatMode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  /** 首次加载：非空时自动选中首项，返回该 id 供调用方加载历史 */
  const load = useCallback(async (): Promise<string | null> => {
    setListStatus('loading');
    setListError(null);
    try {
      const list = await listConversations();
      conversationsRef.current = list;
      setConversations(list);
      setListStatus('ready');
      // 列表返回期间用户可能已点「新对话」或切了别的会话，不能把模式覆盖回去
      if (modeRef.current !== 'empty') return null;
      if (list.length > 0) {
        const first = list[0];
        setChatMode('conversation');
        setActiveConversationId(first.conversationId);
        activeIdRef.current = first.conversationId;
        return first.conversationId;
      }
      setChatMode('empty');
      setActiveConversationId(null);
      activeIdRef.current = null;
      return null;
    } catch (cause) {
      setListStatus('error');
      setListError(cause instanceof Error ? cause.message : '会话列表加载失败');
      return null;
    }
  }, [setChatMode]);

  /** 每轮结束后的静默刷新：失败不改变当前视图 */
  const refresh = useCallback(async () => {
    try {
      const list = await listConversations();
      conversationsRef.current = list;
      setConversations(list);
      setListStatus('ready');
      setListError(null);
    } catch {
      // 列表刷新失败不影响当前对话
    }
  }, []);

  const startDraft = useCallback(() => {
    setChatMode('draft');
    setActiveConversationId(null);
    activeIdRef.current = null;
  }, [setChatMode]);

  const select = useCallback((conversationId: string) => {
    setChatMode('conversation');
    setActiveConversationId(conversationId);
    activeIdRef.current = conversationId;
  }, [setChatMode]);

  /** 首问收到 meta 后转正：插入乐观条目，等下一轮列表刷新覆盖 */
  const adopt = useCallback((conversationId: string, title: string) => {
    setChatMode('conversation');
    setActiveConversationId(conversationId);
    activeIdRef.current = conversationId;
    const previous = conversationsRef.current;
    if (previous.some((item) => item.conversationId === conversationId)) return;
    const now = formatDateTime(new Date());
    const next = [{ conversationId, title, createTime: now, updateTime: now }, ...previous];
    conversationsRef.current = next;
    setConversations(next);
  }, [setChatMode]);

  const removeLocal = useCallback((conversationId: string) => {
    const next = conversationsRef.current.filter(
      (item) => item.conversationId !== conversationId,
    );
    conversationsRef.current = next;
    setConversations(next);
    if (activeIdRef.current === conversationId) activeIdRef.current = null;
    setActiveConversationId((current) => (current === conversationId ? null : current));
  }, []);

  const enterEmpty = useCallback(() => {
    setChatMode('empty');
    setActiveConversationId(null);
    activeIdRef.current = null;
  }, [setChatMode]);

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

  const getConversations = useCallback(() => conversationsRef.current, []);
  const getActiveConversationId = useCallback(() => activeIdRef.current, []);

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
    /** 并发异步回调里同步读取最新列表（state 此时可能还没提交） */
    getConversations,
    /** 同上：读取当前会话 id，供历史归属校验 */
    getActiveConversationId,
  };
}
