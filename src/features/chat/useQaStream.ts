import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { streamQa } from '@/api/qa';
import type { QaDone, QaMeta, QaSource } from '@/api/types';

export type TurnStatus = 'streaming' | 'done' | 'stopped' | 'error';

export interface Turn {
  /** 渲染 key：流式期间为 tmp-<seq>，收到 meta 后替换为 assistantMessageId */
  id: string;
  /** 服务端助手消息 id；收到 meta 前为 null */
  messageId: string | null;
  roundId: string | null;
  userMessageId: string | null;
  question: string;
  answer: string;
  sources: QaSource[];
  status: TurnStatus;
  error: string | null;
  meta: QaDone | null;
  origin: 'live' | 'history';
  createTime: string | null;
}

export type RejectedStatus = 400 | 404 | 409;

export type AskResult =
  | { kind: 'finished'; status: TurnStatus; hadMeta: boolean }
  | { kind: 'rejected'; status: RejectedStatus; message: string; question: string };

function isAbort(cause: unknown): boolean {
  return (
    (cause instanceof DOMException && cause.name === 'AbortError') ||
    (cause instanceof Error && cause.name === 'AbortError')
  );
}

function rejectedStatus(hadMeta: boolean, cause: unknown): RejectedStatus | null {
  if (hadMeta || !(cause instanceof ApiError)) return null;
  if (cause.status === 400 || cause.status === 404 || cause.status === 409) return cause.status;
  return null;
}

/**
 * 多轮问答流：每轮先以 tmp-<seq> 占位，收到 meta 后转成服务端 id。
 * 停止/失败都保留已到达的来源与正文；400/404/409 在流建立前回滚本轮。
 */
export function useQaStream({ onMeta }: { onMeta: (meta: QaMeta) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tempSeq = useRef(0);
  const metaHandler = useRef(onMeta);
  metaHandler.current = onMeta;

  const patch = useCallback((id: string, updater: (turn: Turn) => Turn) => {
    setTurns((previous) => previous.map((turn) => (turn.id === id ? updater(turn) : turn)));
  }, []);

  const removeTurn = useCallback((id: string) => {
    setTurns((previous) => previous.filter((turn) => turn.id !== id));
  }, []);

  const resetTurns = useCallback((next: Turn[]) => {
    setTurns(next);
  }, []);

  const clearTurns = useCallback(() => {
    setTurns([]);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const ask = useCallback(
    async (rawQuestion: string, conversationId: string | null): Promise<AskResult | null> => {
      const question = rawQuestion.trim();
      if (!question) return null;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      tempSeq.current += 1;
      const tempId = `tmp-${tempSeq.current}`;
      let currentId = tempId;
      let hadMeta = false;
      let finalStatus: TurnStatus = 'streaming';

      const nextTurn: Turn = {
        id: tempId,
        messageId: null,
        roundId: null,
        userMessageId: null,
        question,
        answer: '',
        sources: [],
        status: 'streaming',
        error: null,
        meta: null,
        origin: 'live',
        createTime: null,
      };
      setTurns((previous) => [...previous, nextTurn]);
      setStreamingTurnId(tempId);

      try {
        await streamQa(
          conversationId,
          question,
          {
            onMeta: (meta) => {
              hadMeta = true;
              currentId = meta.assistantMessageId;
              patch(tempId, (turn) => ({
                ...turn,
                id: meta.assistantMessageId,
                messageId: meta.assistantMessageId,
                roundId: meta.roundId,
                userMessageId: meta.userMessageId,
              }));
              metaHandler.current(meta);
            },
            onSources: (sources) => patch(currentId, (turn) => ({ ...turn, sources })),
            onDelta: (text) =>
              patch(currentId, (turn) => ({ ...turn, answer: turn.answer + text })),
            onDone: (done) => {
              finalStatus = 'done';
              patch(currentId, (turn) => ({ ...turn, status: 'done', meta: done }));
            },
            onError: (message) => {
              finalStatus = 'error';
              patch(currentId, (turn) => ({ ...turn, status: 'error', error: message }));
            },
          },
          controller.signal,
        );
      } catch (cause) {
        if (isAbort(cause)) {
          patch(currentId, (turn) => ({ ...turn, status: 'stopped' }));
          return { kind: 'finished', status: 'stopped', hadMeta };
        }
        const rejected = rejectedStatus(hadMeta, cause);
        if (rejected !== null) {
          removeTurn(currentId);
          return {
            kind: 'rejected',
            status: rejected,
            message: cause instanceof ApiError ? cause.message : '请求被拒绝',
            question,
          };
        }
        const message =
          cause instanceof ApiError ? cause.message : '连接中断，请确认后端服务已启动后重试';
        patch(currentId, (turn) => ({ ...turn, status: 'error', error: message }));
        return { kind: 'finished', status: 'error', hadMeta };
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setStreamingTurnId(null);
        }
      }

      return { kind: 'finished', status: finalStatus === 'streaming' ? 'done' : finalStatus, hadMeta };
    },
    [patch, removeTurn],
  );

  return { turns, streamingTurnId, ask, stop, resetTurns, clearTurns, removeTurn };
}
