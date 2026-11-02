/**
 * 后端契约镜像。字段名与 java 侧逐字一致：
 * - DocSummary / UploadResponse / IngestMillisResponse / DeleteResponse
 * - ChunkPageResponse / ChunkItemResponse（阶段6 B1）
 * - QaSourceResponse / QaDoneResponse（阶段6 B3）
 *
 * 可空字段表达"该值不存在"，不要用 0 或空串顶替。
 */

export interface DocSummary {
  docId: string;
  docTitle: string;
  /** 原始文件名（含扩展名） */
  sourcePath: string;
  chunkCount: number;
  /** 解析后纯文本字符数合计，不是 token 数 */
  charCountTotal: number;
  /** 最近更新时间（首次入库即入库时间），服务端格式化为 'YYYY-MM-DD HH:mm:ss'，无时区 */
  updateTime: string;
}

export interface IngestMillis {
  parse: number;
  split: number;
  embed: number;
  store: number;
}

export interface UploadResult {
  docId: string;
  blocks: number;
  chunkCount: number;
  avgChunkChars: number;
  millis: IngestMillis;
  embeddingProvider: string;
}

export interface DeleteResult {
  docId: string;
  deletedChunks: number;
}

export interface ChunkItem {
  chunkId: number;
  /** 从 0 起 */
  index: number;
  /** 可能为 null：该切片不属于任何小节 */
  sectionPath: string | null;
  charCount: number;
  content: string;
}

export interface ChunkPage {
  docId: string;
  page: number;
  size: number;
  total: number;
  items: ChunkItem[];
}

export interface QaSource {
  /** 与正文【来源N】严格一致 */
  idx: number;
  docTitle: string;
  sectionPath: string | null;
  chunkId: number;
  content: string;
  /** 仅向量通道命中时有值 */
  vectorDistance: number | null;
  /** 关键词通道命中数；未命中时为 null */
  keywordHits: number | null;
  bothChannels: boolean;
  /** 5 位小数字符串，避免浮点展示误差 */
  rrfScore: string;
}

export interface QaDone {
  provider: string;
  elapsedMillis: number;
  sourceCount: number;
}

/** 会话历史消息角色 */
export type MessageRole = 'USER' | 'ASSISTANT';

/** 历史消息终态；流式中的消息不在历史列表里出现 */
export type MessageStatus = 'DONE' | 'FAILED' | 'STOPPED';

/** 历史来源结构与问答来源一致，别名镜像避免两份声明漂移 */
export type QaSourceItem = QaSource;

export interface MessageItem {
  messageId: string;
  /** 同一轮的用户消息与助手消息共享该值，用于分组渲染 */
  roundId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  /** 仅助手消息可能有来源；未召回或用户消息为 null */
  sources: QaSourceItem[] | null;
  /** 仅助手消息有值 */
  provider: string | null;
  /** 仅助手消息有值 */
  elapsedMillis: number | null;
  /** 失败原因原文；成功为 null */
  error: string | null;
  createTime: string;
}

export interface MessageList {
  conversationId: string;
  messages: MessageItem[];
}

export interface ConversationSummary {
  conversationId: string;
  /** 首问前 20 字符 */
  title: string;
  createTime: string;
  updateTime: string;
}

export interface ConversationDeleteResult {
  conversationId: string;
  deleted: true;
}

/** POST /api/qa 流式响应的首个事件载荷 */
export interface QaMeta {
  conversationId: string;
  roundId: string;
  userMessageId: string;
  assistantMessageId: string;
}

/** 统一响应包装（/api/qa 的 SSE 除外） */
export interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}
