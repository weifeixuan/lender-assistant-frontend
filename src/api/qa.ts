import { ApiError, apiPath, authHeaders, isMockEnabled } from './client';
import {
  MOCK_ANSWER,
  MOCK_EMPTY_ANSWER,
  beginMockRound,
  consumeMockGenerationFailure,
  consumeMockNetworkFailure,
  delay,
  deleteConversationMock,
  finishMockRound,
  mockQaSources,
} from './mock';
import { parseSseBlock } from './sse';
import type {
  QaDone,
  QaMeta,
  QaPlan,
  QaPlanStep,
  QaRoute,
  QaRouteKind,
  QaSource,
  QaStep,
  QaStepStatus,
} from './types';

export interface QaHandlers {
  /** 首个事件：后端懒创建会话后回传本轮真实 id */
  onMeta: (meta: QaMeta) => void;
  /** PLAN 路径才有：路由结论 */
  onRoute: (route: QaRoute) => void;
  /** PLAN 路径才有：计划步骤与降级标记 */
  onPlan: (plan: QaPlan) => void;
  /** PLAN 路径才有：按 stepId 覆盖的单步进度 */
  onStep: (step: QaStep) => void;
  onSources: (sources: QaSource[]) => void;
  onDelta: (text: string) => void;
  onDone: (done: QaDone) => void;
  onError: (message: string) => void;
}

const PAGE_SIZE = 6;
const MOCK_PROVIDER = 'MockLlmProvider';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** meta 四字段必须全部为非空字符串，任一缺失按协议错误处理 */
export function parseMeta(data: string): QaMeta | null {
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;
  const { conversationId, roundId, userMessageId, assistantMessageId } = payload;
  if (
    typeof conversationId !== 'string' ||
    typeof roundId !== 'string' ||
    typeof userMessageId !== 'string' ||
    typeof assistantMessageId !== 'string' ||
    !conversationId ||
    !roundId ||
    !userMessageId ||
    !assistantMessageId
  ) {
    return null;
  }
  return { conversationId, roundId, userMessageId, assistantMessageId };
}

function isRouteKind(value: unknown): value is QaRouteKind {
  return value === 'IRRELEVANT' || value === 'KNOWLEDGE' || value === 'PLAN';
}

function isStepStatus(value: unknown): value is QaStepStatus {
  return (
    value === 'PENDING' ||
    value === 'RUNNING' ||
    value === 'DONE' ||
    value === 'DEGRADED' ||
    value === 'FAILED' ||
    value === 'SKIPPED'
  );
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** route：未知取值按「不认识的事件」忽略，交给后端 fail-open 保证 */
function parseRoute(data: string): QaRoute | null {
  const payload = parseJson(data);
  if (!isRecord(payload)) return null;
  const { route, confidence } = payload;
  if (!isRouteKind(route) || typeof confidence !== 'number') return null;
  return { route, confidence };
}

function parsePlanStep(item: unknown): QaPlanStep | null {
  if (!isRecord(item)) return null;
  const { stepId, order, title, tool } = item;
  if (
    typeof stepId !== 'string' ||
    !stepId ||
    typeof order !== 'number' ||
    typeof title !== 'string' ||
    typeof tool !== 'string'
  ) {
    return null;
  }
  return { stepId, order, title, tool };
}

function parsePlan(data: string): QaPlan | null {
  const payload = parseJson(data);
  if (!isRecord(payload)) return null;
  const { degraded, goal, steps } = payload;
  if (typeof degraded !== 'boolean' || typeof goal !== 'string' || !Array.isArray(steps)) {
    return null;
  }
  const parsed: QaPlanStep[] = [];
  for (const item of steps) {
    const step = parsePlanStep(item);
    if (!step) return null;
    parsed.push(step);
  }
  return { degraded, goal, steps: parsed };
}

function parseStep(data: string): QaStep | null {
  const payload = parseJson(data);
  if (!isRecord(payload)) return null;
  const { stepId, status, elapsedMillis } = payload;
  if (typeof stepId !== 'string' || !stepId || !isStepStatus(status)) return null;
  return {
    stepId,
    status,
    elapsedMillis: typeof elapsedMillis === 'number' ? elapsedMillis : null,
  };
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

function isAbort(cause: unknown): boolean {
  return (
    (cause instanceof DOMException && cause.name === 'AbortError') ||
    (cause instanceof Error && cause.name === 'AbortError')
  );
}

function messageOf(cause: unknown): string {
  return cause instanceof ApiError ? cause.message : '连接中断，请确认后端服务已启动后重试';
}

/**
 * mock 流：模拟后端懒创建会话与事件节奏。
 * 演示用关键词：空召回「空/不存在/没有资料」、生成失败「失败/生成失败」、
 * 会话不存在「404/已删除」、会话忙碌「409/正在生成」、网络中断「断网/网络」。
 */
async function streamQaMock(
  conversationId: string | null,
  question: string,
  handlers: QaHandlers,
  signal: AbortSignal,
): Promise<void> {
  await delay(280, signal);

  if (conversationId !== null) {
    if (/404|已删除/.test(question)) {
      // 模拟真实后端：404 表示会话已不存在，后续列表刷新也不应再出现
      await deleteConversationMock(conversationId).catch(() => undefined);
      throw new ApiError('会话不存在或已删除', 404, 404);
    }
    if (/409|正在生成/.test(question)) {
      throw new ApiError('该会话正在生成回答，请稍后', 409, 409);
    }
  }

  const round = beginMockRound(conversationId, question);
  handlers.onMeta(round.meta);

  let answer = '';
  let sources: QaSource[] = [];

  try {
    if (/空|不存在|没有资料/.test(question)) {
      answer = MOCK_EMPTY_ANSWER;
      handlers.onDelta(answer);
      await delay(200, signal);
      finishMockRound(round, {
        status: 'DONE',
        content: answer,
        sources: [],
        provider: MOCK_PROVIDER,
        elapsedMillis: 480,
        error: null,
      });
      handlers.onDone({ provider: MOCK_PROVIDER, elapsedMillis: 480, sourceCount: 0 });
      return;
    }

    sources = mockQaSources();
    handlers.onSources(sources);
    await delay(240, signal);

    for (let offset = 0; offset < MOCK_ANSWER.length; offset += PAGE_SIZE) {
      await delay(70, signal);
      const piece = MOCK_ANSWER.slice(offset, offset + PAGE_SIZE);
      answer += piece;
      handlers.onDelta(piece);
    }

    if (/失败|生成失败/.test(question) && consumeMockGenerationFailure()) {
      finishMockRound(round, {
        status: 'FAILED',
        content: answer,
        sources,
        provider: null,
        elapsedMillis: null,
        error: '模拟生成失败：模型服务暂不可用',
      });
      handlers.onError('模拟生成失败：模型服务暂不可用');
      return;
    }

    if (/断网|网络/.test(question) && consumeMockNetworkFailure()) {
      throw new ApiError('连接中断，请确认后端服务已启动后重试', 0, null);
    }

    await delay(140, signal);
    finishMockRound(round, {
      status: 'DONE',
      content: answer,
      sources,
      provider: MOCK_PROVIDER,
      elapsedMillis: 1860,
      error: null,
    });
    handlers.onDone({ provider: MOCK_PROVIDER, elapsedMillis: 1860, sourceCount: sources.length });
  } catch (cause) {
    if (isAbort(cause)) {
      finishMockRound(round, {
        status: 'STOPPED',
        content: answer,
        sources,
        provider: null,
        elapsedMillis: null,
        error: null,
      });
    } else {
      finishMockRound(round, {
        status: 'FAILED',
        content: answer,
        sources,
        provider: null,
        elapsedMillis: null,
        error: messageOf(cause),
      });
    }
    throw cause;
  }
}

/**
 * POST /api/qa 的 SSE 消费。
 * 事件顺序：meta → [sources] → delta* → done，异常事件为 error。
 * 调用方负责处理 AbortError（用户停止）与网络异常。
 */
export async function streamQa(
  conversationId: string | null,
  question: string,
  handlers: QaHandlers,
  signal: AbortSignal,
): Promise<void> {
  if (isMockEnabled()) {
    await streamQaMock(conversationId, question, handlers, signal);
    return;
  }

  const body: { question: string; conversationId?: string } = { question };
  if (conversationId !== null) body.conversationId = conversationId;

  const response = await fetch(apiPath('/api/qa'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    let message = `请求失败（HTTP ${response.status}）`;
    try {
      const payload: unknown = JSON.parse(text);
      if (isRecord(payload) && typeof payload.msg === 'string' && payload.msg)
        message = payload.msg;
    } catch {
      // 非 JSON 错误体，保留状态码文案
    }
    throw new ApiError(message, response.status, null);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  /** 本轮已有终态：协议异常或 error 事件后不再消费，避免界面卡在流式中 */
  let halted = false;

  const dispatch = (block: string) => {
    if (halted) return;
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    switch (parsed.event) {
      case 'meta': {
        const meta = parseMeta(parsed.data);
        if (!meta) {
          halted = true;
          handlers.onError('响应协议异常：缺少会话元信息');
          return;
        }
        handlers.onMeta(meta);
        break;
      }
      case 'route': {
        const route = parseRoute(parsed.data);
        if (route) handlers.onRoute(route);
        break;
      }
      case 'plan': {
        const plan = parsePlan(parsed.data);
        if (plan) handlers.onPlan(plan);
        break;
      }
      case 'step': {
        const step = parseStep(parsed.data);
        if (step) handlers.onStep(step);
        break;
      }
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
        if (!done) {
          halted = true;
          handlers.onError('响应协议异常：缺少完成信息');
          return;
        }
        handlers.onDone(done);
        // done 即本轮终态：停止消费并释放连接，避免后端迟迟不 close 时界面卡在流式中
        halted = true;
        break;
      }
      case 'error':
        handlers.onError(parsed.data);
        // 后端推完 error 后 completeWithError 断流，浏览器可能长时间不结束读取；
        // error 即本轮终态，立即停止消费并释放连接，否则输入区会卡在「回答生成中」
        halted = true;
        break;
      default:
        // 契约只定义上述事件，未知事件忽略
        break;
    }
  };

  try {
    while (!halted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.indexOf('\n\n');
      while (separator >= 0) {
        dispatch(buffer.slice(0, separator));
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');
        if (halted) break;
      }
    }
    if (!halted && buffer.trim()) dispatch(buffer);
  } finally {
    if (halted) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
