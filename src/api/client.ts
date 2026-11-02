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

/**
 * 普通接口请求：解包 {code,msg,data}，失败抛 ApiError。
 * 服务端 GlobalExceptionHandler 会同时给出 HTTP 状态与 body.code，两者都保留。
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiPath(path), init);
  } catch {
    throw new ApiError('连接中断，请确认后端服务已启动后重试', 0, null);
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

/** 网络断开类错误的统一识别，用于决定是否展示「重试」 */
export function isRetryable(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}
