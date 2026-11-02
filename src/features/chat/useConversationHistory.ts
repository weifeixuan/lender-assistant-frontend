import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { listMessages } from '@/api/conversations';
import type { MessageItem } from '@/api/types';

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

export type HistoryResult =
  | { kind: 'ok'; messages: MessageItem[] }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'cancelled' };

/**
 * 单会话历史加载。只返回 MessageItem[]，不持有 Turn[]；
 * 快速切换时旧请求的响应必须被丢弃（用递增序号 + AbortController 双保险）。
 */
export function useConversationHistory() {
  const [status, setStatus] = useState<HistoryStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const load = useCallback(async (conversationId: string): Promise<HistoryResult> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    seqRef.current += 1;
    const seq = seqRef.current;

    setStatus('loading');
    setError(null);

    try {
      const data = await listMessages(conversationId, controller.signal);
      if (seq !== seqRef.current) return { kind: 'cancelled' };
      setStatus('ready');
      return { kind: 'ok', messages: data.messages };
    } catch (cause) {
      if (seq !== seqRef.current) return { kind: 'cancelled' };
      const aborted =
        (cause instanceof DOMException && cause.name === 'AbortError') ||
        (cause instanceof Error && cause.name === 'AbortError');
      if (aborted) return { kind: 'cancelled' };
      if (cause instanceof ApiError && cause.status === 404) {
        setStatus('ready');
        return { kind: 'missing' };
      }
      const message = cause instanceof Error ? cause.message : '历史消息加载失败';
      setStatus('error');
      setError(message);
      return { kind: 'error', message };
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    seqRef.current += 1;
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, load, reset };
}
