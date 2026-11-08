import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listDocuments } from '@/api/documents';
import type { DocSummary } from '@/api/types';
import { KnowledgeProvider, useKnowledge } from './knowledge';

vi.mock('@/api/documents', () => ({ listDocuments: vi.fn() }));

const mockedList = vi.mocked(listDocuments);

function doc(docId: string): DocSummary {
  return {
    docId,
    docTitle: docId,
    sourcePath: `${docId}.txt`,
    chunkCount: 1,
    charCountTotal: 100,
    updateTime: '2026-01-01 10:00:00',
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderKnowledge() {
  return renderHook(() => useKnowledge(), {
    wrapper: ({ children }) => <KnowledgeProvider>{children}</KnowledgeProvider>,
  });
}

describe('KnowledgeProvider reload races', () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it('ignores a stale reload response so the newest document list wins', async () => {
    const first = deferred<DocSummary[]>();
    const second = deferred<DocSummary[]>();
    mockedList.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderKnowledge();
    act(() => {
      void result.current.reload();
    });

    await act(async () => {
      second.resolve([doc('new-doc')]);
      await second.promise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.docCount).toBe(1);
    expect(result.current.documents[0]?.docId).toBe('new-doc');

    await act(async () => {
      first.resolve([doc('old-doc')]);
      await first.promise;
    });

    expect(result.current.docCount).toBe(1);
    expect(result.current.documents[0]?.docId).toBe('new-doc');
    expect(result.current.error).toBeNull();
  });
});
