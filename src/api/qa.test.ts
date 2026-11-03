import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { listConversationsMock, listMessagesMock, resetConversationsMock } from './mock';
import { parseMeta, streamQa } from './qa';
import { DEV_USER_ID } from '@/lib/identity';
import type { QaDone, QaMeta, QaSource } from './types';

describe('parseMeta', () => {
  it('accepts all four non-empty fields', () => {
    const meta = parseMeta(
      JSON.stringify({
        conversationId: 'c1',
        roundId: 'r1',
        userMessageId: 'u1',
        assistantMessageId: 'a1',
      }),
    );
    expect(meta).toEqual({
      conversationId: 'c1',
      roundId: 'r1',
      userMessageId: 'u1',
      assistantMessageId: 'a1',
    });
  });

  it('rejects missing, empty or non-string fields', () => {
    expect(parseMeta('{}')).toBeNull();
    expect(
      parseMeta(
        JSON.stringify({ conversationId: 'c1', roundId: 'r1', userMessageId: 'u1' }),
      ),
    ).toBeNull();
    expect(
      parseMeta(
        JSON.stringify({
          conversationId: '',
          roundId: 'r1',
          userMessageId: 'u1',
          assistantMessageId: 'a1',
        }),
      ),
    ).toBeNull();
    expect(
      parseMeta(
        JSON.stringify({
          conversationId: 'c1',
          roundId: 1,
          userMessageId: 'u1',
          assistantMessageId: 'a1',
        }),
      ),
    ).toBeNull();
  });

  it('rejects non-JSON payloads', () => {
    expect(parseMeta('not-json')).toBeNull();
  });
});

describe('streamQa mock', () => {
  beforeEach(() => {
    resetConversationsMock();
    window.history.replaceState({}, '', '/?mock=1');
  });

  it('emits meta first, then sources, deltas and done', async () => {
    const events: string[] = [];
    const metas: QaMeta[] = [];
    let sources: QaSource[] = [];
    const dones: QaDone[] = [];

    await streamQa(
      null,
      '首套贷款成数上限是多少',
      {
        onMeta: (value) => {
          events.push('meta');
          metas.push(value);
        },
        onSources: (value) => {
          events.push('sources');
          sources = value;
        },
        onDelta: () => {
          if (!events.includes('delta')) events.push('delta');
        },
        onDone: (value) => {
          events.push('done');
          dones.push(value);
        },
        onError: () => events.push('error'),
      },
      new AbortController().signal,
    );

    const meta = metas.at(0);
    const done = dones.at(0);
    if (!meta || !done) throw new Error('mock 未回传 meta 或 done');
    expect(events).toEqual(['meta', 'sources', 'delta', 'done']);
    expect(sources).toHaveLength(4);
    expect(done.sourceCount).toBe(4);

    const list = await listConversationsMock();
    expect(list).toHaveLength(1);
    expect(list[0]?.conversationId).toBe(meta.conversationId);
    expect(list[0]?.title).toBe('首套贷款成数上限是多少');

    const history = await listMessagesMock(meta.conversationId);
    expect(history.messages.map((item) => item.role)).toEqual(['USER', 'ASSISTANT']);
    expect(history.messages[1]?.roundId).toBe(meta.roundId);
    expect(history.messages[1]?.status).toBe('DONE');
    expect(history.messages[1]?.sources).toHaveLength(4);
  });

  it('skips sources when nothing is recalled', async () => {
    let sources: QaSource[] = [];
    const dones: QaDone[] = [];

    await streamQa(
      null,
      '没有资料的问题',
      {
        onMeta: () => undefined,
        onSources: (value) => {
          sources = value;
        },
        onDelta: () => undefined,
        onDone: (value) => {
          dones.push(value);
        },
        onError: () => undefined,
      },
      new AbortController().signal,
    );

    expect(sources).toEqual([]);
    expect(dones.at(0)?.sourceCount).toBe(0);
  });

  it('rejects with 404 when the conversation does not exist', async () => {
    await expect(
      streamQa(
        'missing-conversation',
        '任意问题',
        {
          onMeta: () => undefined,
          onSources: () => undefined,
          onDelta: () => undefined,
          onDone: () => undefined,
          onError: () => undefined,
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      streamQa(
        'missing-conversation',
        '任意问题',
        {
          onMeta: () => undefined,
          onSources: () => undefined,
          onDelta: () => undefined,
          onDone: () => undefined,
          onError: () => undefined,
        },
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

function sseBody(blocks: string[]): string {
  return `${blocks.join('\n\n')}\n\n`;
}

function emptyHandlers(overrides: Partial<Parameters<typeof streamQa>[2]> = {}) {
  return {
    onMeta: () => undefined,
    onSources: () => undefined,
    onDelta: () => undefined,
    onDone: () => undefined,
    onError: () => undefined,
    ...overrides,
  };
}

describe('streamQa real SSE', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts conversationId, injects X-User-Id and consumes the full event order', async () => {
    const body = sseBody([
      'event: meta\ndata: {"conversationId":"conv-1","roundId":"r2","userMessageId":"u2","assistantMessageId":"a2"}',
      'event: sources\ndata: []',
      'event: delta\ndata: 你好',
      'event: delta\ndata: 世界',
      'event: done\ndata: {"provider":"DashScope","elapsedMillis":800,"sourceCount":0}',
    ]);
    const response = new Response(body, { status: 200 });
    const fetchMock = vi.fn<typeof fetch>(async () => response);
    vi.stubGlobal('fetch', fetchMock);

    const events: string[] = [];
    const metas: QaMeta[] = [];
    const deltas: string[] = [];
    let done: QaDone | null = null;

    await streamQa(
      'conv-1',
      '追问',
      emptyHandlers({
        onMeta: (meta) => {
          events.push('meta');
          metas.push(meta);
        },
        onSources: () => events.push('sources'),
        onDelta: (text) => {
          if (!events.includes('delta')) events.push('delta');
          deltas.push(text);
        },
        onDone: (value) => {
          events.push('done');
          done = value;
        },
        onError: () => events.push('error'),
      }),
      new AbortController().signal,
    );

    const call = fetchMock.mock.calls.at(0);
    expect(call?.[0]).toBe('/api/qa');
    expect(call?.[1]?.method).toBe('POST');
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('X-User-Id')).toBe(DEV_USER_ID);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      question: '追问',
      conversationId: 'conv-1',
    });

    expect(events).toEqual(['meta', 'sources', 'delta', 'done']);
    expect(metas.at(0)?.roundId).toBe('r2');
    expect(deltas).toEqual(['你好', '世界']);
    expect(done).not.toBeNull();
  });

  it('omits conversationId for the first question', async () => {
    const response = new Response(
      sseBody([
        'event: meta\ndata: {"conversationId":"conv-2","roundId":"r1","userMessageId":"u1","assistantMessageId":"a1"}',
        'event: done\ndata: {"provider":"DashScope","elapsedMillis":500,"sourceCount":0}',
      ]),
      { status: 200 },
    );
    const fetchMock = vi.fn<typeof fetch>(async () => response);
    vi.stubGlobal('fetch', fetchMock);

    await streamQa(null, '首问', emptyHandlers(), new AbortController().signal);

    const call = fetchMock.mock.calls.at(0);
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ question: '首问' });
  });

  it('ends the round on an SSE error event without waiting for the connection to close', async () => {
    const blocks = [
      'event: meta\ndata: {"conversationId":"conv-4","roundId":"r4","userMessageId":"u4","assistantMessageId":"a4"}',
      'event: sources\ndata: []',
      'event: delta\ndata: 半截正文',
      'event: error\ndata: 问答失败：chaos: 模拟模型故障',
    ];
    const encoder = new TextEncoder();
    // 后端 completeWithError 断流后，浏览器侧的读取可能长时间悬挂：只发数据、不 close
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody(blocks)));
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })));

    const errors: string[] = [];
    const deltas: string[] = [];

    await streamQa(
      null,
      '任意问题',
      emptyHandlers({
        onDelta: (text) => deltas.push(text),
        onError: (message) => errors.push(message),
      }),
      new AbortController().signal,
    );

    expect(errors).toEqual(['问答失败：chaos: 模拟模型故障']);
    expect(deltas).toEqual(['半截正文']);
  });

  it('stops consuming after a malformed meta and reports it once', async () => {
    const response = new Response(
      sseBody([
        'event: meta\ndata: {"conversationId":"conv-3"}',
        'event: delta\ndata: 不应出现',
        'event: done\ndata: {"provider":"DashScope","elapsedMillis":1,"sourceCount":0}',
      ]),
      { status: 200 },
    );
    vi.stubGlobal('fetch', vi.fn(async () => response));

    const errors: string[] = [];
    const deltas: string[] = [];

    await streamQa(
      null,
      '首问',
      emptyHandlers({
        onError: (message) => errors.push(message),
        onDelta: (text) => deltas.push(text),
      }),
      new AbortController().signal,
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('响应协议异常');
    expect(deltas).toEqual([]);
  });
});
