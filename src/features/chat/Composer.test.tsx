import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from './Composer';

describe('Composer', () => {
  it('submits on Enter and keeps Shift+Enter for newline', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(
      <Composer value="首套贷款成数" onChange={onChange} streaming={false} onSubmit={onSubmit} />,
    );

    fireEvent.keyDown(screen.getByRole('textbox', { name: '提问内容' }), {
      key: 'Enter',
    });
    expect(onSubmit).toHaveBeenCalledWith('首套贷款成数');

    fireEvent.keyDown(screen.getByRole('textbox', { name: '提问内容' }), {
      key: 'Enter',
      shiftKey: true,
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
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
