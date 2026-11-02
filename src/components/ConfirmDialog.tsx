import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';

/**
 * 危险操作二次确认。确认前不发出任何请求（AGENTS.md §8）。
 * Esc 视同取消；busy 期间禁止关闭，避免半程状态。
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  tone = 'danger',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelHandler = useRef(onCancel);
  cancelHandler.current = onCancel;

  useEffect(() => {
    if (!open) return;
    const trigger =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => trigger?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) cancelHandler.current();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, busy]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/25 px-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[440px] rounded-dialog border border-line bg-panel p-5 shadow-float"
      >
        <h2 id={titleId} className="m-0 text-[15px] font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-2 text-body leading-relaxed text-ink2">{description}</div>
        {error ? (
          <p className="mt-3 rounded-input border border-dangerLine bg-dangerSoft px-3 py-2 text-small text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} onClick={onCancel} disabled={busy}>
            {cancelText}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '处理中…' : confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
