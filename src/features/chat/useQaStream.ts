import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { streamQa } from '@/api/qa';
import type { QaDone, QaSource } from '@/api/types';
import { createId } from '@/lib/format';

export type TurnStatus = 'streaming' | 'done' | 'stopped' | 'error';

export interface Turn {
  id: string;
  question: string;
  answer: string;
  sources: QaSource[];
  status: TurnStatus;
  error: string | null;
  meta: QaDone | null;
}

/**
 * 单轮问答：每次 ask 产生一条独立记录，历史只展示、不参与生成。
 * 停止/失败都保留已到达的来源与正文（PRD FR-04）。
 */
export function useQaStream() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((id: string, updater: (turn: Turn) => Turn) => {
    setTurns((previous) => previous.map((turn) => (turn.id === id ? updater(turn) : turn)));
  }, []);

  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const id = createId();
      const nextTurn: Turn = {
        id,
        question,
        answer: '',
        sources: [],
        status: 'streaming',
        error: null,
        meta: null,
      };
      setTurns((previous) => [...previous, nextTurn]);
      setActiveId(id);

      try {
        await streamQa(
          question,
          {
            onSources: (sources) => patch(id, (turn) => ({ ...turn, sources })),
            onDelta: (text) => patch(id, (turn) => ({ ...turn, answer: turn.answer + text })),
            onDone: (done) => patch(id, (turn) => ({ ...turn, status: 'done', meta: done })),
            onError: (message) =>
              patch(id, (turn) => ({ ...turn, status: 'error', error: message })),
          },
          controller.signal,
        );
      } catch (cause) {
        const aborted =
          (cause instanceof DOMException && cause.name === 'AbortError') ||
          (cause instanceof Error && cause.name === 'AbortError');
        if (aborted) {
          patch(id, (turn) => ({ ...turn, status: 'stopped' }));
        } else {
          const message =
            cause instanceof ApiError ? cause.message : '连接中断，请重试';
          patch(id, (turn) => ({ ...turn, status: 'error', error: message }));
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setActiveId(null);
        }
      }
    },
    [patch],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { turns, activeId, ask, stop };
}
