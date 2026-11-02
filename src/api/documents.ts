import { isMockEnabled, request } from './client';
import {
  deleteDocumentMock,
  listChunksMock,
  listDocumentsMock,
  uploadDocumentMock,
} from './mock';
import type { ChunkPage, DeleteResult, DocSummary, UploadResult } from './types';

/** GET /api/admin/documents */
export async function listDocuments(): Promise<DocSummary[]> {
  if (isMockEnabled()) return listDocumentsMock();
  return request<DocSummary[]>('/api/admin/documents');
}

/** POST /api/admin/documents?docId=xxx（multipart 字段名固定 file） */
export async function uploadDocument(file: File, docId: string): Promise<UploadResult> {
  if (isMockEnabled()) return uploadDocumentMock(file, docId);
  const form = new FormData();
  form.append('file', file);
  return request<UploadResult>(`/api/admin/documents?docId=${encodeURIComponent(docId)}`, {
    method: 'POST',
    body: form,
  });
}

/** DELETE /api/admin/documents/{docId} */
export async function deleteDocument(docId: string): Promise<DeleteResult> {
  if (isMockEnabled()) return deleteDocumentMock(docId);
  return request<DeleteResult>(`/api/admin/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  });
}

/** GET /api/admin/documents/{docId}/chunks?page=1&size=20 */
export async function listChunks(
  docId: string,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<ChunkPage> {
  if (isMockEnabled()) return listChunksMock(docId, page, size, signal);
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  return request<ChunkPage>(
    `/api/admin/documents/${encodeURIComponent(docId)}/chunks?${query.toString()}`,
    { signal },
  );
}
