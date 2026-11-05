import { Button, Spinner, Tag, cx } from '@/components/ui';
import { formatMillis, formatThousands } from '@/lib/format';
import { AnswerBody } from './citations';
import { TurnProgress } from './TurnProgress';
import type { Turn } from './useQaStream';

export function Thread({
  turns,
  onCite,
  onRetry,
  onStop,
  retryDisabled = false,
}: {
  turns: Turn[];
  onCite: (turnId: string, idx: number) => void;
  onRetry: (question: string) => void;
  onStop: () => void;
  /** 流式进行中禁用「重试」，避免它 abort 掉当前这轮 */
  retryDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {turns.map((turn) => {
        // 首个 delta 到达前用执行进度占位；到达后切回正文流式渲染
        const showProgress =
          turn.answer === '' &&
          (turn.route?.route === 'PLAN' || turn.plan !== null || turn.steps.length > 0);
        const provider = turn.meta
          ? turn.meta.provider === 'rule'
            ? '规则提示'
            : turn.meta.provider
          : '—';

        return (
          <div key={turn.id} className="mb-5">
            <div className="mb-2 flex justify-end">
              <div className="max-w-[76%] rounded-card border border-brandLine bg-brandSoft px-3.5 py-2.5 text-body leading-relaxed text-ink3">
                {turn.question}
              </div>
            </div>

            <div className="mb-2 flex items-center gap-2 text-meta font-medium text-muted">
              <span className="grid h-[18px] w-[18px] place-items-center rounded bg-ink text-[9px] font-bold tracking-wide text-white">
                LA
              </span>
              知识库
            </div>

            <div
              className={cx(
                'rounded-card border px-3.5 py-3 shadow-card',
                turn.status === 'done' && turn.sources.length === 0 && turn.meta?.sourceCount === 0
                  ? 'border-line bg-panel2'
                  : 'border-line bg-panel',
              )}
            >
              {turn.status === 'streaming' && !showProgress ? (
                <div className="mb-2 flex items-center gap-1.5 text-meta text-muted">
                  <Spinner />
                  {turn.sources.length > 0
                    ? `正在引用 ${formatThousands(turn.sources.length)} 份资料`
                    : '正在检索…'}
                </div>
              ) : null}

              {showProgress ? <TurnProgress turn={turn} /> : null}

              {turn.answer ? (
                <AnswerBody
                  text={turn.answer}
                  sources={turn.sources}
                  onCite={(idx) => onCite(turn.id, idx)}
                />
              ) : null}

              {turn.status === 'stopped' ? (
                <div className="mt-2 flex items-center gap-2">
                  <Tag tone="warn">已停止</Tag>
                  <span className="text-meta text-muted">已生成的内容保留</span>
                </div>
              ) : null}

              {turn.status === 'done' &&
              turn.sources.length === 0 &&
              turn.meta?.sourceCount === 0 &&
              turn.meta?.provider !== 'rule' ? (
                <div className="mt-2">
                  <Tag tone="plain">未召回</Tag>
                  <p className="mt-1.5 text-small leading-relaxed text-ink2">
                    本轮没有召回到可用资料，可以换个问法，或先上传相关文档后再问。
                  </p>
                </div>
              ) : null}

              {turn.status === 'error' ? (
                <div className="mt-2 rounded-input border border-dangerLine bg-dangerSoft px-3 py-2 text-small leading-relaxed text-danger">
                  <div className="flex items-start gap-2">
                    <span className="flex-1">{turn.error ?? '回答生成失败'}</span>
                    <Button
                      size="sm"
                      disabled={retryDisabled}
                      onClick={() => onRetry(turn.question)}
                    >
                      重试
                    </Button>
                  </div>
                </div>
              ) : null}

              {turn.status === 'streaming' ? (
                <div className="mt-2.5 flex items-center gap-2 border-t border-dashed border-line pt-2">
                  <span className="text-meta text-muted">回答生成中</span>
                  <Button size="sm" className="ml-auto" onClick={onStop}>
                    停止
                  </Button>
                </div>
              ) : null}

              {turn.status !== 'streaming' ? (
                <div className="mt-2.5 border-t border-dashed border-line pt-2 text-meta text-muted">
                  {provider} · 耗时 {turn.meta ? formatMillis(turn.meta.elapsedMillis) : '—'}
                  {turn.status === 'stopped' ? null : (
                    <>
                      {' '}
                      · 引用{' '}
                      {formatThousands(turn.meta ? turn.meta.sourceCount : turn.sources.length)} 条
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
