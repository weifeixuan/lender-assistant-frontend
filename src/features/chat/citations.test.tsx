import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { QaSource } from '@/api/types';
import { AnswerBody, splitCitations } from './citations';

function source(idx: number): QaSource {
  return {
    idx,
    docTitle: `文档${idx}`,
    sectionPath: null,
    chunkId: idx,
    content: '切片',
    vectorDistance: 0.1,
    keywordHits: null,
    bothChannels: false,
    rrfScore: '0.01234',
  };
}

describe('splitCitations', () => {
  it('splits text and citation markers', () => {
    expect(splitCitations('前半【来源1】后半')).toEqual([
      { type: 'text', text: '前半' },
      { type: 'cite', idx: 1 },
      { type: 'text', text: '后半' },
    ]);
  });

  it('leaves an unclosed marker as plain text', () => {
    expect(splitCitations('结论【来源1')).toEqual([{ type: 'text', text: '结论【来源1' }]);
  });
});

describe('AnswerBody', () => {
  it('renders a chip only for a known source index', () => {
    render(<AnswerBody text="结论【来源1】" sources={[source(1)]} onCite={vi.fn()} />);
    expect(screen.getByRole('button', { name: '查看来源 1' })).toBeInTheDocument();
  });

  it('keeps an out-of-range citation as plain text', () => {
    render(<AnswerBody text="结论【来源9】" sources={[source(1)]} onCite={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '查看来源 9' })).not.toBeInTheDocument();
    expect(screen.getByText(/【来源9】/)).toBeInTheDocument();
  });

  it('passes the cited index to onCite', () => {
    const onCite = vi.fn();
    render(<AnswerBody text="甲【来源1】乙【来源2】" sources={[source(1), source(2)]} onCite={onCite} />);

    fireEvent.click(screen.getByRole('button', { name: '查看来源 2' }));

    expect(onCite).toHaveBeenCalledWith(2);
  });
});
