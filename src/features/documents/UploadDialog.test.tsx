import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadDocument } from '@/api/documents';
import type { DocSummary, UploadResult } from '@/api/types';
import { UploadDialog } from './UploadDialog';

vi.mock('@/api/documents', () => ({ uploadDocument: vi.fn() }));

const mockedUpload = vi.mocked(uploadDocument);

const EXISTING: DocSummary = {
  docId: 'sample',
  docTitle: '示例文档',
  sourcePath: 'sample.txt',
  chunkCount: 12,
  charCountTotal: 3600,
  updateTime: '2026-01-01 00:00:00',
};

const OTHER: DocSummary = {
  docId: 'other',
  docTitle: '另一个文档',
  sourcePath: 'other.txt',
  chunkCount: 3,
  charCountTotal: 900,
  updateTime: '2025-12-01 00:00:00',
};

const RESULT: UploadResult = {
  docId: 'sample',
  blocks: 1,
  chunkCount: 1200,
  avgChunkChars: 42.5,
  millis: { parse: 120, split: 80, embed: 300, store: 40 },
  embeddingProvider: 'text-embedding-3-small',
};

function renderDialog(existing: DocSummary[] = []) {
  const onClose = vi.fn();
  const onUploaded = vi.fn();
  render(<UploadDialog open existing={existing} onClose={onClose} onUploaded={onUploaded} />);
  return { onClose, onUploaded };
}

function chooseFile(name: string) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('file input not found');
  const file = new File(['hello'], name, { type: 'text/plain' });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
}

describe('UploadDialog', () => {
  beforeEach(() => {
    mockedUpload.mockReset();
  });

  it('fills docId from the file name, uploads it and shows the result summary', async () => {
    mockedUpload.mockResolvedValue(RESULT);
    const { onUploaded } = renderDialog();

    const file = chooseFile('sample.txt');
    expect(screen.getByLabelText('docId')).toHaveValue('sample');

    fireEvent.click(screen.getByRole('button', { name: '上传入库' }));

    expect(await screen.findByText('已入库')).toBeInTheDocument();
    expect(mockedUpload).toHaveBeenCalledWith(file, 'sample');
    expect(onUploaded).toHaveBeenCalledWith('sample');
    expect(screen.getByText('1,200 个切片')).toBeInTheDocument();
    expect(screen.getByText('42.5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '完成' })).toBeInTheDocument();
  });

  it('rejects unsupported files in place and keeps the submit button disabled', () => {
    renderDialog();

    chooseFile('sample.pdf');

    expect(screen.getByText('仅支持 docx / txt / md 文件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上传入库' })).toBeDisabled();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('asks for overwrite acknowledgement before submitting an existing docId', async () => {
    mockedUpload.mockResolvedValue(RESULT);
    renderDialog([EXISTING]);

    chooseFile('sample.txt');
    expect(screen.getByText(/示例文档/)).toBeInTheDocument();
    expect(screen.getByText(/12 个切片并重建/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '上传入库' }));
    expect(screen.getByText('请先勾选覆盖确认')).toBeInTheDocument();
    expect(mockedUpload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '上传入库' }));

    expect(await screen.findByText('已重建 1,200 个切片')).toBeInTheDocument();
    expect(mockedUpload).toHaveBeenCalledTimes(1);
  });

  it('resets the overwrite acknowledgement when the docId changes', async () => {
    mockedUpload.mockResolvedValue(RESULT);
    renderDialog([EXISTING, OTHER]);

    chooseFile('sample.txt');
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.change(screen.getByLabelText('docId'), { target: { value: 'other' } });

    expect(screen.getByText(/另一个文档/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: '上传入库' }));
    expect(screen.getByText('请先勾选覆盖确认')).toBeInTheDocument();
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('keeps the server message and offers a retry when the upload fails', async () => {
    mockedUpload.mockRejectedValue(new Error('模型服务暂不可用'));
    renderDialog();

    chooseFile('sample.txt');
    fireEvent.click(screen.getByRole('button', { name: '上传入库' }));

    expect(await screen.findByText('模型服务暂不可用')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试上传' })).toBeInTheDocument();
  });

  it('shows the four-stage waiting state while the request is in flight', async () => {
    let resolveUpload: (value: UploadResult) => void = () => undefined;
    mockedUpload.mockImplementation(
      () =>
        new Promise<UploadResult>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    renderDialog();

    chooseFile('sample.txt');
    fireEvent.click(screen.getByRole('button', { name: '上传入库' }));

    expect(screen.getByText('正在处理，上传完成前请勿关闭')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '处理中…' })).toBeDisabled();
    for (const stage of ['解析', '切分', '向量化', '入库']) {
      expect(screen.getByText(stage)).toBeInTheDocument();
    }

    resolveUpload(RESULT);
    expect(await screen.findByText('已入库')).toBeInTheDocument();
  });

  it('closes on Escape when no upload is running', () => {
    const { onClose } = renderDialog();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
