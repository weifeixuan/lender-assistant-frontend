import { useEffect, useRef, useState } from 'react';
import { uploadDocument } from '@/api/documents';
import type { DocSummary, UploadResult } from '@/api/types';
import { docIdFromFileName, validateDocId, validateUploadFile } from '@/lib/uploadFile';

/**
 * 上传任务状态与副作用：文件校验、docId 生成与校验、覆盖确认、提交、等待态计时。
 * 弹窗只负责把这些能力编排到界面上。
 */
export function useUploadTask({
  open,
  existing,
  onUploaded,
}: {
  open: boolean;
  existing: DocSummary[];
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

  // 每次打开都回到干净的初始态，避免上一次的上传结果或错误残留
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
  }, [open]);

  // 等待态计时：真实耗时以响应 millis 为准，这里只驱动四段文案
  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => window.clearInterval(timer);
  }, [busy]);

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

  const handleDocIdChange = (value: string) => {
    setDocId(value);
    setDocIdEdited(true);
    setIdError(null);
  };

  const handleAckChange = (checked: boolean) => {
    setAck(checked);
    setSubmitError(null);
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

  return {
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
  };
}
