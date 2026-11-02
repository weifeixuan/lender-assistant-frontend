import { useMemo, useState } from 'react';
import { deleteDocument } from '@/api/documents';
import type { DocSummary } from '@/api/types';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { SearchIcon, UploadIcon } from '@/components/icons';
import { useKnowledge } from '@/lib/knowledge';
import { formatRelative, formatThousands } from '@/lib/format';
import { ChunkDrawer } from './ChunkDrawer';
import { DocTable } from './DocTable';
import { UploadDialog } from './UploadDialog';

export function DocumentsPage() {
  const { documents, loading, error, reload, docCount, chunkCount, lastIngestedAt } =
    useKnowledge();
  const [filter, setFilter] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [drawerDoc, setDrawerDoc] = useState<DocSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const visibleDocuments = useMemo(() => {
    // 服务端按 doc_id 返回，这里按 PRD 要求改成最近更新倒序
    const sorted = [...documents].sort((a, b) => {
      if (a.updateTime === b.updateTime) return 0;
      return a.updateTime < b.updateTime ? 1 : -1;
    });
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return sorted;
    return sorted.filter(
      (doc) =>
        doc.docTitle.toLowerCase().includes(keyword) || doc.docId.toLowerCase().includes(keyword),
    );
  }, [documents, filter]);

  const handleUploaded = (docId: string) => {
    setHighlight(docId);
    void reload();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteDocument(deleteTarget.docId);
      if (drawerDoc?.docId === deleteTarget.docId) setDrawerDoc(null);
      if (highlight === deleteTarget.docId) setHighlight(null);
      setDeleteTarget(null);
      await reload();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell
      activeLabel="文档管理"
      summary={{ docCount, chunkCount, lastIngestedAt, loading }}
    >
      <div className="flex h-full flex-col overflow-auto px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="m-0 text-title font-semibold tracking-tight">文档管理</h1>
            <p className="mt-1.5 text-body leading-relaxed text-muted">
              上传文件并核对切分结果；同一 docId 再次上传会整体覆盖重建。
            </p>
          </div>
          <Button variant="primary" onClick={() => setUploadOpen(true)}>
            <UploadIcon />
            上传文档
          </Button>
        </div>

        <div className="my-4 flex rounded-card border border-line bg-panel">
          <Metric label="文档总数" value={loading ? '—' : formatThousands(docCount)} unit="份" />
          <Metric label="切片总数" value={loading ? '—' : formatThousands(chunkCount)} unit="条" />
          <Metric
            label="最近入库"
            value={loading ? '—' : formatRelative(lastIngestedAt)}
            last
          />
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex h-8 w-[260px] items-center gap-1.5 rounded-input border border-line bg-panel px-2.5">
            <SearchIcon size={14} className="text-muted" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="按文档名或 docId 过滤"
              aria-label="按文档名或 docId 过滤"
              className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-muted"
            />
          </div>
          {filter.trim() ? (
            <span className="text-meta text-muted">
              匹配 {formatThousands(visibleDocuments.length)} / 共 {formatThousands(docCount)}
            </span>
          ) : null}
        </div>

        {loading && documents.length === 0 ? (
          <div className="rounded-card border border-line bg-panel">
            <Skeleton rows={5} />
          </div>
        ) : error && documents.length === 0 ? (
          <div className="rounded-card border border-line bg-panel">
            <EmptyState
              title="文档列表加载失败"
              description={error}
              action={
                <Button onClick={() => void reload()} variant="primary">
                  重试
                </Button>
              }
            />
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-card border border-line bg-panel">
            <EmptyState
              title="知识库里还没有文档"
              description="上传一份 docx / txt / md 文件，入库完成后就能在这里核对切分结果。"
              action={
                <Button variant="primary" onClick={() => setUploadOpen(true)}>
                  <UploadIcon />
                  上传文档
                </Button>
              }
            />
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="rounded-card border border-line bg-panel">
            <EmptyState title="没有匹配的文档" description="换一个文档名或 docId 关键字试试。" />
          </div>
        ) : (
          <DocTable
            documents={visibleDocuments}
            highlightDocId={highlight}
            onOpenChunks={setDrawerDoc}
            onDelete={(doc) => {
              setDeleteError(null);
              setDeleteTarget(doc);
            }}
          />
        )}

        {error && documents.length > 0 ? (
          <p className="mt-3 text-meta text-danger">列表刷新失败：{error}</p>
        ) : null}
      </div>

      <UploadDialog
        open={uploadOpen}
        existing={documents}
        onClose={() => setUploadOpen(false)}
        onUploaded={handleUploaded}
      />

      <ChunkDrawer doc={drawerDoc} open={drawerDoc !== null} onClose={() => setDrawerDoc(null)} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除文档"
        description={
          deleteTarget ? (
            <>
              将删除「{deleteTarget.docTitle}」及其{' '}
              <b className="tabular-nums">{formatThousands(deleteTarget.chunkCount)}</b>{' '}
              个切片，删除后不可恢复。
            </>
          ) : null
        }
        confirmText="删除"
        busy={deleting}
        error={deleteError}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </AppShell>
  );
}

function Metric({
  label,
  value,
  unit,
  last = false,
}: {
  label: string;
  value: string;
  unit?: string;
  last?: boolean;
}) {
  return (
    <div className={`flex-1 px-4 py-3 ${last ? '' : 'border-r border-line2'}`}>
      <div className="mb-1 text-meta text-muted">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-[19px] font-semibold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className="text-meta text-muted">{unit}</span> : null}
      </div>
    </div>
  );
}
