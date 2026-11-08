import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDocument } from '@/api/documents';
import type { DocSummary } from '@/api/types';
import { useDocumentActions } from './useDocumentActions';

vi.mock('@/api/documents', () => ({ deleteDocument: vi.fn() }));

const mockedDelete = vi.mocked(deleteDocument);

const DOC: DocSummary = {
  docId: 'doc-1',
  docTitle: '示例文档',
  sourcePath: 'sample.txt',
  chunkCount: 12,
  charCountTotal: 3600,
  updateTime: '2026-01-01 00:00:00',
};

function Harness({ reload, onDeleted }: { reload: () => Promise<void>; onDeleted: (docId: string) => void }) {
  const { deleteTarget, deleting, deleteError, requestDelete, cancelDelete, confirmDelete } =
    useDocumentActions({ reload, onDeleted });

  return (
    <div>
      <span data-testid="target">{deleteTarget?.docId ?? 'none'}</span>
      <span data-testid="deleting">{deleting ? 'yes' : 'no'}</span>
      {deleteError ? <p>{deleteError}</p> : null}
      <button type="button" onClick={() => requestDelete(DOC)}>
        请求删除
      </button>
      <button type="button" onClick={cancelDelete}>
        取消
      </button>
      <button type="button" onClick={() => void confirmDelete()}>
        确认
      </button>
    </div>
  );
}

describe('useDocumentActions', () => {
  beforeEach(() => {
    mockedDelete.mockReset();
  });

  it('does not call the API until the confirmation is clicked', () => {
    render(<Harness reload={vi.fn()} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '请求删除' }));

    expect(screen.getByTestId('target').textContent).toBe('doc-1');
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it('deletes, reports the removed docId and reloads on success', async () => {
    mockedDelete.mockResolvedValue({ docId: 'doc-1', deletedChunks: 12 });
    const reload = vi.fn(async () => undefined);
    const onDeleted = vi.fn();

    render(<Harness reload={reload} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: '请求删除' }));
    fireEvent.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => expect(screen.getByTestId('target').textContent).toBe('none'));
    expect(mockedDelete).toHaveBeenCalledWith('doc-1');
    expect(onDeleted).toHaveBeenCalledWith('doc-1');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open and shows the server reason when deletion fails', async () => {
    mockedDelete.mockRejectedValue(new Error('文档不存在：doc-1'));

    render(<Harness reload={vi.fn()} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '请求删除' }));
    fireEvent.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => expect(screen.getByText('文档不存在：doc-1')).toBeInTheDocument());
    expect(screen.getByTestId('target').textContent).toBe('doc-1');
    expect(screen.getByTestId('deleting').textContent).toBe('no');
  });

  it('clears the pending target when cancelled', () => {
    render(<Harness reload={vi.fn()} onDeleted={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '请求删除' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.getByTestId('target').textContent).toBe('none');
    expect(mockedDelete).not.toHaveBeenCalled();
  });
});
