import type { UploadResult } from '@/api/types';
import { Tag } from '@/components/ui';
import { formatMillis, formatThousands } from '@/lib/format';

/** 上传成功后的结果面板：切片数、平均字符数与各阶段耗时，纯展示 */
export function UploadResultSummary({
  result,
  overwritten,
}: {
  result: UploadResult;
  overwritten: boolean;
}) {
  const total =
    result.millis.parse + result.millis.split + result.millis.embed + result.millis.store;
  const durations: Array<[string, number]> = [
    ['解析', result.millis.parse],
    ['切分', result.millis.split],
    ['向量化', result.millis.embed],
    ['入库', result.millis.store],
  ];
  return (
    <div>
      <div className="flex items-center gap-2">
        <Tag tone="ok">已入库</Tag>
        <span className="text-body font-medium text-ink">
          {overwritten ? '已重建 ' : ''}
          {formatThousands(result.chunkCount)} 个切片
        </span>
      </div>
      <div className="mt-3 rounded-card border border-line bg-panel2 px-4 py-3">
        <div className="grid grid-cols-2 gap-y-2 text-small">
          <span className="text-muted">文档</span>
          <span className="truncate text-ink2">{result.docId}</span>
          <span className="text-muted">切片数</span>
          <span className="tabular-nums text-ink2">{formatThousands(result.chunkCount)}</span>
          <span className="text-muted">平均字符数</span>
          <span className="tabular-nums text-ink2">{result.avgChunkChars.toFixed(1)}</span>
          <span className="text-muted">向量化模型</span>
          <span className="truncate text-ink2">{result.embeddingProvider}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-meta text-muted">各阶段耗时（总 {formatMillis(total)}）</div>
        <div className="grid grid-cols-4 gap-2">
          {durations.map(([label, value]) => (
            <div key={label} className="rounded-input border border-line px-2.5 py-2">
              <div className="text-meta text-muted">{label}</div>
              <div className="mt-0.5 tabular-nums text-small font-medium text-ink2">
                {formatMillis(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
