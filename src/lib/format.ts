/** 展示层的数字与时间口径统一收敛在这里（AGENTS.md §6） */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 千分位，用于切片数 / 字符数 */
export function formatThousands(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 服务端 updateTime 为 'YYYY-MM-DD HH:mm:ss'（无时区），按本地时间解析 */
export function parseServerTime(value: string): Date | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 精确到分钟 */
export function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** 「12 分钟前 / 3 小时前 / 2 天前」；超过 7 天回落为日期 */
export function formatRelative(value: string | Date | null, now: Date = new Date()): string {
  const date = value instanceof Date ? value : parseServerTime(value ?? '');
  if (!date) return '—';
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return '刚刚';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} 天前`;
  return formatDateTime(date);
}

/** 向量距离固定 3 位小数 */
export function formatDistance(value: number | null): string {
  return value === null ? '—' : value.toFixed(3);
}

/** RRF 融合分数固定 5 位小数（服务端已是字符串） */
export function formatRrf(value: string | null): string {
  if (!value) return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(5) : value;
}

export function formatChars(value: number): string {
  return `${formatThousands(value)} 字符`;
}

/** 文件体积，用于上传前展示 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 毫秒耗时：<1s 用 ms，否则用 s（1 位小数） */
export function formatMillis(value: number): string {
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`;
}

/** 会话标题：去首尾空白后按 code point 截取，和后端「首问前 20 字符」口径一致 */
export function truncateTitle(value: string, maxChars = 20): string {
  return Array.from(value.trim()).slice(0, maxChars).join('');
}

/** 临时生成唯一 key，避免在渲染期依赖自增模块变量 */
export function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
