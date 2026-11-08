import { useCallback, useEffect, useRef, useState } from 'react';
import { listChunks } from '@/api/documents';
import type { ChunkItem } from '@/api/types';

export const CHUNK_PAGE_SIZE = 20;

/**
 * 切片分页加载：重置、翻页、追加、错误与重试；卸载或切换文档时 abort 在飞请求。
 */
export function useChunks(docId: string | null, open: boolean) {
  const [items, setItems] = useState<ChunkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadPage = useCallback(
    async (nextPage: number) => {
      if (!docId) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const data = await listChunks(docId, nextPage, CHUNK_PAGE_SIZE, controller.signal);
        setTotal(data.total);
        setItems((previous) => (nextPage === 1 ? data.items : [...previous, ...data.items]));
        setPage(nextPage);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : '切片加载失败');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [docId],
  );

  useEffect(() => {
    setItems([]);
    setTotal(0);
    setPage(0);
    setError(null);
    if (open && docId) void loadPage(1);
    return () => abortRef.current?.abort();
  }, [open, docId, loadPage]);

  const hasMore = items.length < total;

  const loadMore = useCallback(() => {
    if (loading || items.length >= total) return;
    void loadPage(page + 1);
  }, [loading, items.length, total, page, loadPage]);

  const retry = useCallback(() => {
    void loadPage(items.length > 0 ? page + 1 : 1);
  }, [items.length, page, loadPage]);

  return { items, total, page, loading, error, hasMore, loadMore, retry };
}
