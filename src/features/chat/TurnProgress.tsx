import type { QaStep, QaStepStatus } from '@/api/types';
import { Spinner } from '@/components/ui';
import { formatMillis } from '@/lib/format';
import type { Turn } from './useQaStream';

const LABEL: Record<QaStepStatus, string> = {
  PENDING: '待执行',
  RUNNING: '运行中',
  DONE: '完成',
  DEGRADED: '降级',
  FAILED: '失败',
  SKIPPED: '已跳过',
};

const TONE: Record<QaStepStatus, string> = {
  PENDING: 'text-muted',
  RUNNING: 'text-brand',
  DONE: 'text-ink2',
  DEGRADED: 'text-warn',
  FAILED: 'text-danger',
  SKIPPED: 'text-muted line-through',
};

/** 断流后仍在 RUNNING 的步骤按「已中止」展示，避免进度区域残留运行态 */
function labelOf(step: QaStep | undefined, active: boolean): { text: string; tone: string } {
  const status = step?.status ?? 'PENDING';
  if (status === 'RUNNING' && !active) {
    return { text: '已中止', tone: 'text-muted' };
  }
  return { text: LABEL[status], tone: TONE[status] };
}

/**
 * 首个 delta 到达前的执行进度：计划未到只显示「正在规划」，
 * 计划到达后按 step.order 排序渲染（后端不保证数组顺序），并按 stepId 合并已到达的单步状态。
 */
export function TurnProgress({ turn }: { turn: Turn }) {
  const plan = turn.plan;
  const active = turn.status === 'streaming';

  if (!plan) {
    if (turn.route?.route === 'PLAN') {
      return (
        <div className="mb-2 flex items-center gap-1.5 text-meta text-muted">
          <Spinner />
          正在规划
        </div>
      );
    }
    return null;
  }

  if (plan.degraded) {
    return (
      <div className="mb-2 rounded-input border border-warnLine bg-warnSoft px-3 py-2 text-meta text-warn">
        计划已降级，改为直接检索
      </div>
    );
  }

  const steps = [...plan.steps].sort((a, b) => a.order - b.order);

  return (
    <div className="mb-2 rounded-input border border-line bg-panel2 px-3 py-2">
      <p className="text-meta font-medium text-ink2">计划 {steps.length} 步</p>
      <ol className="mt-1.5 flex flex-col gap-1">
        {steps.map((step) => {
          const progress = turn.steps.find((item) => item.stepId === step.stepId);
          const { text, tone } = labelOf(progress, active);
          return (
            <li key={step.stepId} className="flex items-baseline gap-2 text-meta">
              <span className="w-4 shrink-0 tabular-nums text-muted">{step.order}.</span>
              <span className="min-w-0 flex-1 text-ink2">{step.title}</span>
              <span className={tone}>{text}</span>
              {progress?.elapsedMillis != null ? (
                <span className="shrink-0 tabular-nums text-muted">
                  · {formatMillis(progress.elapsedMillis)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
