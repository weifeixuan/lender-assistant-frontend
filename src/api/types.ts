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
  /** 关键词通道命中数；未命中时为 0 */
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

/** 统一响应包装（/api/qa 的 SSE 除外） */
export interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}
