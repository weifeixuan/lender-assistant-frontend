import { useCallback, useEffect, useRef, useState } from 'react';
import { listChunks } from '@/api/documents';
import type { ChunkItem, DocSummary } from '@/api/types';
import { Drawer, DrawerCloseButton } from '@/components/Drawer';
import { Button, Spinner, cx } from '@/components/ui';
import { CopyIcon } from '@/components/icons';
import { formatChars, formatDateTime, formatThousands, parseServerTime } from '@/lib/format';

const PAGE_SIZE = 20;

export function ChunkDrawer({
  doc,
  open,
  onClose,
}: {
  doc: DocSummary | null;
  open: boolean;
  onClose: () => void;
}) {
  const docId = doc?.docId ?? null;
  const [items, setItems] = useState<ChunkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const loadPage = useCallback(
    async (nextPage: number) => {
      if (!docId) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const data = await listChunks(docId, nextPage, PAGE_SIZE, controller.signal);
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
    setExpanded(null);
    setCopied(null);
    setError(null);
    if (open && docId) void loadPage(1);
    return () => abortRef.current?.abort();
  }, [open, docId, loadPage]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const hasMore = items.length < total;
  const loadMore = () => {
    if (loading || !hasMore) return;
    void loadPage(page + 1);
  };

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 80) loadMore();
  };

  const copyContent = async (item: ChunkItem) => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopied(item.chunkId);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null;
        setCopied((current) => (current === item.chunkId ? null : current));
      }, 1500);
    } catch {
      setError('复制失败，请手动选中原文复制');
    }
  };

  const updateTime = doc ? parseServerTime(doc.updateTime) : null;

  return (
    <Drawer open={open} onClose={onClose} ariaLabel="切片浏览">
      <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="m-0 truncate text-[15px] font-semibold text-ink">
              {doc?.docTitle ?? '切片浏览'}
            </h2>
          </div>
          <div className="mt-1 truncate text-meta text-muted">
            {doc?.sourcePath ?? '—'} · {doc?.docId ?? '—'}
          </div>
        </div>
        <DrawerCloseButton onClose={onClose} />
      </div>

      <div className="border-b border-line px-4 py-3">
        <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-small">
          <div>
            <div className="text-meta text-muted">切片总数</div>
            <div className="tabular-nums text-ink2">{doc ? formatThousands(doc.chunkCount) : '—'}</div>
          </div>
          <div>
            <div className="text-meta text-muted">总字符数</div>
            <div className="tabular-nums text-ink2">
              {doc ? formatThousands(doc.charCountTotal) : '—'}
            </div>
          </div>
          <div>
            <div className="text-meta text-muted">最近入库</div>
            <div className="tabular-nums text-ink2">
              {updateTime ? formatDateTime(updateTime) : '—'}
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="scroll-thin flex-1 overflow-auto px-4 py-3">
        {error ? (
          <div className="mb-2 flex items-start gap-2 rounded-input border border-dangerLine bg-dangerSoft px-3 py-2 text-small text-danger">
            <span className="flex-1 leading-relaxed">{error}</span>
            <Button size="sm" onClick={() => void loadPage(items.length > 0 ? page + 1 : 1)} disabled={loading}>
              重试
            </Button>
          </div>
        ) : null}

        {items.length === 0 && !loading && !error && total === 0 ? (
          <div className="px-2 py-12 text-center">
            <div className="text-body font-medium text-ink2">该文档没有可用切片</div>
            <div className="mt-1 text-meta text-muted">请重新上传该文档。</div>
          </div>
        ) : null}

        {items.map((item) => {
          const isOpen = expanded === item.index;
          return (
            <div
              key={item.chunkId}
              className={cx(
                'mb-2 rounded-input border px-3 py-2.5 transition-colors',
                isOpen
                  ? 'border-brandLine bg-brandSoft'
                  : 'border-line bg-panel hover:border-line3 hover:bg-panel3',
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-meta font-semibold text-brand">
                  #{item.index}
                </span>
                <span className="min-w-0 flex-1 truncate text-meta text-muted">
                  {item.sectionPath || '（无小节）'}
                </span>
                <span className="whitespace-nowrap text-meta text-muted">
                  {formatChars(item.charCount)}
                </span>
                <button
                  type="button"
                  aria-label={`复制切片 ${item.index} 的原文`}
                  onClick={() => void copyContent(item)}
                  className="grid h-5 shrink-0 place-items-center rounded px-1 text-muted hover:bg-white hover:text-ink"
                >
                  {copied === item.chunkId ? (
                    <span className="whitespace-nowrap text-[10.5px] text-ok">已复制</span>
                  ) : (
                    <CopyIcon size={13} />
                  )}
                </button>
              </div>

              <button
                type="button"
                aria-expanded={isOpen}
                aria-label={isOpen ? `收起切片 ${item.index}` : `展开切片 ${item.index} 的全文`}
                onClick={() => setExpanded(isOpen ? null : item.index)}
                className="block w-full text-left"
              >
                <p
                  className={cx(
                    'm-0 whitespace-pre-wrap break-words text-body leading-[1.7] text-ink2',
                    isOpen ? '' : 'clamp-2',
                  )}
                >
                  {item.content}
                </p>
                <span className="mt-1 inline-block text-[10.5px] text-muted">
                  {isOpen ? '收起' : '展开全文'}
                </span>
              </button>
            </div>
          );
        })}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-meta text-muted">
            <Spinner />
            {items.length === 0 ? '正在加载切片…' : '正在加载更多…'}
          </div>
        ) : null}

        {!loading && hasMore && items.length > 0 ? (
          <div className="flex justify-center py-2">
            <Button size="sm" onClick={loadMore}>
              加载更多
            </Button>
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="py-2 text-center text-meta text-muted">
            已加载 {formatThousands(items.length)} / 共 {formatThousands(total)}
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}
