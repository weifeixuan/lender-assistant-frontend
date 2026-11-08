import { DEV_USER_ID } from '../lib/identity';
import type { ApiEnvelope } from './types';

/** 统一错误：message 直接取服务端 msg 原文，不做二次改写 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: number | null;

  constructor(message: string, status: number, code: number | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/** mock 只在 api 层生效，组件无感知（见 AGENTS.md §5） */
export function isMockEnabled(): boolean {
  if (import.meta.env.VITE_USE_MOCK === 'true') return true;
  try {
    return new URLSearchParams(window.location.search).get('mock') === '1';
  } catch {
    return false;
  }
}

export function apiPath(path: string): string {
  return `${baseUrl}${path}`;
}

/**
 * 所有请求统一注入开发期用户标识；调用方传入的同名头会被覆盖，
 * 避免各调用点自行拼装（见 spec 中「请求头统一注入」）。
 */
export function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set('X-User-Id', DEV_USER_ID);
  return headers;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readEnvelope<T>(payload: unknown): ApiEnvelope<T> | null {
  if (!isRecord(payload)) return null;
  const { code, msg, data } = payload;
  if (typeof code !== 'number') return null;
  return { code, msg: typeof msg === 'string' ? msg : '', data: data as T };
}

function readMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  return typeof payload.msg === 'string' && payload.msg ? payload.msg : null;
}

/** 普通请求的超时默认值；上传等长耗时接口可显式放大 */
const DEFAULT_TIMEOUT_MS = 30_000;

export interface RequestOptions extends RequestInit {
  /** 毫秒；超时后 abort 并抛出可读的 ApiError */
  timeoutMs?: number;
}

/**
 * 普通接口请求：解包 {code,msg,data}，失败抛 ApiError。
 * 服务端 GlobalExceptionHandler 会同时给出 HTTP 状态与 body.code，两者都保留。
 */
export async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init ?? {};
  const controller = new AbortController();
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(apiPath(path), {
      ...rest,
      headers: authHeaders(rest.headers),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      timedOut ? '请求超时，请稍后重试' : '连接中断，请确认后端服务已启动后重试',
      0,
      null,
    );
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(
        response.ok ? '响应格式不是合法 JSON' : `服务端返回 ${response.status}，无法解析响应内容`,
        response.status,
        null,
      );
    }
  }

  if (!response.ok) {
    throw new ApiError(
      readMessage(payload) ?? `请求失败（HTTP ${response.status}）`,
      response.status,
      isRecord(payload) && typeof payload.code === 'number' ? payload.code : null,
    );
  }

  const envelope = readEnvelope<T>(payload);
  if (!envelope) {
    throw new ApiError('响应缺少统一包装结构 {code,msg,data}', response.status, null);
  }
  if (envelope.code !== 200) {
    throw new ApiError(
      envelope.msg || `请求失败（code=${envelope.code}）`,
      response.status,
      envelope.code,
    );
  }
  return envelope.data;
}
