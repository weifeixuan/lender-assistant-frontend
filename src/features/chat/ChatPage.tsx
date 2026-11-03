import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, EmptyState, Spinner, Tag } from '@/components/ui';
import { ChatIcon } from '@/components/icons';
import type { ConversationSummary, MessageItem } from '@/api/types';
import { useKnowledge } from '@/lib/knowledge';
import { formatThousands, truncateTitle } from '@/lib/format';
import { ConversationSidebar } from './ConversationSidebar';
import { Composer } from './Composer';
import { Thread } from './Thread';
import { TracePanel } from './TracePanel';
import { buildTurns } from './history';
import { useConversationHistory } from './useConversationHistory';
import { useConversations } from './useConversations';
import { useQaStream } from './useQaStream';

export function ChatPage() {
  const { docCount, chunkCount, lastIngestedAt, loading } = useKnowledge();
  const {
    mode,
    activeConversationId,
    conversations: list,
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
  } = useConversations();
  const {
    status: historyStatus,
    error: historyError,
    load: loadHistory,
  } = useConversationHistory();
  const pendingQuestion = useRef('');
  const [draftText, setDraftText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [traceCollapsed, setTraceCollapsed] = useState(() => window.innerWidth < 1280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1280);
  const [viewTurnId, setViewTurnId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ idx: number; seq: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
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

  /** 历史返回时若用户已经开出新一轮，保留实时轮次，避免被历史整批覆盖 */
  const turnsRef = useRef(turns);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const applyHistory = useCallback(
    (messages: MessageItem[]) => {
      const historyTurns = buildTurns(messages);
      const live = turnsRef.current;
      if (live.length === 0) {
        resetTurns(historyTurns);
        return;
      }
      const liveIds = new Set(live.map((turn) => turn.id));
      const liveRounds = new Set(
        live.map((turn) => turn.roundId).filter((roundId): roundId is string => roundId !== null),
      );
      resetTurns([
        ...historyTurns.filter(
          (turn) =>
            !liveIds.has(turn.id) && (turn.roundId === null || !liveRounds.has(turn.roundId)),
        ),
        ...live,
      ]);
    },
    [resetTurns],
  );

  useEffect(() => {
    const element = threadRef.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [turns]);

  /** 启动引导：拉列表 → 有首项则加载其历史；初始加载与列表「重试」共用 */
  const bootstrap = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      const firstId = await loadList();
      if (isCancelled() || firstId === null) return;
      const result = await loadHistory(firstId);
      if (isCancelled()) return;
      if (result.kind === 'ok') applyHistory(result.messages);
      else if (result.kind === 'missing') {
        handleMissingRef.current('该会话已不存在，已从列表移除', firstId);
      }
    },
    [loadList, loadHistory, applyHistory],
  );

  useEffect(() => {
    let cancelled = false;
    void bootstrap(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  const openConversation = useCallback(
    async (conversationId: string) => {
      stop();
      clearTurns();
      setViewTurnId(null);
      setFocus(null);
      setNotice(null);
      select(conversationId);
      const result = await loadHistory(conversationId);
      if (result.kind === 'ok') applyHistory(result.messages);
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

  const handleSelect = (conversationId: string) => {
    if (conversationId === activeConversationId && mode === 'conversation') return;
    void openConversation(conversationId);
  };

  const handleNewDraft = () => {
    stop();
    clearTurns();
    setDraftText('');
    setViewTurnId(null);
    setFocus(null);
    setNotice(null);
    startDraft();
  };

  const handleRequestDelete = (conversation: ConversationSummary) => {
    setDeleteError(null);
    setDeleteTarget(conversation);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = () => {
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

        const rest = list.filter((item) => item.conversationId !== target.conversationId);
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
  };

  const handleAsk = (question: string) => {
    setViewTurnId(null);
    setFocus(null);
    setNotice(null);
    setDraftText('');
    pendingQuestion.current = question;
    if (mode === 'empty') startDraft();

    void (async () => {
      const result = await ask(question, mode === 'conversation' ? activeConversationId : null);
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
  };

  const handleCite = (turnId: string, idx: number) => {
    setViewTurnId(turnId);
    setFocus({ idx, seq: (focus?.seq ?? 0) + 1 });
    setTraceCollapsed(false);
  };

  const handleRetryHistory = () => {
    if (activeConversationId) void openConversation(activeConversationId);
  };

  return (
    <AppShell activeLabel="知识库对话" summary={{ docCount, chunkCount, lastIngestedAt, loading }}>
      <div
        className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)]"
        style={{
          gridTemplateColumns: `${sidebarCollapsed ? '40px' : '240px'} minmax(0,1fr) ${
            traceCollapsed ? '40px' : '300px'
          }`,
        }}
      >
        <ConversationSidebar
          mode={mode}
          conversations={list}
          activeConversationId={activeConversationId}
          listStatus={listStatus}
          listError={listError}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          onNewDraft={handleNewDraft}
          onSelect={handleSelect}
          onDelete={handleRequestDelete}
          onRetryLoad={() => void bootstrap()}
        />

        <div className="flex min-h-0 flex-col px-3 pb-4 pt-5 sm:px-6">
          <div className="mx-auto mb-3 w-full max-w-[760px] shrink-0">
            <div className="flex items-center gap-2">
              <h1 className="m-0 text-title font-semibold tracking-tight">知识库对话</h1>
              {mode === 'draft' ? <Tag tone="plain">未保存</Tag> : null}
            </div>
            <p className="mt-1 text-meta text-muted">
              {loading
                ? '正在读取知识库规模…'
                : `当前知识库 ${formatThousands(docCount)} 份文档 / ${formatThousands(
                    chunkCount,
                  )} 切片`}
            </p>
          </div>

          {historyStatus === 'error' ? (
            <div
              role="status"
              className="mx-auto mb-3 flex w-full max-w-[760px] items-start gap-2 rounded-input border border-dangerLine bg-dangerSoft px-3 py-2 text-small text-danger"
            >
              <span className="flex-1">{historyError ?? '历史消息加载失败'}</span>
              <Button size="sm" onClick={handleRetryHistory}>
                重试
              </Button>
            </div>
          ) : null}

          {notice ? (
            <div
              role="status"
              className="mx-auto mb-3 flex w-full max-w-[760px] items-start gap-2 rounded-input border border-warnLine bg-warnSoft px-3 py-2 text-small text-warn"
            >
              <span className="flex-1">{notice}</span>
              <Button size="sm" onClick={() => setNotice(null)}>
                关闭
              </Button>
            </div>
          ) : null}

          <div
            ref={threadRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              stickToBottom.current =
                element.scrollHeight - element.scrollTop - element.clientHeight < 120;
            }}
            className="scroll-thin mx-auto min-h-0 w-full max-w-[760px] flex-1 overflow-auto pb-3 pr-1"
          >
            {turns.length === 0 ? (
              mode === 'empty' ? (
                <EmptyState
                  icon={<ChatIcon size={20} className="text-muted" />}
                  title="开始一次知识库对话"
                  description="直接提问即可开始；同一会话里的追问会保留上下文，历史讨论可以随时回到。回答正文用【来源N】标注引用。"
                />
              ) : mode === 'draft' ? (
                <EmptyState
                  icon={<ChatIcon size={20} className="text-muted" />}
                  title="新对话"
                  description="这是未保存的草稿；发出第一条问题后，会话才会出现在左侧「最近」并开始保留历史。"
                />
              ) : historyStatus === 'loading' ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-muted">
                  <Spinner />
                  <p className="text-meta">正在加载会话历史…</p>
                </div>
              ) : (
                <EmptyState
                  icon={<ChatIcon size={20} className="text-muted" />}
                  title="这个会话还没有内容"
                  description="在下方输入框提问，即可为它增加第一条问答。"
                />
              )
            ) : (
              <Thread
                turns={turns}
                onCite={handleCite}
                onRetry={(question) => handleAsk(question)}
                onStop={stop}
              />
            )}
          </div>

          <div className="mx-auto w-full max-w-[760px] shrink-0 pt-1">
            <Composer
              value={draftText}
              onChange={setDraftText}
              streaming={streaming}
              onSubmit={handleAsk}
            />
          </div>
        </div>

        <TracePanel
          sources={viewed?.sources ?? []}
          done={viewed?.meta ?? null}
          streaming={Boolean(viewed?.status === 'streaming')}
          hasTurn={viewed !== null}
          roundIndex={roundIndex}
          roundKey={`${viewed?.id ?? 'none'}-${focus?.seq ?? 0}`}
          isHistory={isHistory}
          collapsed={traceCollapsed}
          onToggle={() => setTraceCollapsed((value) => !value)}
          focusIdx={focus?.idx ?? null}
        />
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除会话"
        description={
          deleteTarget ? (
            <>将删除会话「{deleteTarget.title}」及其全部历史消息，删除后不可恢复。</>
          ) : null
        }
        confirmText="删除"
        busy={deleting}
        error={deleteError}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </AppShell>
  );
}
