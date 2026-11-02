import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { listConversationsMock, listMessagesMock, resetConversationsMock } from './mock';
import { parseMeta, streamQa } from './qa';
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
