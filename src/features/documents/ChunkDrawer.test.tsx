import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listChunks } from '@/api/documents';
import type { ChunkItem, DocSummary } from '@/api/types';
import { ChunkDrawer } from './ChunkDrawer';

vi.mock('@/api/documents', () => ({ listChunks: vi.fn() }));

const mockedListChunks = vi.mocked(listChunks);

const DOC: DocSummary = {
  docId: 'doc-1',
  docTitle: '示例文档',
  sourcePath: 'sample.txt',
  chunkCount: 2,
  charCountTotal: 200,
  updateTime: '2026-01-01 00:00:00',
};

function chunk(index: number): ChunkItem {
  return {
    chunkId: index,
    index,
    sectionPath: '1 接口总览 > 1.1 基础约定',
    charCount: 10,
    content: `切片${index}`,
  };
}

function renderDrawer(doc: DocSummary) {
  render(<ChunkDrawer doc={doc} open onClose={vi.fn()} />);
}

describe('ChunkDrawer', () => {
  beforeEach(() => {
    mockedListChunks.mockReset();
  });

  it('renders the chunk list inside a non-modal dialog sized for narrow screens', async () => {
    mockedListChunks.mockResolvedValue({
      docId: 'doc-1',
      page: 1,
      size: 20,
      total: 2,
      items: [chunk(0), chunk(1)],
    });

    renderDrawer(DOC);

    await waitFor(() => expect(screen.getByText('切片0')).toBeInTheDocument());
    expect(screen.getByText('切片1')).toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: '切片浏览' });
    expect(dialog).not.toHaveAttribute('aria-modal');
    expect(dialog.className).toContain('max-w-[460px]');
  });

  it('keeps zero-chunk documents on their dedicated empty state', async () => {
    mockedListChunks.mockResolvedValue({
      docId: 'doc-1',
      page: 1,
      size: 20,
      total: 0,
      items: [],
    });

    renderDrawer({ ...DOC, chunkCount: 0, charCountTotal: 0 });

    await waitFor(() => expect(screen.getByText('该文档没有可用切片')).toBeInTheDocument());
    expect(screen.getByText('请重新上传该文档。')).toBeInTheDocument();
  });
});
