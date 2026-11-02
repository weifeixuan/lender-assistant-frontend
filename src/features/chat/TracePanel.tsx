import { useEffect, useMemo, useState } from 'react';
import type { QaDone, QaSource } from '@/api/types';
import { Button, Spinner, Tag, cx } from '@/components/ui';
import { PanelRightIcon } from '@/components/icons';
import { formatDistance, formatRrf, formatThousands } from '@/lib/format';

/**
 * 检索过程侧栏：只反映最近一次提问的真实阶段
 * 双通道召回 → RRF 融合 → 送入上下文 → 来源明细。
 * 不出现查询改写 / 重排，也不展示进度条。
 */
export function TracePanel({
  sources,
  done,
  streaming,
  hasTurn,
  roundIndex,
  roundKey,
  isHistory,
  collapsed,
  onToggle,
  focusIdx,
}: {
  sources: QaSource[];
  done: QaDone | null;
  streaming: boolean;
  hasTurn: boolean;
  roundIndex: number;
  roundKey: string;
  isHistory: boolean;
  collapsed: boolean;
  onToggle: () => void;
  focusIdx: number | null;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setExpanded(focusIdx);
    if (focusIdx === null) return;
    const element = document.getElementById(`trace-source-${focusIdx}`);
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [roundKey, focusIdx]);

  const stats = useMemo(() => {
    const vectorCount = sources.filter((source) => source.vectorDistance !== null).length;
    const keywordCount = sources.filter((source) => (source.keywordHits ?? 0) > 0).length;
    const bothCount = sources.filter((source) => source.bothChannels).length;
    return { vectorCount, keywordCount, bothCount };
  }, [sources]);

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-2 border-l border-line bg-panel py-2">
        <button
          type="button"
          aria-label="展开检索过程"
          onClick={onToggle}
          className="grid h-8 w-8 place-items-center rounded-input text-muted hover:bg-panel2 hover:text-ink"
        >
          <PanelRightIcon size={15} />
        </button>
        <span className="text-[10.5px] tracking-[0.2em] text-muted [writing-mode:vertical-rl]">
          检索过程
        </span>
      </div>
    );
  }

  const emptyRecall = hasTurn && !streaming && sources.length === 0 && done !== null;

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="text-body font-semibold text-ink">检索过程</span>
        {hasTurn ? (
          <Tag tone={isHistory ? 'plain' : 'info'}>
            第 {roundIndex} 轮{isHistory ? ' · 历史' : ''}
          </Tag>
        ) : null}
        <button
          type="button"
          aria-label="收起检索过程"
          onClick={onToggle}
          className="ml-auto grid h-7 w-7 place-items-center rounded-input text-muted hover:bg-panel2 hover:text-ink"
        >
          <PanelRightIcon size={15} />
        </button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto px-3 py-3">
        {!hasTurn ? (
          <Hint text="提问后在这里查看双通道召回、融合排序与来源明细。" />
        ) : streaming && sources.length === 0 ? (
          <div className="flex items-center gap-2 text-meta text-muted" role="status">
            <Spinner />
            正在检索…
          </div>
        ) : emptyRecall ? (
          <div className="rounded-card border border-line bg-panel2 px-3 py-3">
            <div className="text-body font-medium text-ink2">未召回</div>
            <p className="mt-1 text-meta leading-relaxed text-muted">
              本轮没有从知识库检索到相关切片，因此没有可展示的召回与融合结果。
            </p>
          </div>
        ) : sources.length > 0 ? (
          <>
            <SectionTitle index="1" title="双通道召回" />
            <div className="grid grid-cols-3 gap-2">
              <Stat label="向量通道" value={stats.vectorCount} unit="条" />
              <Stat label="关键词通道" value={stats.keywordCount} unit="条" />
              <Stat label="双通道命中" value={stats.bothCount} unit="条" />
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
              统计范围为本轮送入上下文的 {formatThousands(sources.length)} 条来源。
            </p>

            <SectionTitle index="2" title="融合排序（RRF）" className="mt-4" />
            <p className="mb-1.5 text-[10.5px] leading-relaxed text-muted">
              两通道按排名融合，不偏袒任一通道。
            </p>
            <div className="overflow-hidden rounded-input border border-line">
              {sources.map((source) => (
                <div
                  key={source.idx}
                  className="flex items-center gap-2 border-b border-line2 px-2.5 py-1.5 text-small last:border-b-0"
                >
                  <span className="w-4 shrink-0 text-right font-mono text-meta text-muted">
                    {source.idx}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink2">{source.docTitle}</span>
                  <span className="shrink-0 font-mono text-meta tabular-nums text-ink">
                    {formatRrf(source.rrfScore)}
                  </span>
                </div>
              ))}
            </div>

            <SectionTitle index="3" title="送入上下文" className="mt-4" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[19px] font-semibold tabular-nums text-ink">
                {formatThousands(done?.sourceCount ?? sources.length)}
              </span>
              <span className="text-meta text-muted">条，与正文引用编号一致</span>
            </div>

            <SectionTitle index="4" title="来源明细" className="mt-4" />
            {sources.map((source) => {
              const isOpen = expanded === source.idx;
              return (
                <div
                  key={source.idx}
                  id={`trace-source-${source.idx}`}
                  className={cx(
                    'mb-2 rounded-input border px-2.5 py-2 transition-colors',
                    isOpen ? 'border-brandLine bg-brandSoft' : 'border-line bg-panel',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-meta font-semibold text-brand">
                      #{source.idx}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-small font-medium text-ink">
                      {source.docTitle}
                    </span>
                    {source.bothChannels ? <Tag tone="info">双通道</Tag> : null}
                  </div>
                  <div className="mt-0.5 truncate text-meta text-muted">
                    {source.sectionPath || '（无小节）'}
                  </div>

                  <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-meta">
                    <span className="text-muted">
                      向量距离{' '}
                      <b className="font-mono font-medium tabular-nums text-ink2">
                        {formatDistance(source.vectorDistance)}
                      </b>
                    </span>
                    <span className="text-muted">
                      关键词命中{' '}
                      <b className="font-mono font-medium tabular-nums text-ink2">
                        {source.keywordHits ?? 0}
                      </b>
                    </span>
                    <span className="text-muted">
                      融合分数{' '}
                      <b className="font-mono font-medium tabular-nums text-ink2">
                        {formatRrf(source.rrfScore)}
                      </b>
                    </span>
                    <span className="text-muted">
                      双通道{' '}
                      <b className="font-medium text-ink2">{source.bothChannels ? '是' : '否'}</b>
                    </span>
                  </div>

                  <p
                    className={cx(
                      'mt-1.5 whitespace-pre-wrap break-words text-meta leading-relaxed text-ink2',
                      isOpen ? '' : 'clamp-2',
                    )}
                  >
                    {source.content}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-auto px-0 py-0 text-[10.5px]"
                    onClick={() => setExpanded(isOpen ? null : source.idx)}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? '收起' : '展开原文'}
                  </Button>
                </div>
              );
            })}
          </>
        ) : (
          <Hint text="本轮还没有可展示的召回结果。" />
        )}
      </div>
    </div>
  );
}

function SectionTitle({
  index,
  title,
  className,
}: {
  index: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={cx('mb-1.5 flex items-center gap-1.5', className)}>
      <span className="grid h-4 w-4 place-items-center rounded bg-line2 font-mono text-[10px] text-muted">
        {index}
      </span>
      <span className="text-small font-medium text-ink">{title}</span>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-input border border-line px-2 py-1.5">
      <div className="truncate text-[10.5px] text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-0.5">
        <span className="text-body font-semibold tabular-nums text-ink">{value}</span>
        <span className="text-[10.5px] text-muted">{unit}</span>
      </div>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <p className="rounded-card border border-line bg-panel2 px-3 py-3 text-meta leading-relaxed text-muted">
      {text}
    </p>
  );
}
