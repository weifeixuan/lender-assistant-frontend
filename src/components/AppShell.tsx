import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ChatIcon, DocIcon } from './icons';
import { Button, cx } from './ui';
import { formatRelative, formatThousands } from '@/lib/format';

export interface ShellSummary {
  docCount: number;
  chunkCount: number;
  lastIngestedAt: string | null;
  loading: boolean;
  /** 知识库概览读取失败时展示原因并提供重试，不再显示 0 份 / 0 切片 */
  error?: string | null;
  onRetry?: () => void;
}

const NAV_ITEMS = [
  { to: '/documents', label: '文档管理', icon: DocIcon },
  { to: '/chat', label: '知识库对话', icon: ChatIcon },
] as const;

/** 左侧导航 224 + 主区；面包屑只反映「知识库 / 当前页」 */
export function AppShell({
  activeLabel,
  summary,
  children,
}: {
  activeLabel: string;
  summary: ShellSummary;
  children: ReactNode;
}) {
  return (
    <div className="grid h-screen grid-cols-[56px_1fr] grid-rows-[minmax(0,1fr)] overflow-hidden sm:grid-cols-[224px_1fr]">
      <aside className="flex flex-col gap-3 border-r border-line bg-panel px-2 py-3 sm:px-3 sm:py-4">
        <div className="flex items-center justify-center gap-2.5 px-1 pb-1.5 sm:justify-start">
          <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-input bg-gradient-to-br from-brandGradA to-brandGradB text-[11px] font-bold tracking-wide text-white">
            LA
          </span>
          <div className="hidden sm:block">
            <div className="text-body font-semibold leading-tight">Lender Assistant</div>
            <div className="mt-px text-[10.5px] text-muted">知识库 · 内部使用</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                cx(
                  'flex h-[34px] items-center justify-center gap-2 rounded-input px-0 text-body transition-colors sm:justify-start sm:px-2.5',
                  isActive
                    ? 'bg-brandSoft font-semibold text-brand'
                    : 'text-ink2 hover:bg-panel2',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={isActive ? 'text-brand' : 'text-muted'} />
                  <span className="hidden sm:inline">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden rounded-card border border-line bg-panel2 p-3 sm:block">
          <div className="flex items-center justify-between text-[10.5px] text-muted">
            <span>知识库概览</span>
            {summary.loading ? <span>加载中…</span> : null}
          </div>
          {summary.error ? (
            <div className="mt-2">
              <div className="text-meta leading-relaxed text-danger">概览读取失败</div>
              {summary.onRetry ? (
                <Button size="sm" className="mt-2" onClick={summary.onRetry}>
                  重试
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-meta text-muted">文档</div>
                  <div className="text-[15px] font-semibold tabular-nums">
                    {summary.loading ? '—' : formatThousands(summary.docCount)}
                  </div>
                </div>
                <div>
                  <div className="text-meta text-muted">切片</div>
                  <div className="text-[15px] font-semibold tabular-nums">
                    {summary.loading ? '—' : formatThousands(summary.chunkCount)}
                  </div>
                </div>
              </div>
              <div className="mt-2 border-t border-line2 pt-2 text-meta text-muted">
                最近入库 {summary.loading ? '—' : formatRelative(summary.lastIngestedAt)}
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col bg-bg">
        <header className="flex h-12 shrink-0 items-center border-b border-line bg-panel px-3 sm:px-5">
          <span className="text-body text-muted">
            知识库 <span className="px-1.5">/</span>
            <b className="font-semibold text-ink">{activeLabel}</b>
          </span>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
