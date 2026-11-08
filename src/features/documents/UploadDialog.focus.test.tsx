import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UploadDialog } from './UploadDialog';

function renderDialog() {
  const onClose = vi.fn();
  const onUploaded = vi.fn();
  render(<UploadDialog open existing={[]} onClose={onClose} onUploaded={onUploaded} />);
  return { onClose, onUploaded };
}

describe('UploadDialog focus management', () => {
  it('focuses the visible "选择文件" button on open and keeps the hidden file input out of the tab order', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: '选择文件' })).toHaveFocus();

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput).toHaveAttribute('tabindex', '-1');
  });

  it('pulls focus back into the dialog when it lands on an element outside the panel', () => {
    renderDialog();
    const outside = document.createElement('button');
    outside.type = 'button';
    outside.textContent = '外部按钮';
    document.body.appendChild(outside);

    outside.focus();
    fireEvent.focusIn(outside);

    expect(screen.getByRole('button', { name: '选择文件' })).toHaveFocus();
    outside.remove();
  });

  it('cycles Tab from the last enabled control to the first visible control, skipping the hidden input', () => {
    renderDialog();
    screen.getByRole('button', { name: '取消' }).focus();

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus();
  });

  it('moves focus to the first visible control when Tab is pressed with focus on the panel itself', () => {
    renderDialog();
    screen.getByRole('dialog').focus();

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus();
  });

  it('returns focus to the choose button when the dialog is reopened', () => {
    const onClose = vi.fn();
    const onUploaded = vi.fn();
    const { rerender } = render(
      <UploadDialog open={false} existing={[]} onClose={onClose} onUploaded={onUploaded} />,
    );

    rerender(<UploadDialog open existing={[]} onClose={onClose} onUploaded={onUploaded} />);
    expect(screen.getByRole('button', { name: '选择文件' })).toHaveFocus();
  });
});
