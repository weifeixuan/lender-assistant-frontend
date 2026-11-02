import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { SendIcon } from '@/components/icons';

const MAX_HEIGHT = 140;

/** 自适应高度多行输入；Enter 发送、Shift+Enter 换行（PRD FR-04） */
export function Composer({
  streaming,
  onSubmit,
}: {
  streaming: boolean;
  onSubmit: (question: string) => void;
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const submit = () => {
    const question = text.trim();
    if (!question || streaming) return;
    onSubmit(question);
    setText('');
  };

  return (
    <div className="rounded-dialog border border-line bg-panel px-3 py-2.5 shadow-card">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        disabled={streaming}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={streaming ? '回答生成中，请稍候…' : '基于知识库提问，例如「首套贷款成数上限是多少」'}
        aria-label="提问内容"
        className="block max-h-[140px] w-full resize-none border-0 bg-transparent text-body leading-relaxed text-ink outline-none placeholder:text-placeholder disabled:cursor-not-allowed"
      />
      <div className="mt-1 flex items-center gap-2 border-t border-line2 pt-2">
        <span className="text-meta text-muted">Enter 发送 · Shift+Enter 换行</span>
        <Button
          variant="primary"
          className="ml-auto"
          disabled={streaming || text.trim().length === 0}
          onClick={submit}
        >
          <SendIcon size={14} />
          发送
        </Button>
      </div>
    </div>
  );
}
