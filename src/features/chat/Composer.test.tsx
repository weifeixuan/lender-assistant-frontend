import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from './Composer';

function Harness({
  onSubmit,
  initial = '',
  streaming = false,
}: {
  onSubmit: (question: string) => void;
  initial?: string;
  streaming?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return <Composer value={value} onChange={setValue} streaming={streaming} onSubmit={onSubmit} />;
}

describe('Composer', () => {
  it('submits on Enter and keeps Shift+Enter as the browser default newline', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} initial="首套贷款成数" />);
    const textarea = screen.getByRole('textbox', { name: '提问内容' });

    const enterNotPrevented = fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(enterNotPrevented).toBe(false);
    expect(onSubmit).toHaveBeenCalledWith('首套贷款成数');

    const shiftNotPrevented = fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(shiftNotPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('inserts a newline at the caret on Alt+Enter without submitting', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} initial="首套贷款成数" />);
    const textarea = screen.getByRole('textbox', { name: '提问内容' }) as HTMLTextAreaElement;
    textarea.setSelectionRange(3, 3);

    const notPrevented = fireEvent.keyDown(textarea, { key: 'Enter', altKey: true });

    expect(notPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toBe('首套贷\n款成数');
    expect(textarea.selectionStart).toBe(4);
  });

  it('does not submit while an IME composition is active', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} initial="首套贷款" />);
    const textarea = screen.getByRole('textbox', { name: '提问内容' });

    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 229 });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the Alt+Enter hint', () => {
    render(<Harness onSubmit={vi.fn()} />);
    expect(screen.getByText('Enter 发送 · Alt+Enter 换行')).toBeInTheDocument();
  });

  it('does not submit blank input', () => {
    const onSubmit = vi.fn();
    render(<Composer value="   " onChange={vi.fn()} streaming={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /发送/ }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables input and send while streaming', () => {
    const onSubmit = vi.fn();
    render(<Composer value="待发送的问题" onChange={vi.fn()} streaming onSubmit={onSubmit} />);
    const textarea = screen.getByRole('textbox', { name: '提问内容' });
    expect(textarea).toBeDisabled();
    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
