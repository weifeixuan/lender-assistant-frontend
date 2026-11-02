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
});
