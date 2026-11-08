import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamQa, type QaHandlers } from './qa';
import { parseSseBlock } from './sse';

const META = JSON.stringify({
  conversationId: 'c1',
  roundId: 'r1',
  userMessageId: 'u1',
  assistantMessageId: 'a1',
});

function handlers(): QaHandlers & { [K in keyof QaHandlers]: ReturnType<typeof vi.fn> } {
  return {
    onMeta: vi.fn(),
    onRoute: vi.fn(),
    onPlan: vi.fn(),
    onStep: vi.fn(),
    onSources: vi.fn(),
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const VALID_SOURCE = {
  idx: 1,
  docTitle: '示例文档',
  sectionPath: '第一章',
  chunkId: 12,
  content: '片段内容',
  vectorDistance: 0.123,
  keywordHits: 3,
  bothChannels: true,
  rrfScore: '0.50000',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseSseBlock', () => {
  it('joins multiple data lines with newline', () => {
    expect(parseSseBlock('event: delta\ndata: 第一行\ndata: 第二行')).toEqual({
      event: 'delta',
      data: '第一行\n第二行',
    });
  });

  it('accepts data lines without a space after the colon', () => {
    expect(parseSseBlock('event: delta\ndata:{"a":1}')).toEqual({
      event: 'delta',
      data: '{"a":1}',
    });
  });

  it('ignores comment lines and trims a trailing carriage return', () => {
    expect(parseSseBlock(': keep-alive\ndata: hello\r')).toEqual({
      event: 'message',
      data: 'hello',
    });
  });
});

describe('streamQa stream framing', () => {
  it('parses CRLF-delimited blocks (\\r\\n\\r\\n) end to end', async () => {
    const h = handlers();
    const body =
      `event: meta\r\ndata: ${META}\r\n\r\n` +
      `event: delta\r\ndata: 第一段\r\n\r\n` +
      `event: delta\r\ndata: 第二段\r\n\r\n` +
      `event: done\r\ndata: ${JSON.stringify({ provider: 'DashScope', elapsedMillis: 700, sourceCount: 0 })}\r\n\r\n`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse([body])));

    await streamQa(null, '问题', h, new AbortController().signal);

    expect(h.onMeta).toHaveBeenCalledTimes(1);
    expect(h.onDelta).toHaveBeenCalledTimes(2);
    expect(h.onDelta).toHaveBeenNthCalledWith(1, '第一段');
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('stops reading after done and ignores later events', async () => {
    const h = handlers();
    const body = [
      `event: meta\ndata: ${META}\n\n`,
      `event: done\ndata: ${JSON.stringify({ provider: 'DashScope', elapsedMillis: 300, sourceCount: 0 })}\n\n`,
      'event: delta\ndata: 不应该出现\n\n',
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(body)));

    await streamQa(null, '问题', h, new AbortController().signal);

    expect(h.onDelta).not.toHaveBeenCalled();
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it('stops reading after error and ignores later deltas', async () => {
    const h = handlers();
    const body = [
      `event: meta\ndata: ${META}\n\n`,
      'event: error\ndata: 模型服务暂不可用\n\n',
      'event: delta\ndata: 不应该出现\n\n',
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(body)));

    await streamQa(null, '问题', h, new AbortController().signal);

    expect(h.onError).toHaveBeenCalledWith('模型服务暂不可用');
    expect(h.onDelta).not.toHaveBeenCalled();
  });

  it('treats a sources item with missing fields as a protocol error', async () => {
    const h = handlers();
    const body = [
      `event: meta\ndata: ${META}\n\n`,
      'event: sources\ndata: [{"idx":0}]\n\n',
      'event: delta\ndata: 不应该出现\n\n',
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(body)));

    await streamQa(null, '问题', h, new AbortController().signal);

    expect(h.onSources).not.toHaveBeenCalled();
    expect(h.onError).toHaveBeenCalledWith('响应协议异常：来源格式不合法');
    expect(h.onDelta).not.toHaveBeenCalled();
  });

  it('accepts a fully populated sources payload', async () => {
    const h = handlers();
    const body = [
      `event: meta\ndata: ${META}\n\n`,
      `event: sources\ndata: ${JSON.stringify([VALID_SOURCE])}\n\n`,
      'event: delta\ndata: 正文\n\n',
      `event: done\ndata: ${JSON.stringify({ provider: 'DashScope', elapsedMillis: 500, sourceCount: 1 })}\n\n`,
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(body)));

    await streamQa(null, '问题', h, new AbortController().signal);

    expect(h.onSources).toHaveBeenCalledWith([VALID_SOURCE]);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('treats a done payload with missing fields as a protocol error', async () => {
    const h = handlers();
    const body = [
      `event: meta\ndata: ${META}\n\n`,
      'event: done\ndata: {"sourceCount":0}\n\n',
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(body)));

    await streamQa(null, '问题', h, new AbortController().signal);

    expect(h.onDone).not.toHaveBeenCalled();
    expect(h.onError).toHaveBeenCalledWith('响应协议异常：缺少完成信息');
  });
});
