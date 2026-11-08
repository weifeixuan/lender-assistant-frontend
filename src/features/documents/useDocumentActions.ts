import { useCallback, useState } from 'react';
import { deleteDocument } from '@/api/documents';
import type { DocSummary } from '@/api/types';

/**
 * 删除文档的确认编排：请求、进行态、错误与服务端原因原文。
 * 点击「确认」前不发请求，失败时保留弹窗。
 */
export function useDocumentActions({
  reload,
  onDeleted,
}: {
  reload: () => Promise<void>;
  onDeleted: (docId: string) => void;
}) {
  const [deleteTarget, setDeleteTarget] = useState<DocSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const requestDelete = useCallback((doc: DocSummary) => {
    setDeleteError(null);
    setDeleteTarget(doc);
  }, []);

  const cancelDelete = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteDocument(deleteTarget.docId);
      onDeleted(deleteTarget.docId);
      setDeleteTarget(null);
      await reload();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, onDeleted, reload]);

  return { deleteTarget, deleting, deleteError, requestDelete, cancelDelete, confirmDelete };
}
