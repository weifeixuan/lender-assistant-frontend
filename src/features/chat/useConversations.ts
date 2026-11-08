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
  /** 列表请求序号：只接受最新一次请求的响应，避免慢响应覆盖新结果 */
  const listSeq = useRef(0);
  /** 乐观插入但服务端还没返回的会话 id：合并列表时必须保留 */
  const optimisticIds = useRef(new Set<string>());

  const applyList = useCallback((list: ConversationSummary[]) => {
    const serverIds = new Set(list.map((item) => item.conversationId));
    for (const id of optimisticIds.current) {
      if (serverIds.has(id)) optimisticIds.current.delete(id);
    }
    const kept = conversationsRef.current.filter(
      (item) => optimisticIds.current.has(item.conversationId) && !serverIds.has(item.conversationId),
    );
    const merged = [...kept, ...list];
    conversationsRef.current = merged;
    setConversations(merged);
  }, []);

  /** 拉取列表；不自动选中任何会话，模式与当前会话都由用户点击决定 */
  const load = useCallback(async () => {
    const seq = listSeq.current + 1;
    listSeq.current = seq;
    setListStatus('loading');
    setListError(null);
    try {
      const list = await listConversations();
      if (seq !== listSeq.current) return;
      applyList(list);
      setListStatus('ready');
    } catch (cause) {
      if (seq !== listSeq.current) return;
      setListStatus('error');
      setListError(cause instanceof Error ? cause.message : '会话列表加载失败');
    }
  }, [applyList]);

  /** 每轮结束后的静默刷新：失败不改变当前视图 */
  const refresh = useCallback(async () => {
    const seq = listSeq.current + 1;
    listSeq.current = seq;
    try {
      const list = await listConversations();
      if (seq !== listSeq.current) return;
      applyList(list);
      setListStatus('ready');
      setListError(null);
    } catch {
      // 列表刷新失败不影响当前对话
    }
  }, [applyList]);

  const startDraft = useCallback(() => {
    setMode('draft');
    setActiveConversationId(null);
    activeIdRef.current = null;
  }, []);

  const select = useCallback((conversationId: string) => {
    setMode('conversation');
    setActiveConversationId(conversationId);
    activeIdRef.current = conversationId;
  }, []);

  /** 首问收到 meta 后转正：插入乐观条目，等下一轮列表刷新覆盖 */
  const adopt = useCallback((conversationId: string, title: string) => {
    setMode('conversation');
    setActiveConversationId(conversationId);
    activeIdRef.current = conversationId;
    const previous = conversationsRef.current;
    if (previous.some((item) => item.conversationId === conversationId)) return;
    optimisticIds.current.add(conversationId);
    const now = formatDateTime(new Date());
    const next = [{ conversationId, title, createTime: now, updateTime: now }, ...previous];
    conversationsRef.current = next;
    setConversations(next);
  }, []);

  const removeLocal = useCallback((conversationId: string) => {
    optimisticIds.current.delete(conversationId);
    const next = conversationsRef.current.filter(
      (item) => item.conversationId !== conversationId,
    );
    conversationsRef.current = next;
    setConversations(next);
    if (activeIdRef.current === conversationId) activeIdRef.current = null;
    setActiveConversationId((current) => (current === conversationId ? null : current));
  }, []);

  const enterEmpty = useCallback(() => {
    setMode('empty');
    setActiveConversationId(null);
    activeIdRef.current = null;
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
