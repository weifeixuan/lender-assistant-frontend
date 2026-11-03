import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui';
import { SendIcon } from '@/components/icons';

const MAX_HEIGHT = 140;

/** 自适应高度多行输入；Enter 发送、Alt+Enter / Shift+Enter 换行（PRD FR-04） */
export function Composer({
  value,
  onChange,
  streaming,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  streaming: boolean;
  onSubmit: (question: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** 插入换行后需要恢复的光标位置（受控组件重渲染会把光标推到末尾） */
  const caretRef = useRef<number | null>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
    const caret = caretRef.current;
    if (caret !== null) {
      caretRef.current = null;
      element.setSelectionRange(caret, caret);
    }
  }, [value]);

  const submit = () => {
    const question = value.trim();
    if (!question || streaming) return;
    onSubmit(question);
  };

  const insertNewline = () => {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? start;
    caretRef.current = start + 1;
    onChange(`${value.slice(0, start)}\n${value.slice(end)}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    // 输入法组合中（含 Chromium 的 keyCode 229）按 Enter 只上屏，不发送
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.altKey) {
      event.preventDefault();
      insertNewline();
      return;
    }
    // Shift+Enter 保留既有换行习惯，交给浏览器默认行为
    if (event.shiftKey) return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="rounded-dialog border border-line bg-panel px-3 py-2.5 shadow-card">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={streaming}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={streaming ? '回答生成中，请稍候…' : '基于知识库提问，例如「首套贷款成数上限是多少」'}
        aria-label="提问内容"
        className="block max-h-[140px] w-full resize-none border-0 bg-transparent text-body leading-relaxed text-ink outline-none placeholder:text-placeholder disabled:cursor-not-allowed"
      />
      <div className="mt-1 flex items-center gap-2 border-t border-line2 pt-2">
        <span className="text-meta text-muted">Enter 发送 · Alt+Enter 换行</span>
        <Button
          variant="primary"
          className="ml-auto"
          disabled={streaming || value.trim().length === 0}
          onClick={submit}
        >
          <SendIcon size={14} />
          发送
        </Button>
      </div>
    </div>
  );
}
