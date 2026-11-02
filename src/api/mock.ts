import { ApiError } from './client';
import { truncateTitle } from '@/lib/format';
import type {
  ChunkItem,
  ChunkPage,
  ConversationDeleteResult,
  ConversationSummary,
  DeleteResult,
  DocSummary,
  MessageItem,
  MessageList,
  QaMeta,
  QaSource,
  UploadResult,
} from './types';

/**
 * 本地 mock：字段与真实契约逐字一致，仅用于没有后端时的联调与演示。
 * 只被 documents.ts / qa.ts 调用，组件层不得感知 mock 的存在。
 */

interface MockDoc {
  docId: string;
  docTitle: string;
  sourcePath: string;
  chunkCount: number;
  updateTime: string;
}

const SEED: MockDoc[] = [
  {
    docId: 'huaxin_corp_api_v1',
    docTitle: '华信企业贷接口文档',
    sourcePath: '华信企业贷接口文档.docx',
    chunkCount: 128,
    updateTime: '2026-10-28 16:20:00',
  },
  {
    docId: 'daily_close_rule',
    docTitle: '日末对账规则',
    sourcePath: '日末对账规则.txt',
    chunkCount: 7,
    updateTime: '2026-10-29 09:12:00',
  },
  {
    docId: 'yuqi_file_spec',
    docTitle: '逾期文件格式说明',
    sourcePath: '逾期文件格式说明.md',
    chunkCount: 42,
    updateTime: '2026-10-27 10:05:00',
  },
];

const SECTION_PATHS = [
  '1 接口总览 > 1.1 基础约定',
  '2 授信申请 > 2.1 企业基本信息',
  '2 授信申请 > 2.4 首套贷款成数',
  '3 日末文件 > 3.1 文件命名',
  '3 日末文件 > 3.2 逾期文件格式',
  '4 还款计划 > 4.2 宽限期',
];

const SENTENCES = [
  '本字段用于描述借款主体的授信申请信息，所有金额单位为元，保留两位小数。',
  '接口按日批量推送，文件名固定为 lender_yyyyMMdd.txt，同一天重复推送时以最后一次为准。',
  '逾期文件必须包含合同号、期次、逾期天数与应还金额四列，列之间以竖线分隔。',
  '首套贷款成数上限为八成，二套不低于六成，具体以资方审批结果为准。',
  '还款计划中宽限期最多 3 天，宽限期内不计罚息，超过后按日利率万分之五计收。',
  '若企业名称为空，则以上一期的名称回填；回填后仍为空时该条记录进入待补录队列。',
];

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('已取消', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('已取消', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) % 1_000_003;
  }
  return value;
}

function chunkContent(docTitle: string, index: number): string {
  const section = SECTION_PATHS[index % SECTION_PATHS.length] ?? '（无小节）';
  const sentence = SENTENCES[index % SENTENCES.length] ?? SENTENCES[0];
  return `【${docTitle}】${section}\n${sentence} 该条规定适用于第 ${index + 1} 条场景，具体执行细则以资方最新通知为准。`;
}

let docs: MockDoc[] | null = null;
const chunkCache = new Map<string, ChunkItem[]>();

function currentDocs(): MockDoc[] {
  if (!docs) docs = SEED.map((doc) => ({ ...doc }));
  return docs;
}

function chunksOf(doc: MockDoc): ChunkItem[] {
  const cached = chunkCache.get(doc.docId);
  if (cached && cached.length === doc.chunkCount) return cached;
  const items: ChunkItem[] = Array.from({ length: doc.chunkCount }, (_, index) => {
    const content = chunkContent(doc.docTitle, index);
    return {
      chunkId: hash(doc.docId) * 100 + index,
      index,
      sectionPath: SECTION_PATHS[index % SECTION_PATHS.length] ?? null,
      charCount: content.length,
      content,
    };
  });
  chunkCache.set(doc.docId, items);
  return items;
}

function summaryOf(doc: MockDoc): DocSummary {
  const items = chunksOf(doc);
  return {
    docId: doc.docId,
    docTitle: doc.docTitle,
    sourcePath: doc.sourcePath,
    chunkCount: items.length,
    charCountTotal: items.reduce((sum, item) => sum + item.charCount, 0),
    updateTime: doc.updateTime,
  };
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function nowText(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export async function listDocumentsMock(): Promise<DocSummary[]> {
  await delay(600);
  return currentDocs()
    .map(summaryOf)
    .sort((a, b) => (a.updateTime < b.updateTime ? 1 : -1));
}

export async function uploadDocumentMock(file: File, docId: string): Promise<UploadResult> {
  await delay(3200);
  const existing = currentDocs().find((doc) => doc.docId === docId);
  const docTitle = file.name.replace(/\.(docx|txt|md)$/i, '');
  const chunkCount = Math.max(6, Math.min(160, Math.round(file.size / 300) + (hash(docId) % 20)));
  const next: MockDoc = {
    docId,
    docTitle,
    sourcePath: file.name,
    chunkCount,
    updateTime: nowText(),
  };
  chunkCache.delete(docId);
  if (existing) {
    const index = currentDocs().findIndex((doc) => doc.docId === docId);
    currentDocs().splice(index, 1, next);
  } else {
    currentDocs().push(next);
  }
  const items = chunksOf(next);
  return {
    docId,
    blocks: Math.max(1, Math.round(chunkCount / 3)),
    chunkCount: items.length,
    avgChunkChars: items.reduce((sum, item) => sum + item.charCount, 0) / items.length,
    millis: { parse: 640, split: 210, embed: 1860, store: 190 },
    embeddingProvider: 'MockEmbeddingStrategy',
  };
}

export async function deleteDocumentMock(docId: string): Promise<DeleteResult> {
  await delay(400);
  const list = currentDocs();
  const index = list.findIndex((doc) => doc.docId === docId);
  if (index < 0) throw new ApiError(`文档不存在：${docId}`, 404, 404);
  const [removed] = list.splice(index, 1);
  chunkCache.delete(docId);
  return { docId, deletedChunks: removed ? removed.chunkCount : 0 };
}

export async function listChunksMock(
  docId: string,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<ChunkPage> {
  await delay(250, signal);
  const doc = currentDocs().find((item) => item.docId === docId);
  if (!doc) throw new ApiError(`文档不存在：${docId}`, 404, 404);
  const all = chunksOf(doc);
  const start = (page - 1) * size;
  return {
    docId,
    page,
    size,
    total: all.length,
    items: all.slice(start, start + size),
  };
}

const MOCK_SOURCES: Omit<QaSource, 'idx'>[] = [
  {
    docTitle: '华信企业贷接口文档',
    sectionPath: '2 授信申请 > 2.4 首套贷款成数',
    chunkId: 10237,
    content:
      '首套贷款成数上限为八成，二套不低于六成。成数指贷款金额占评估价的比例，评估价以资方认可的三方评估结果为准，装修及税费不计入成数计算基数。',
    vectorDistance: 0.1834,
    keywordHits: 3,
    bothChannels: true,
    rrfScore: '0.03281',
  },
  {
    docTitle: '华信企业贷接口文档',
    sectionPath: '2 授信申请 > 2.1 企业基本信息',
    chunkId: 10218,
    content:
      '企业基本信息包含名称、统一社会信用代码、成立年限与实缴资本。名称与工商登记不一致时，授信申请会被退回并提示名称校验失败。',
    vectorDistance: 0.2417,
    keywordHits: 0,
    bothChannels: false,
    rrfScore: '0.01639',
  },
  {
    docTitle: '日末对账规则',
    sectionPath: '3 日末文件 > 3.2 逾期文件格式',
    chunkId: 10007,
    content:
      '逾期文件必须包含合同号、期次、逾期天数与应还金额四列，列之间以竖线分隔，缺少任一列的文件整包退回。',
    vectorDistance: 0.2951,
    keywordHits: 2,
    bothChannels: true,
    rrfScore: '0.01639',
  },
  {
    docTitle: '逾期文件格式说明',
    sectionPath: '4 还款计划 > 4.2 宽限期',
    chunkId: 10113,
    content: '还款计划中宽限期最多 3 天，宽限期内不计罚息，超过后按日利率万分之五计收。',
    vectorDistance: null,
    keywordHits: 1,
    bothChannels: false,
    rrfScore: '0.01311',
  },
];

export function mockQaSources(): QaSource[] {
  return MOCK_SOURCES.map((source, position) => ({ ...source, idx: position + 1 }));
}

export const MOCK_ANSWER =
  '首套贷款成数上限为八成【来源1】，评估价以资方认可的三方评估结果为准，装修及税费不计入成数计算基数。' +
  '二套首付不低于六成，具体成数仍以资方审批结果为准【来源2】。' +
  '若同一合同在日末文件中出现逾期记录，需要同时满足逾期文件的四列格式要求【来源3】，' +
  '宽限期最多 3 天，超过后按日利率万分之五计收罚息【来源4】。';

export const MOCK_EMPTY_ANSWER = '资料库中没有检索到相关内容，请先上传并入库文档。';

/* ------------------------------------------------------------------ *
 * 多轮会话内存仓库（模拟后端懒创建、历史装配与软删）
 * ------------------------------------------------------------------ */

interface MockConversation {
  conversationId: string;
  title: string;
  createTime: string;
  updateTime: string;
  /** 排序用的单调序号，避免同一秒内无法区分先后 */
  seq: number;
  busy: boolean;
  roundSeq: number;
  messages: MessageItem[];
}

export interface MockRoundContext {
  conversationId: string;
  roundId: string;
  userMessageId: string;
  assistantMessageId: string;
  meta: QaMeta;
}

export interface MockRoundOutcome {
  status: 'DONE' | 'FAILED' | 'STOPPED';
  content: string;
  sources: QaSource[];
  provider: string | null;
  elapsedMillis: number | null;
  error: string | null;
}

let mockConversations: MockConversation[] = [];
let conversationSeq = 0;
let messageSeq = 0;
let generationFailureConsumed = false;
let networkFailureConsumed = false;

/** 测试与演示用：清空内存仓库，模拟刷新后重置 */
export function resetConversationsMock(): void {
  mockConversations = [];
  conversationSeq = 0;
  messageSeq = 0;
  generationFailureConsumed = false;
  networkFailureConsumed = false;
}

/** 生成失败只演示一次，让同一问题的「重试」能成功 */
export function consumeMockGenerationFailure(): boolean {
  if (generationFailureConsumed) return false;
  generationFailureConsumed = true;
  return true;
}

/** 网络中断只演示一次，便于验证重试恢复 */
export function consumeMockNetworkFailure(): boolean {
  if (networkFailureConsumed) return false;
  networkFailureConsumed = true;
  return true;
}

function findConversation(conversationId: string): MockConversation | null {
  return mockConversations.find((item) => item.conversationId === conversationId) ?? null;
}

export function listConversationsMock(): Promise<ConversationSummary[]> {
  return delay(300).then(() =>
    [...mockConversations]
      .sort((a, b) => {
        if (a.updateTime === b.updateTime) return b.seq - a.seq;
        return a.updateTime < b.updateTime ? 1 : -1;
      })
      .map((item) => ({
        conversationId: item.conversationId,
        title: item.title,
        createTime: item.createTime,
        updateTime: item.updateTime,
      })),
  );
}

/** 开启一轮：草稿建会话、已有会话追加 USER 消息，并预分配助手消息 id */
export function beginMockRound(conversationId: string | null, question: string): MockRoundContext {
  const time = nowText();
  let conversation: MockConversation;

  if (conversationId === null) {
    conversationSeq += 1;
    conversation = {
      conversationId: `mock-conversation-${conversationSeq}`,
      title: truncateTitle(question),
      createTime: time,
      updateTime: time,
      seq: conversationSeq,
      busy: true,
      roundSeq: 0,
      messages: [],
    };
    mockConversations.push(conversation);
  } else {
    const found = findConversation(conversationId);
    if (!found) throw new ApiError('会话不存在或已删除', 404, 404);
    if (found.busy) throw new ApiError('该会话正在生成回答，请稍后', 409, 409);
    conversation = found;
    conversation.busy = true;
    conversation.updateTime = time;
    conversation.seq = (conversationSeq += 1);
  }

  conversation.roundSeq += 1;
  const roundId = `${conversation.conversationId}-round-${conversation.roundSeq}`;
  messageSeq += 1;
  const userMessageId = `mock-user-${messageSeq}`;
  messageSeq += 1;
  const assistantMessageId = `mock-assistant-${messageSeq}`;

  conversation.messages.push({
    messageId: userMessageId,
    roundId,
    role: 'USER',
    content: question,
    status: 'DONE',
    sources: null,
    provider: null,
    elapsedMillis: null,
    error: null,
    createTime: time,
  });

  return {
    conversationId: conversation.conversationId,
    roundId,
    userMessageId,
    assistantMessageId,
    meta: {
      conversationId: conversation.conversationId,
      roundId,
      userMessageId,
      assistantMessageId,
    },
  };
}

/** 结束一轮：写入助手消息终态，释放忙碌标记并刷新排序时间 */
export function finishMockRound(context: MockRoundContext, outcome: MockRoundOutcome): void {
  const conversation = findConversation(context.conversationId);
  if (!conversation) return;
  conversation.messages.push({
    messageId: context.assistantMessageId,
    roundId: context.roundId,
    role: 'ASSISTANT',
    content: outcome.content,
    status: outcome.status,
    sources: outcome.sources,
    provider: outcome.provider,
    elapsedMillis: outcome.elapsedMillis,
    error: outcome.error,
    createTime: nowText(),
  });
  conversation.busy = false;
  conversation.updateTime = nowText();
  conversation.seq = (conversationSeq += 1);
}

export async function listMessagesMock(
  conversationId: string,
  signal?: AbortSignal,
): Promise<MessageList> {
  await delay(260, signal);
  const conversation = findConversation(conversationId);
  if (!conversation) throw new ApiError('会话不存在或已删除', 404, 404);
  return {
    conversationId,
    messages: conversation.messages.map((message) => ({
      ...message,
      sources: message.sources
        ? message.sources.map((source) => ({ ...source }))
        : null,
    })),
  };
}

export async function deleteConversationMock(
  conversationId: string,
): Promise<ConversationDeleteResult> {
  await delay(320);
  const index = mockConversations.findIndex((item) => item.conversationId === conversationId);
  if (index < 0) throw new ApiError('会话不存在或已删除', 404, 404);
  mockConversations.splice(index, 1);
  return { conversationId, deleted: true };
}

export { delay };

