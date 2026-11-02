import { ApiError, apiPath, isMockEnabled } from './client';
import { MOCK_ANSWER, MOCK_EMPTY_ANSWER, delay, mockQaSources } from './mock';
import { parseSseBlock } from './sse';
import type { QaDone, QaSource } from './types';

export interface QaHandlers {
  onSources: (sources: QaSource[]) => void;
  onDelta: (text: string) => void;
  onDone: (done: QaDone) => void;
  onError: (message: string) => void;
}

const PAGE_SIZE = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 只做最小形状校验，字段语义错误由后端契约保证 */
function parseSources(data: string): QaSource[] | null {
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }
  if (!Array.isArray(payload)) return null;
  const sources: QaSource[] = [];
  for (const item of payload) {
    if (!isRecord(item) || typeof item.idx !== 'number') return null;
    sources.push({
      idx: item.idx,
      docTitle: typeof item.docTitle === 'string' ? item.docTitle : '',
      sectionPath: typeof item.sectionPath === 'string' ? item.sectionPath : null,
      chunkId: typeof item.chunkId === 'number' ? item.chunkId : 0,
      content: typeof item.content === 'string' ? item.content : '',
      vectorDistance: typeof item.vectorDistance === 'number' ? item.vectorDistance : null,
      keywordHits: typeof item.keywordHits === 'number' ? item.keywordHits : null,
      bothChannels: item.bothChannels === true,
      rrfScore: typeof item.rrfScore === 'string' ? item.rrfScore : '',
    });
  }
  return sources;
}

function parseDone(data: string): QaDone | null {
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(payload) || typeof payload.sourceCount !== 'number') return null;
  return {
    provider: typeof payload.provider === 'string' ? payload.provider : '未知',
    elapsedMillis: typeof payload.elapsedMillis === 'number' ? payload.elapsedMillis : 0,
    sourceCount: payload.sourceCount,
  };
}

async function streamQaMock(
  question: string,
  handlers: QaHandlers,
  signal: AbortSignal,
): Promise<void> {
  await delay(600, signal);

  // 约定：问题里带「空 / 不存在 / 没有资料」时演示未召回分支
  if (/空|不存在|没有资料/.test(question)) {
    handlers.onDelta(MOCK_EMPTY_ANSWER);
    await delay(200, signal);
    handlers.onDone({ provider: 'MockLlmProvider', elapsedMillis: 480, sourceCount: 0 });
    return;
  }

  const sources = mockQaSources();
  handlers.onSources(sources);
  await delay(240, signal);

  for (let offset = 0; offset < MOCK_ANSWER.length; offset += PAGE_SIZE) {
    await delay(30, signal);
    handlers.onDelta(MOCK_ANSWER.slice(offset, offset + PAGE_SIZE));
  }

  await delay(140, signal);
  handlers.onDone({ provider: 'MockLlmProvider', elapsedMillis: 1860, sourceCount: sources.length });
}

/**
 * POST /api/qa 的 SSE 消费。
 * 事件顺序固定 sources → delta* → done，异常事件为 error。
 * 调用方负责处理 AbortError（用户停止）与网络异常。
 */
export async function streamQa(
  question: string,
  handlers: QaHandlers,
  signal: AbortSignal,
): Promise<void> {
  if (isMockEnabled()) {
    await streamQaMock(question, handlers, signal);
    return;
  }

  const response = await fetch(apiPath('/api/qa'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    let message = `请求失败（HTTP ${response.status}）`;
    try {
      const payload: unknown = JSON.parse(text);
      if (isRecord(payload) && typeof payload.msg === 'string' && payload.msg) message = payload.msg;
    } catch {
      // 非 JSON 错误体，保留状态码文案
    }
    throw new ApiError(message, response.status, null);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const dispatch = (block: string) => {
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    switch (parsed.event) {
      case 'sources': {
        const sources = parseSources(parsed.data);
        if (sources) handlers.onSources(sources);
        break;
      }
      case 'delta':
        handlers.onDelta(parsed.data);
        break;
      case 'done': {
        const done = parseDone(parsed.data);
        if (done) handlers.onDone(done);
        break;
      }
      case 'error':
        handlers.onError(parsed.data);
        break;
      default:
        // 契约只定义上述四种事件，未知事件忽略
        break;
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf('\n\n');
      while (separator >= 0) {
        dispatch(buffer.slice(0, separator));
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim()) dispatch(buffer);
  } finally {
    reader.releaseLock();
  }
}
