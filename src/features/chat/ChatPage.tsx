import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, EmptyState, Spinner, Tag } from '@/components/ui';
import { ChatIcon } from '@/components/icons';
import { useKnowledge } from '@/lib/knowledge';
import { formatThousands } from '@/lib/format';
import { ConversationSidebar } from './ConversationSidebar';
import { Composer } from './Composer';
import { Thread } from './Thread';
import { TracePanel } from './TracePanel';
import { useConversationController } from './useConversationController';

export function ChatPage() {
  const { docCount, chunkCount, lastIngestedAt, loading } = useKnowledge();
  const {
    mode,
    conversations: list,
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
  } = useConversationController();

  const [traceCollapsed, setTraceCollapsed] = useState(() => window.innerWidth < 1280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1280);
  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const element = threadRef.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [turns]);

  const handleCite = (turnId: string, idx: number) => {
    selectCitation(turnId, idx);
    setTraceCollapsed(false);
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
          onNewDraft={newDraft}
          onSelect={selectConversation}
          onDelete={requestDelete}
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
              <Button size="sm" onClick={retryHistory}>
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
                onRetry={askQuestion}
                onStop={stop}
                retryDisabled={streamingTurnId !== null}
              />
            )}
          </div>

          <div className="mx-auto w-full max-w-[760px] shrink-0 pt-1">
            <Composer
              value={draftText}
              onChange={setDraftText}
              streaming={streaming}
              onSubmit={askQuestion}
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
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}
