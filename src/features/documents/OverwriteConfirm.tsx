import type { DocSummary } from '@/api/types';
import { formatThousands } from '@/lib/format';

/** docId 冲突时的覆盖确认：文案固定写明影响的切片数与不可恢复 */
export function OverwriteConfirm({
  target,
  checked,
  disabled,
  onChange,
}: {
  target: DocSummary;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="mt-3 rounded-card border border-warnLine bg-warnSoft px-3 py-2.5">
      <label className="flex cursor-pointer items-start gap-2 text-small leading-relaxed text-warn">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 accent-warn"
        />
        <span>
          该 docId 已存在（{target.docTitle}），将删除其原有的 {formatThousands(target.chunkCount)}{' '}
          个切片并重建，旧内容不可恢复。
        </span>
      </label>
    </div>
  );
}
