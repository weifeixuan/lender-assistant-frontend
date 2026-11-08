import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEV_USER_ID } from '../lib/identity';
import { authHeaders, request } from './client';

const OK_ENVELOPE = JSON.stringify({ code: 200, msg: 'ok', data: [] });

function fakeResponse(): Response {
  return {
    ok: true,
    status: 200,
    text: async () => OK_ENVELOPE,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authHeaders', () => {
  it('always sets X-User-Id to the development user id', () => {
    const headers = authHeaders();
    expect(headers.get('X-User-Id')).toBe(DEV_USER_ID);
  });

  it('keeps extra request headers', () => {
    const headers = authHeaders({ 'Content-Type': 'application/json' });
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('overrides a caller-provided X-User-Id instead of trusting it', () => {
    const headers = authHeaders({ 'X-User-Id': 'someone-else' });
    expect(headers.get('X-User-Id')).toBe(DEV_USER_ID);
  });
});

describe('request', () => {
  it('injects X-User-Id into the actual fetch call', async () => {
    const captured: Headers[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured.push(new Headers(init?.headers));
      return fakeResponse();
    });
    vi.stubGlobal('fetch', fetchMock);

    await request('/api/conversations');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(captured.at(0)?.get('X-User-Id')).toBe(DEV_USER_ID);
  });

  it('aborts a slow request and maps the timeout to a readable ApiError', async () => {
    let aborted = false;
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('/api/slow', { timeoutMs: 10 })).rejects.toMatchObject({
      message: '请求超时，请稍后重试',
      status: 0,
    });
    expect(aborted).toBe(true);
  });

  it('forwards caller cancellation and reports a connection interruption', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          const rejectAborted = () => reject(new DOMException('Aborted', 'AbortError'));
          if (signal?.aborted) rejectAborted();
          else signal?.addEventListener('abort', rejectAborted);
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const promise = request('/api/conversations', { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({
      message: '连接中断，请确认后端服务已启动后重试',
      status: 0,
    });
  });
});
