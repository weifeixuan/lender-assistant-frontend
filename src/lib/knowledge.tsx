import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { listDocuments } from '@/api/documents';
import type { DocSummary } from '@/api/types';

/**
 * 两页共享的知识库概览状态（左侧导航与对话页页头都要用）。
 * 放在 lib/ 是因为它跨 features 复用；写操作（上传/删除）由文档页调用 reload 收敛。
 */
interface KnowledgeValue {
  documents: DocSummary[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  docCount: number;
  chunkCount: number;
  lastIngestedAt: string | null;
}

const KnowledgeContext = createContext<KnowledgeValue | null>(null);

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** 只接受最新一次 reload 的响应，避免慢请求把新结果覆盖回旧数据 */
  const reloadSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = reloadSeq.current + 1;
    reloadSeq.current = seq;
    setLoading(true);
    try {
      const data = await listDocuments();
      if (seq !== reloadSeq.current) return;
      setDocuments(data);
      setError(null);
    } catch (cause) {
      if (seq !== reloadSeq.current) return;
      setError(cause instanceof Error ? cause.message : '文档列表加载失败');
    } finally {
      if (seq === reloadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<KnowledgeValue>(() => {
    const chunkCount = documents.reduce((sum, doc) => sum + doc.chunkCount, 0);
    const lastIngestedAt = documents.reduce<string | null>((latest, doc) => {
      if (!latest) return doc.updateTime;
      return doc.updateTime > latest ? doc.updateTime : latest;
    }, null);
    return {
      documents,
      loading,
      error,
      reload,
      docCount: documents.length,
      chunkCount,
      lastIngestedAt,
    };
  }, [documents, loading, error, reload]);

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}

export function useKnowledge(): KnowledgeValue {
  const value = useContext(KnowledgeContext);
  if (!value) throw new Error('useKnowledge 必须在 KnowledgeProvider 内使用');
  return value;
}
