import type { QaSource } from '@/api/types';

/** 回答正文里的【来源N】必须渲染成芯片；编号不存在时降级为纯文本（PRD FR-04） */
const CITATION_PATTERN = /【来源(\d+)】/g;

export type AnswerSegment =
  | { type: 'text'; text: string }
  | { type: 'cite'; idx: number };

export function splitCitations(text: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let cursor = 0;
  CITATION_PATTERN.lastIndex = 0;

  let match = CITATION_PATTERN.exec(text);
  while (match !== null) {
    const start = match.index;
    const digits = match[1];
    if (start > cursor) segments.push({ type: 'text', text: text.slice(cursor, start) });
    segments.push({ type: 'cite', idx: digits ? Number(digits) : 0 });
    cursor = start + match[0].length;
    match = CITATION_PATTERN.exec(text);
  }

  if (cursor < text.length) segments.push({ type: 'text', text: text.slice(cursor) });
  return segments;
}

/**
 * 渲染回答正文，把【来源N】替换为可点击芯片。
 * 流式过程中标记尚未闭合时按纯文本显示，闭合后才成为芯片，不影响阅读。
 */
export function AnswerBody({
  text,
  sources,
  onCite,
}: {
  text: string;
  sources: QaSource[];
  onCite: (idx: number) => void;
}) {
  const known = new Set(sources.map((source) => source.idx));

  return (
    <div className="whitespace-pre-wrap break-words text-body leading-[1.85] text-ink2">
      {splitCitations(text).map((segment, index) =>
        segment.type === 'cite' && known.has(segment.idx) ? (
          <button
            key={`${segment.idx}-${index}`}
            type="button"
            onClick={() => onCite(segment.idx)}
            className="mx-0.5 inline-flex items-center rounded border border-brandLine bg-brandSoft px-1 py-px align-baseline text-meta font-medium text-brand hover:bg-brandSoft2"
            aria-label={`查看来源 ${segment.idx}`}
          >
            来源{segment.idx}
          </button>
        ) : segment.type === 'cite' ? (
          `【来源${segment.idx}】`
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </div>
  );
}
