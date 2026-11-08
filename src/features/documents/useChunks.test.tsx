import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listChunks } from '@/api/documents';
import type { ChunkItem, ChunkPage } from '@/api/types';
import { CHUNK_PAGE_SIZE, useChunks } from './useChunks';

vi.mock('@/api/documents', () => ({ listChunks: vi.fn() }));

const mockedListChunks = vi.mocked(listChunks);

function chunk(index: number): ChunkItem {
  return {
    chunkId: index,
    index,
    sectionPath: null,
    charCount: 10,
    content: `切片${index}`,
  };
}

function chunkPage(page: number, total: number, start: number, count: number): ChunkPage {
  return {
    docId: 'doc-1',
    page,
    size: CHUNK_PAGE_SIZE,
    total,
    items: Array.from({ length: count }, (_, offset) => chunk(start + offset)),
  };
}

function Harness({ docId, open }: { docId: string | null; open: boolean }) {
  const { items, total, loading, error, hasMore, loadMore, retry } = useChunks(docId, open);
  return (
    <div>
      <span data-testid="count">{items.length}</span>
      <span data-testid="total">{total}</span>
      <span data-testid="status">{loading ? 'loading' : error ? 'error' : 'idle'}</span>
      {error ? <p>{error}</p> : null}
      <button type="button" onClick={loadMore} disabled={!hasMore}>
        加载更多
      </button>
      <button type="button" onClick={retry}>
        重试
      </button>
    </div>
  );
}

function counts() {
  return {
    count: screen.getByTestId('count').textContent,
    total: screen.getByTestId('total').textContent,
  };
}

describe('useChunks', () => {
  beforeEach(() => {
    mockedListChunks.mockReset();
  });

  it('loads the first page when the drawer opens and appends the next page', async () => {
    mockedListChunks
      .mockResolvedValueOnce(chunkPage(1, 25, 0, 20))
      .mockResolvedValueOnce(chunkPage(2, 25, 20, 5));

    render(<Harness docId="doc-1" open />);

    await waitFor(() => expect(counts()).toEqual({ count: '20', total: '25' }));
    expect(mockedListChunks).toHaveBeenCalledWith(
      'doc-1',
      1,
      CHUNK_PAGE_SIZE,
      expect.any(AbortSignal),
    );

    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));

    await waitFor(() => expect(counts()).toEqual({ count: '25', total: '25' }));
    expect(mockedListChunks).toHaveBeenLastCalledWith(
      'doc-1',
      2,
      CHUNK_PAGE_SIZE,
      expect.any(AbortSignal),
    );
    expect(screen.getByRole('button', { name: '加载更多' })).toBeDisabled();
  });

  it('shows the failure reason and retries the first page', async () => {
    mockedListChunks.mockRejectedValueOnce(new Error('切片加载失败'));

    render(<Harness docId="doc-1" open />);

    await waitFor(() => expect(screen.getByText('切片加载失败')).toBeInTheDocument());
    expect(screen.getByTestId('status').textContent).toBe('error');

    mockedListChunks.mockResolvedValueOnce(chunkPage(1, 20, 0, 20));
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => expect(counts()).toEqual({ count: '20', total: '20' }));
    expect(screen.queryByText('切片加载失败')).not.toBeInTheDocument();
  });

  it('resets and reloads when the docId changes', async () => {
    mockedListChunks.mockImplementation(async () => chunkPage(1, 1, 0, 1));

    const { rerender } = render(<Harness docId="doc-a" open />);
    await waitFor(() => expect(mockedListChunks).toHaveBeenCalledWith('doc-a', 1, CHUNK_PAGE_SIZE, expect.any(AbortSignal)));

    rerender(<Harness docId="doc-b" open />);

    await waitFor(() =>
      expect(mockedListChunks).toHaveBeenCalledWith('doc-b', 1, CHUNK_PAGE_SIZE, expect.any(AbortSignal)),
    );
    expect(counts()).toEqual({ count: '1', total: '1' });
  });
});
