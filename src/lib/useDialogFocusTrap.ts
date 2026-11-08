import { useEffect, type RefObject } from 'react';

/** 可聚焦候选：排除 disabled、tabindex="-1" 与不可见元素（隐藏的文件 input 走这条排除） */
const FOCUSABLE_SELECTOR = 'button, input, textarea, [tabindex]';

/** 不可见元素不参与焦点循环；getComputedStyle 覆盖行内 display/visibility */
function isVisible(element: HTMLElement): boolean {
  if (element.hidden) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function focusablesIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !(element as HTMLButtonElement).disabled && element.tabIndex >= 0 && isVisible(element),
  );
}

/** 依次尝试候选元素，确保焦点真正落在面板内；全部失败时聚焦面板本身 */
function focusInto(panel: HTMLElement, preferred?: HTMLElement | null): void {
  const candidates = preferred ? [preferred, ...focusablesIn(panel)] : focusablesIn(panel);
  for (const candidate of candidates) {
    candidate.focus();
    if (panel.contains(document.activeElement)) return;
  }
  panel.focus();
}

/**
 * 对话框焦点管理：打开时聚焦首选控件，焦点离开面板即拉回，
 * Tab / Shift+Tab 在面板内的可见控件之间循环。
 */
export function useDialogFocusTrap(
  open: boolean,
  panelRef: RefObject<HTMLElement>,
  initialFocusRef?: RefObject<HTMLElement>,
): void {
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel) focusInto(panel, initialFocusRef?.current ?? null);
  }, [open, panelRef, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    const handleFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target;
      if (target instanceof Node && panel.contains(target)) return;
      focusInto(panel, initialFocusRef?.current ?? null);
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [open, panelRef, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = focusablesIn(panel);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const index = focusables.indexOf(document.activeElement as HTMLElement);
      // 焦点不在任何可见控件上（面板本身或面板外）：直接送入边界控件
      if (index < 0) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && index === 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && index === focusables.length - 1) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, panelRef]);
}
