import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/ui';
import { ChatIcon } from '@/components/icons';
import { useKnowledge } from '@/lib/knowledge';
import { formatThousands } from '@/lib/format';
import { Composer } from './Composer';
import { Thread } from './Thread';
import { TracePanel } from './TracePanel';
import { useQaStream } from './useQaStream';

export function ChatPage() {
  const { docCount, chunkCount, lastIngestedAt, loading } = useKnowledge();
  const { turns, activeId, ask, stop } = useQaStream();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1280);
  const [viewTurnId, setViewTurnId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ idx: number; seq: number } | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const latest = turns.length > 0 ? turns[turns.length - 1] : null;
  const viewed = (viewTurnId ? turns.find((turn) => turn.id === viewTurnId) : latest) ?? latest;
  const roundIndex = viewed ? turns.findIndex((turn) => turn.id === viewed.id) + 1 : 0;
  const isHistory = Boolean(viewed && latest && viewed.id !== latest.id);
  const streaming = viewed?.status === 'streaming';

  useEffect(() => {
    if (activeId === null) return;
    setViewTurnId(null);
    setFocus(null);
  }, [activeId]);

  useEffect(() => {
    const element = threadRef.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [turns]);

  const handleAsk = (question: string) => {
    setViewTurnId(null);
    setFocus(null);
    void ask(question);
  };

  const handleCite = (turnId: string, idx: number) => {
    setViewTurnId(turnId);
    setFocus({ idx, seq: (focus?.seq ?? 0) + 1 });
    setCollapsed(false);
  };

  return (
    <AppShell activeLabel="知识库对话" summary={{ docCount, chunkCount, lastIngestedAt, loading }}>
      <div
        className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)]"
        style={{ gridTemplateColumns: collapsed ? '1fr 40px' : '1fr 300px' }}
      >
        <div className="flex min-h-0 flex-col px-6 pb-4 pt-5">
          <div className="mx-auto mb-3 w-full max-w-[760px] shrink-0">
            <h1 className="m-0 text-title font-semibold tracking-tight">知识库对话</h1>
            <p className="mt-1 text-meta text-muted">
              {loading
                ? '正在读取知识库规模…'
                : `当前知识库 ${formatThousands(docCount)} 份文档 / ${formatThousands(
                    chunkCount,
                  )} 切片`}
            </p>
          </div>

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
              <EmptyState
                icon={<ChatIcon size={20} className="text-muted" />}
                title="开始一次单轮问答"
                description="回答正文用【来源N】标注引用；右侧会展示双通道召回、融合排序与来源明细。历史问答仅展示，不参与本次生成。"
              />
            ) : (
              <Thread
                turns={turns}
                onCite={handleCite}
                onRetry={handleAsk}
                onStop={stop}
              />
            )}
          </div>

          <div className="mx-auto w-full max-w-[760px] shrink-0 pt-1">
            <Composer streaming={activeId !== null} onSubmit={handleAsk} />
          </div>
        </div>

        <TracePanel
          sources={viewed?.sources ?? []}
          done={viewed?.meta ?? null}
          streaming={Boolean(streaming)}
          hasTurn={viewed !== null}
          roundIndex={roundIndex}
          roundKey={`${viewed?.id ?? 'none'}-${focus?.seq ?? 0}`}
          isHistory={isHistory}
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
          focusIdx={focus?.idx ?? null}
        />
      </div>
    </AppShell>
  );
}
