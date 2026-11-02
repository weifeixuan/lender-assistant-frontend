import type { DocSummary } from '@/api/types';
import { Button } from '@/components/ui';
import { TrashIcon } from '@/components/icons';
import { formatChars, formatDateTime, formatThousands, parseServerTime } from '@/lib/format';

const FILE_STYLES: Record<string, string> = {
  DOCX: 'bg-fileDocxBg text-fileDocxFg',
  MD: 'bg-fileMd text-fileMdFg',
  TXT: 'bg-fileTxtBg text-fileTxtFg',
};

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? 'FILE' : fileName.slice(dot + 1).toUpperCase();
}

function timeText(value: string): string {
  const date = parseServerTime(value);
  return date ? formatDateTime(date) : value || '—';
}

export function DocTable({
  documents,
  highlightDocId,
  onOpenChunks,
  onDelete,
}: {
  documents: DocSummary[];
  highlightDocId: string | null;
  onOpenChunks: (doc: DocSummary) => void;
  onDelete: (doc: DocSummary) => void;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-panel">
      <table className="w-full border-collapse text-body">
        <thead>
          <tr>
            {['文档', '切片数', '最近入库时间', '操作'].map((label, index) => (
              <th
                key={label}
                scope="col"
                className={`border-b border-line bg-panel2 px-3 py-2.5 text-meta font-medium tracking-wide text-muted ${
                  index === 1 ? 'w-[90px] text-right' : 'text-left'
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => {
            const ext = extensionOf(doc.sourcePath || doc.docTitle);
            return (
              <tr
                key={doc.docId}
                tabIndex={0}
                onClick={() => onOpenChunks(doc)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpenChunks(doc);
                  }
                }}
                className={`cursor-pointer border-b border-line2 last:border-b-0 transition-colors hover:bg-panel3 ${
                  highlightDocId === doc.docId ? 'bg-brandSoft' : ''
                }`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded text-[9px] font-semibold ${
                        FILE_STYLES[ext] ?? 'bg-line2 text-fileTxtFg'
                      }`}
                      aria-hidden="true"
                    >
                      {ext.slice(0, 4)}
                    </span>
                    <div className="min-w-0">
                      <div className="max-w-[330px] truncate font-medium text-ink">{doc.docTitle}</div>
                      <div className="mt-0.5 truncate text-meta text-muted">
                        {doc.sourcePath} · {formatChars(doc.charCountTotal)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink2">
                  {formatThousands(doc.chunkCount)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ink2">{timeText(doc.updateTime)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenChunks(doc);
                      }}
                    >
                      查看切片
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`删除 ${doc.docTitle}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(doc);
                      }}
                    >
                      <TrashIcon size={13} />
                      删除
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
