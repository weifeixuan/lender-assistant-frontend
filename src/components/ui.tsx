import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertIcon } from './icons';

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: 'border-line bg-panel text-ink2 hover:border-line3 hover:bg-panel2',
  primary: 'border-brand bg-brand text-white hover:border-brand2 hover:bg-brand2',
  ghost: 'border-transparent bg-transparent text-ink2 hover:bg-panel2',
  danger: 'border-dangerLine bg-dangerSoft text-danger hover:bg-dangerSoft2',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-[26px] px-2.5 text-small rounded',
  md: 'h-8 px-3 text-body rounded-input',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', type = 'button', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap border font-sans transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

type TagTone = 'plain' | 'ok' | 'warn' | 'info';

const TAG_TONES: Record<TagTone, string> = {
  plain: 'border-line bg-panel2 text-muted',
  ok: 'border-okLine bg-okSoft text-ok',
  warn: 'border-warnLine bg-warnSoft text-warn',
  info: 'border-brandLine bg-brandSoft text-brand',
};

export function Tag({
  tone = 'plain',
  children,
  className,
}: {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded border px-1.5 text-meta font-medium',
        TAG_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block h-3 w-3 animate-spin rounded-full border border-brandLine border-t-brand',
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ?? <AlertIcon size={20} className="text-muted" />}
      <div className="text-body font-medium text-ink2">{title}</div>
      {description ? <div className="max-w-md text-meta leading-relaxed text-muted">{description}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-9 animate-pulse rounded bg-line2" />
      ))}
    </div>
  );
}
