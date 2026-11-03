/**
 * SSE 报文解析（纯函数）。
 *
 * 报文以空行分块，块内形如：
 *   event: sources
 *   data: {...}
 *
 * 本项目的固定事件集：meta → [sources] → delta* → done | error（见 AGENTS.md §5.2）。
 * 多行 data 按 SSE 规范用 \n 拼回；行首单个空格要剥掉。
 */
export interface SseBlock {
  event: string;
  data: string;
}

const EVENT_PREFIX = 'event:';
const DATA_PREFIX = 'data:';

export function parseSseBlock(block: string): SseBlock | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith(EVENT_PREFIX)) {
      event = line.slice(EVENT_PREFIX.length).trim();
    } else if (line.startsWith(DATA_PREFIX)) {
      dataLines.push(line.slice(DATA_PREFIX.length).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}
