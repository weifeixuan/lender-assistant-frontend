import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';
import { cx } from './ui';

/**
 * 右侧滑出抽屉：不使用遮罩，保证列表未被覆盖的部分仍可操作；
 * 因此不声明 aria-modal（并非模态对话框），Esc 关闭，关闭后焦点回到触发元素（AGENTS.md §9）。
 */
export function Drawer({
  open,
  onClose,
  ariaLabel,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      tabIndex={-1}
      className={cx(
        'fixed inset-y-0 right-0 z-30 flex w-full max-w-[460px] flex-col border-l border-line bg-panel shadow-drawer outline-none',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DrawerCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="关闭"
      onClick={onClose}
      className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-panel2 hover:text-ink"
    >
      <CloseIcon />
    </button>
  );
}
