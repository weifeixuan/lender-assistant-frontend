import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { uploadDocument } from '@/api/documents';
import type { DocSummary, UploadResult } from '@/api/types';
import { Button, Spinner, Tag, cx } from '@/components/ui';
import { CloseIcon, UploadIcon } from '@/components/icons';
import { formatBytes, formatMillis, formatThousands } from '@/lib/format';
import { docIdFromFileName, validateDocId, validateUploadFile } from '@/lib/uploadFile';

const STAGES = ['解析', '切分', '向量化', '入库'] as const;
/** 等待态的阶段切换阈值（毫秒）：只用于让使用者看到流水线顺序，不是真实进度 */
const STAGE_THRESHOLDS = [0, 1200, 2600, 6000];

/** 可聚焦候选：排除 disabled、tabindex="-1" 与不可见元素（隐藏的文件 input 走这条排除） */
const FOCUSABLE_SELECTOR = 'button, input, textarea, [tabindex]';

/** 不可见元素不参与焦点循环；getComputedStyle 覆盖行内 display/visibility */
function isVisible(element: HTMLElement): boolean {
  if (element.hidden) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function focusablesIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !(element as HTMLButtonElement).disabled && element.tabIndex >= 0 && isVisible(element),
  );
}

/** 依次尝试候选元素，确保焦点真正落在面板内；全部失败时聚焦面板本身 */
function focusInto(panel: HTMLElement, preferred?: HTMLElement | null): void {
  const candidates = preferred ? [preferred, ...focusablesIn(panel)] : focusablesIn(panel);
  for (const candidate of candidates) {
    candidate.focus();
    if (panel.contains(document.activeElement)) return;
  }
  panel.focus();
}

function activeStage(elapsed: number): number {
  let index = 0;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i += 1) {
    const threshold = STAGE_THRESHOLDS[i];
    if (threshold !== undefined && elapsed >= threshold) index = i;
  }
  return index;
}

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
  const [file, setFile] = useState<File | null>(null);
  const [docId, setDocId] = useState('');
  const [docIdEdited, setDocIdEdited] = useState(false);
  const [ack, setAck] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [wasOverwrite, setWasOverwrite] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setDocId('');
    setDocIdEdited(false);
    setAck(false);
    setFileError(null);
    setIdError(null);
    setSubmitError(null);
    setBusy(false);
    setElapsed(0);
    setResult(null);
    setWasOverwrite(false);
    const panel = panelRef.current;
    if (panel) focusInto(panel, chooseButtonRef.current);
  }, [open]);

  // 焦点陷阱：对话框打开期间，焦点一旦落到面板外就拉回来
  useEffect(() => {
    if (!open) return;
    const handleFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = event.target;
      if (target instanceof Node && panel.contains(target)) return;
      focusInto(panel, chooseButtonRef.current);
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [open]);
  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (!open || busy) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, busy, onClose]);

  const overwriteTarget = existing.find((doc) => doc.docId === docId) ?? null;

  const chooseFile = (next: File | null) => {
    setResult(null);
    setSubmitError(null);
    if (!next) {
      setFile(null);
      return;
    }
    const message = validateUploadFile(next);
    setFileError(message);
    if (message) {
      setFile(null);
      return;
    }
    setFile(next);
    if (!docIdEdited) setDocId(docIdFromFileName(next.name));
  };

  const handleSubmit = async () => {
    if (!file) {
      setFileError('请先选择文件');
      return;
    }
    const fileMessage = validateUploadFile(file);
    if (fileMessage) {
      setFileError(fileMessage);
      return;
    }
    const idMessage = validateDocId(docId);
    if (idMessage) {
      setIdError(idMessage);
      return;
    }
    if (overwriteTarget && !ack) {
      setSubmitError('请先勾选覆盖确认');
      return;
    }

    setBusy(true);
    setSubmitError(null);
    setResult(null);
    setElapsed(0);
    try {
      const response = await uploadDocument(file, docId);
      setResult(response);
      setWasOverwrite(overwriteTarget !== null);
      onUploaded(response.docId);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : '上传失败');
    } finally {
      setBusy(false);
    }
  };

  // 焦点陷阱：Tab / Shift+Tab 在面板内的可见可交互元素之间循环，焦点不在面板时先拉回来
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = focusablesIn(panel);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      const index = focusables.indexOf(active as HTMLElement);
      // 焦点不在任何可见控件上（面板本身或面板外）：直接送入边界控件
      if (index < 0) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && index === 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && index === focusables.length - 1) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open]);

  if (!open) return null;

  const stage = activeStage(elapsed);

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
                      <span className="ml-2 text-meta text-muted">
                        {formatBytes(file.size)}
                      </span>
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
                  onChange={(event) => {
                    setDocId(event.target.value);
                    setDocIdEdited(true);
                    setIdError(null);
                  }}
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
                <div className="mt-3 rounded-card border border-warnLine bg-warnSoft px-3 py-2.5">
                  <label className="flex cursor-pointer items-start gap-2 text-small leading-relaxed text-warn">
                    <input
                      type="checkbox"
                      checked={ack}
                      disabled={busy}
                      onChange={(event) => {
                        setAck(event.target.checked);
                        setSubmitError(null);
                      }}
                      className="mt-0.5 accent-warn"
                    />
                    <span>
                      该 docId 已存在（{overwriteTarget.docTitle}），将删除其原有的{' '}
                      {formatThousands(overwriteTarget.chunkCount)} 个切片并重建，旧内容不可恢复。
                    </span>
                  </label>
                </div>
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

              {busy ? (
                <div className="mt-4 rounded-card border border-line bg-panel2 px-4 py-3">
                  <div className="flex items-center justify-between text-meta text-muted">
                    <span>正在处理，上传完成前请勿关闭</span>
                    <span className="tabular-nums">已用 {(elapsed / 1000).toFixed(1)} s</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    {STAGES.map((label, index) => (
                      <div key={label} className="flex items-center gap-1.5">
                        {index > 0 ? <span className="text-line">—</span> : null}
                        <span
                          className={cx(
                            'inline-flex items-center gap-1.5 text-small',
                            index < stage
                              ? 'text-ok'
                              : index === stage
                                ? 'font-medium text-brand'
                                : 'text-muted',
                          )}
                        >
                          {index === stage ? (
                            <Spinner />
                          ) : (
                            <span
                              className={cx(
                                'h-1.5 w-1.5 rounded-full',
                                index < stage ? 'bg-ok' : 'bg-line',
                              )}
                            />
                          )}
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-meta text-muted">真实各段耗时以返回结果为准。</p>
                </div>
              ) : null}
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

function UploadResultSummary({ result, overwritten }: { result: UploadResult; overwritten: boolean }) {
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
