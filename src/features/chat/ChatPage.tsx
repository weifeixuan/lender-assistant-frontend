import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Button, EmptyState, Tag } from '@/components/ui';
import { ChatIcon } from '@/components/icons';
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
    removeLocal,
    enterEmpty,
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
  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

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

  useEffect(() => {
    const element = threadRef.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [turns]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const firstId = await loadList();
      if (cancelled || firstId === null) return;
      const result = await loadHistory(firstId);
      if (cancelled || result.kind !== 'ok') return;
      resetTurns(buildTurns(result.messages));
    })();
    return () => {
      cancelled = true;
    };
  }, [loadList, loadHistory, resetTurns]);

  const openConversation = useCallback(
    async (conversationId: string) => {
      stop();
      clearTurns();
      setViewTurnId(null);
      setFocus(null);
      setNotice(null);
      select(conversationId);
      const result = await loadHistory(conversationId);
      if (result.kind === 'ok') resetTurns(buildTurns(result.messages));
    },
    [stop, clearTurns, select, loadHistory, resetTurns],
  );

  const handleMissingConversation = useCallback(
    (message: string, conversationId: string) => {
      removeLocal(conversationId);
      setNotice(message);
      const rest = list.filter((item) => item.conversationId !== conversationId);
      if (rest.length > 0) {
        const next = rest[0];
        if (next) void openConversation(next.conversationId);
        return;
      }
      stop();
      clearTurns();
      enterEmpty();
    },
    [removeLocal, list, openConversation, stop, clearTurns, enterEmpty],
  );

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
        setDraftText(result.question);
        setNotice(result.message);
        if (result.status === 404 && activeConversationId) {
          handleMissingConversation(result.message, activeConversationId);
        }
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
          onRetryLoad={() => void loadList()}
        />

        <div className="flex min-h-0 flex-col px-6 pb-4 pt-5">
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
              ) : (
                <EmptyState
                  icon={<ChatIcon size={20} className="text-muted" />}
                  title="新对话"
                  description="这是未保存的草稿；发出第一条问题后，会话才会出现在左侧「最近」并开始保留历史。"
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
    </AppShell>
  );
}
