import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DocSummary } from '@/api/types';
import { Button, cx } from '@/components/ui';
import { CloseIcon, UploadIcon } from '@/components/icons';
import { formatBytes } from '@/lib/format';
import { useDialogFocusTrap } from '@/lib/useDialogFocusTrap';
import { OverwriteConfirm } from './OverwriteConfirm';
import { UploadProgress } from './UploadProgress';
import { UploadResultSummary } from './UploadResultSummary';
import { useUploadTask } from './useUploadTask';

/** 上传弹窗壳：只编排上传任务、焦点陷阱与各展示块 */
export function UploadDialog({
  open,
  existing,
  onClose,
  onUploaded,
}: {
  open: boolean;
  existing: DocSummary[];
  onClose: () => void;
  onUploaded: (docId: string) => void;
}) {
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    file,
    docId,
    ack,
    fileError,
    idError,
    submitError,
    busy,
    elapsed,
    result,
    wasOverwrite,
    overwriteTarget,
    inputRef,
    chooseFile,
    handleDocIdChange,
    handleAckChange,
    handleSubmit,
  } = useUploadTask({ open, existing, onUploaded });

  useDialogFocusTrap(open, panelRef, chooseButtonRef);

  useEffect(() => {
    if (!open || busy) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/25 px-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        tabIndex={-1}
        className="flex max-h-[86vh] w-full max-w-[560px] flex-col overflow-hidden rounded-dialog border border-line bg-panel shadow-float outline-none"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="upload-title" className="m-0 text-[15px] font-semibold text-ink">
              上传文档
            </h2>
            <p className="mt-1 text-meta leading-relaxed text-muted">
              单文件，支持 docx / txt / md；同 docId 再次上传会整体覆盖重建。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            disabled={busy}
            onClick={onClose}
            className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-panel2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-auto px-5 py-4">
          {result ? (
            <UploadResultSummary result={result} overwritten={wasOverwrite} />
          ) : (
            <>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (busy) return;
                  chooseFile(event.dataTransfer.files[0] ?? null);
                }}
                className={cx(
                  'rounded-card border border-dashed px-4 py-6 text-center transition-colors',
                  busy ? 'border-line bg-panel2' : 'border-line bg-panel2 hover:border-line3',
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".docx,.txt,.md"
                  tabIndex={-1}
                  className="hidden"
                  disabled={busy}
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                />
                <div className="flex flex-col items-center gap-2">
                  <UploadIcon size={20} className="text-muted" />
                  {file ? (
                    <div className="text-body text-ink">
                      {file.name}
                      <span className="ml-2 text-meta text-muted">{formatBytes(file.size)}</span>
                    </div>
                  ) : (
                    <div className="text-body text-ink2">把文件拖到这里，或</div>
                  )}
                  <Button
                    ref={chooseButtonRef}
                    size="sm"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                  >
                    {file ? '重新选择' : '选择文件'}
                  </Button>
                </div>
              </div>
              {fileError ? <p className="mt-2 text-meta text-danger">{fileError}</p> : null}

              <div className="mt-4">
                <label htmlFor="upload-doc-id" className="block text-meta text-muted">
                  docId
                </label>
                <input
                  id="upload-doc-id"
                  value={docId}
                  disabled={busy}
                  onChange={(event) => handleDocIdChange(event.target.value)}
                  placeholder="由文件名生成，可手动修改"
                  aria-invalid={idError ? true : undefined}
                  aria-describedby={idError ? 'upload-doc-id-error' : undefined}
                  className="mt-1 h-9 w-full rounded-input border border-line bg-panel px-3 font-mono text-body text-ink outline-none placeholder:font-sans placeholder:text-muted focus:border-brandLine disabled:bg-panel2 disabled:text-muted"
                />
                {idError ? (
                  <p id="upload-doc-id-error" className="mt-1.5 text-meta text-danger">
                    {idError}
                  </p>
                ) : (
                  <p className="mt-1.5 text-meta text-muted">
                    小写字母、数字、下划线与短横线，长度不超过 64
                  </p>
                )}
              </div>

              {overwriteTarget ? (
                <OverwriteConfirm
                  target={overwriteTarget}
                  checked={ack}
                  disabled={busy}
                  onChange={handleAckChange}
                />
              ) : null}

              {submitError ? (
                <div
                  role="alert"
                  className="mt-3 rounded-input border border-dangerLine bg-dangerSoft px-3 py-2"
                >
                  <p className="text-small leading-relaxed text-danger">{submitError}</p>
                  {file ? (
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" onClick={handleSubmit}>
                        重试上传
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {busy ? <UploadProgress elapsed={elapsed} /> : null}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          {result ? (
            <Button variant="primary" onClick={onClose}>
              完成
            </Button>
          ) : (
            <>
              <Button disabled={busy} onClick={onClose}>
                取消
              </Button>
              <Button variant="primary" disabled={busy || !file} onClick={handleSubmit}>
                {busy ? '处理中…' : '上传入库'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
