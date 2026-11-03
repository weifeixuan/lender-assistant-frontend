import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationSummary, MessageItem } from '@/api/types';
import { truncateTitle } from '@/lib/format';
import { buildTurns } from './history';
import { useConversationHistory } from './useConversationHistory';
import { useConversations } from './useConversations';
import { useQaStream } from './useQaStream';

/** 会话/历史/问答/删除的编排；页面只负责渲染与布局状态 */
export function useConversationController() {
  const {
    mode,
    activeConversationId,
    conversations,
    listStatus,
    listError,
    load: loadList,
    refresh,
    startDraft,
    select,
    adopt,
    remove,
    removeLocal,
    enterEmpty,
    getConversations,
    getActiveConversationId,
  } = useConversations();
  const { status: historyStatus, error: historyError, load: loadHistory } = useConversationHistory();
  const pendingQuestion = useRef('');
  const [draftText, setDraftText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [viewTurnId, setViewTurnId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ idx: number; seq: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /** 历史 404 的处理函数要能被 openConversation / bootstrap 复用，但两者存在引用环，用 ref 打通 */
  const handleMissingRef = useRef<(message: string, conversationId: string) => void>(
    () => undefined,
  );

  const { turns, streamingTurnId, ask, stop, resetTurns, clearTurns } = useQaStream({
    onMeta: (meta) => {
      adopt(meta.conversationId, truncateTitle(pendingQuestion.current));
      void refresh();
    },
  });

  const latest = turns.length > 0 ? turns[turns.length - 1] : null;
  const viewed = (viewTurnId ? turns.find((turn) => turn.id === viewTurnId) : latest) ?? latest;
  const roundIndex = viewed ? turns.findIndex((turn) => turn.id === viewed.id) + 1 : 0;
  const isHistory = Boolean(viewed && latest && viewed.id !== latest.id);
  const streaming = viewed?.status === 'streaming' || streamingTurnId !== null;

  /**
   * 历史返回时若用户已经切走或开出新一轮，不合并：
   * 归属不一致直接丢弃；一致时保留实时轮次，避免被历史整批覆盖。
   */
  const applyHistory = useCallback(
    (messages: MessageItem[], conversationId: string) => {
      if (getActiveConversationId() !== conversationId) return;
      const historyTurns = buildTurns(messages);
      resetTurns((live) => {
        if (live.length === 0) return historyTurns;
        const liveIds = new Set(live.map((turn) => turn.id));
        const liveRounds = new Set(
          live
            .map((turn) => turn.roundId)
            .filter((roundId): roundId is string => roundId !== null),
        );
        return [
          ...historyTurns.filter(
            (turn) =>
              !liveIds.has(turn.id) && (turn.roundId === null || !liveRounds.has(turn.roundId)),
          ),
          ...live,
        ];
      });
    },
    [resetTurns, getActiveConversationId],
  );

  /**
   * 启动引导：只拉列表渲染侧栏，不自动选中任何会话，主区保持空态。
   * 列表失败后点「重试」与首次进入走同一套规则；用户点条目时才加载历史。
   */
  const bootstrap = useCallback(async () => {
    await loadList();
  }, [loadList]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const openConversation = useCallback(
    async (conversationId: string) => {
      stop();
      clearTurns();
      setViewTurnId(null);
      setFocus(null);
      setNotice(null);
      setDraftText('');
      select(conversationId);
      const result = await loadHistory(conversationId);
      if (result.kind === 'ok') applyHistory(result.messages, conversationId);
      else if (result.kind === 'missing') {
        handleMissingRef.current('该会话已不存在，已从列表移除', conversationId);
      }
    },
    [stop, clearTurns, select, loadHistory, applyHistory],
  );

  const handleMissingConversation = useCallback(
    (message: string, conversationId: string) => {
      removeLocal(conversationId);
      const rest = getConversations().filter((item) => item.conversationId !== conversationId);
      const next = rest[0];
      if (next) {
        void (async () => {
          await openConversation(next.conversationId);
          setNotice(message);
        })();
        return;
      }
      stop();
      clearTurns();
      setViewTurnId(null);
      setFocus(null);
      enterEmpty();
      setNotice(message);
    },
    [removeLocal, getConversations, openConversation, stop, clearTurns, enterEmpty],
  );

  useEffect(() => {
    handleMissingRef.current = handleMissingConversation;
  }, [handleMissingConversation]);

  const selectConversation = useCallback(
    (conversationId: string) => {
      // 只有「当前会话的内容确实属于它」时才短路；历史加载失败时再点一次要能重试
      const sameLoaded =
        mode === 'conversation' &&
        conversationId === activeConversationId &&
        (historyStatus === 'ready' || turns.length > 0);
      if (sameLoaded) return;
      void openConversation(conversationId);
    },
    [mode, activeConversationId, historyStatus, turns.length, openConversation],
  );

  const newDraft = useCallback(() => {
    stop();
    clearTurns();
    setDraftText('');
    setViewTurnId(null);
    setFocus(null);
    setNotice(null);
    startDraft();
  }, [stop, clearTurns, startDraft]);

  const askQuestion = useCallback(
    (question: string) => {
      setViewTurnId(null);
      setFocus(null);
      setNotice(null);
      setDraftText('');
      pendingQuestion.current = question;
      if (mode === 'empty') startDraft();

      void (async () => {
        const result = await ask(
          question,
          mode === 'conversation' ? activeConversationId : null,
        );
        if (!result) return;
        if (result.kind === 'rejected') {
          if (result.status === 404 && activeConversationId) {
            handleMissingConversation(result.message, activeConversationId);
            return;
          }
          // 400 / 409：把原问题放回输入框，展示服务端原因，不自动重试
          setDraftText(result.question);
          setNotice(result.message);
          return;
        }
        if (result.hadMeta) void refresh();
      })();
    },
    [ask, mode, activeConversationId, startDraft, handleMissingConversation, refresh],
  );

  const selectCitation = useCallback((turnId: string, idx: number) => {
    setViewTurnId(turnId);
    setFocus((current) => ({ idx, seq: (current?.seq ?? 0) + 1 }));
  }, []);

  const retryHistory = useCallback(() => {
    if (activeConversationId) void openConversation(activeConversationId);
  }, [activeConversationId, openConversation]);

  const requestDelete = useCallback((conversation: ConversationSummary) => {
    setDeleteError(null);
    setDeleteTarget(conversation);
  }, []);

  const cancelDelete = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }, [deleting]);

  const confirmDelete = useCallback(() => {
    const target = deleteTarget;
    if (!target || deleting) return;
    const deletingCurrent =
      target.conversationId === activeConversationId && mode === 'conversation';
    // 确认后才中止流式并发出请求；取消不会打断当前回答
    if (deletingCurrent) stop();
    setDeleting(true);
    setDeleteError(null);

    void (async () => {
      try {
        const outcome = await remove(target.conversationId);
        setDeleting(false);
        setDeleteTarget(null);
        const removedMessage = outcome === 'missing' ? '该会话已不存在，已从列表移除' : null;

        if (!deletingCurrent) {
          if (removedMessage) setNotice(removedMessage);
          return;
        }

        const rest = conversations.filter((item) => item.conversationId !== target.conversationId);
        const next = rest[0];
        if (next) {
          await openConversation(next.conversationId);
        } else {
          clearTurns();
          setViewTurnId(null);
          setFocus(null);
          enterEmpty();
        }
        if (removedMessage) setNotice(removedMessage);
      } catch (cause) {
        setDeleting(false);
        setDeleteError(cause instanceof Error ? cause.message : '删除失败，请重试');
      }
    })();
  }, [
    deleteTarget,
    deleting,
    activeConversationId,
    mode,
    stop,
    remove,
    conversations,
    openConversation,
    clearTurns,
    enterEmpty,
  ]);

  return {
    mode,
    conversations,
    activeConversationId,
    listStatus,
    listError,
    historyStatus,
    historyError,
    turns,
    streamingTurnId,
    streaming,
    viewed,
    roundIndex,
    isHistory,
    focus,
    draftText,
    setDraftText,
    notice,
    setNotice,
    deleteTarget,
    deleting,
    deleteError,
    bootstrap,
    selectConversation,
    newDraft,
    askQuestion,
    stop,
    selectCitation,
    retryHistory,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
