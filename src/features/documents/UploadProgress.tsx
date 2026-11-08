import { Spinner, cx } from '@/components/ui';

const STAGES = ['解析', '切分', '向量化', '入库'] as const;
/** 等待态的阶段切换阈值（毫秒）：只用于让使用者看到流水线顺序，不是真实进度 */
const STAGE_THRESHOLDS = [0, 1200, 2600, 6000];

function activeStage(elapsed: number): number {
  let index = 0;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i += 1) {
    const threshold = STAGE_THRESHOLDS[i];
    if (threshold !== undefined && elapsed >= threshold) index = i;
  }
  return index;
}

/** 上传等待态：四段流水线文案 + 已用时间，真实各段耗时以响应结果为准 */
export function UploadProgress({ elapsed }: { elapsed: number }) {
  const stage = activeStage(elapsed);
  return (
    <div className="mt-4 rounded-card border border-line bg-panel2 px-4 py-3">
      <div className="flex items-center justify-between text-meta text-muted">
        <span>正在处理，上传完成前请勿关闭</span>
        <span className="tabular-nums">已用 {(elapsed / 1000).toFixed(1)} s</span>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        {STAGES.map((label, index) => (
          <div key={label} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-line">—</span> : null}
            <span
              className={cx(
                'inline-flex items-center gap-1.5 text-small',
                index < stage
                  ? 'text-ok'
                  : index === stage
                    ? 'font-medium text-brand'
                    : 'text-muted',
              )}
            >
              {index === stage ? (
                <Spinner />
              ) : (
                <span
                  className={cx(
                    'h-1.5 w-1.5 rounded-full',
                    index < stage ? 'bg-ok' : 'bg-line',
                  )}
                />
              )}
              {label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-meta text-muted">真实各段耗时以返回结果为准。</p>
    </div>
  );
}
