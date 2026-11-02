import { Button, Skeleton, cx } from '@/components/ui';
import { ChatIcon, PanelLeftIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { formatRelative } from '@/lib/format';
import type { ConversationSummary } from '@/api/types';
import type { ChatMode, ListStatus } from './useConversations';

/**
 * 会话侧栏：顶部「新对话」+ 下方唯一的「最近」分组。
 * 条目由铺满的选择按钮与绝对定位的删除按钮组成，二者是兄弟节点，避免按钮嵌套。
 */
export function ConversationSidebar({
  mode,
  conversations,
  activeConversationId,
  listStatus,
  listError,
  collapsed,
  onToggle,
  onNewDraft,
  onSelect,
  onDelete,
  onRetryLoad,
}: {
  mode: ChatMode;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  listStatus: ListStatus;
  listError: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onNewDraft: () => void;
  onSelect: (conversationId: string) => void;
  onDelete?: (conversation: ConversationSummary) => void;
  onRetryLoad: () => void;
}) {
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-2 border-r border-line bg-panel py-2">
        <button
          type="button"
          aria-label="展开会话列表"
          onClick={onToggle}
          className="grid h-8 w-8 place-items-center rounded-input text-muted hover:bg-panel2 hover:text-ink"
        >
          <PanelLeftIcon size={15} />
        </button>
        <button
          type="button"
          aria-label="新对话"
          onClick={onNewDraft}
          className="grid h-8 w-8 place-items-center rounded-input text-muted hover:bg-panel2 hover:text-ink"
        >
          <PlusIcon size={15} />
        </button>
        <span className="text-[10.5px] tracking-[0.2em] text-muted [writing-mode:vertical-rl]">
          会话
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center gap-2 px-3 pb-1 pt-3">
        <Button
          variant="primary"
          className="flex-1"
          onClick={onNewDraft}
          aria-label="新对话"
        >
          <PlusIcon size={14} />
          新对话
        </Button>
        <button
          type="button"
          aria-label="收起会话列表"
          onClick={onToggle}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-input text-muted hover:bg-panel2 hover:text-ink"
        >
          <PanelLeftIcon size={15} />
        </button>
      </div>

      <div className="px-3 pb-1.5 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-meta font-medium text-muted">最近</span>
          {listStatus === 'ready' && conversations.length > 0 ? (
            <span className="text-meta text-muted">{conversations.length}</span>
          ) : null}
          {mode === 'draft' ? (
            <span className="ml-auto text-[10.5px] text-muted">草稿未保存</span>
          ) : null}
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto px-2 pb-3">
        {listStatus === 'loading' ? (
          <Skeleton rows={5} />
        ) : listStatus === 'error' ? (
          <div className="rounded-card border border-dangerLine bg-dangerSoft px-3 py-2.5">
            <p className="text-meta leading-relaxed text-danger">{listError ?? '会话列表加载失败'}</p>
            <Button size="sm" className="mt-2" onClick={onRetryLoad}>
              重试
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-2 py-8 text-center">
            <ChatIcon size={18} className="text-muted" />
            <p className="text-meta leading-relaxed text-muted">
              还没有会话，提问后会自动出现在这里。
            </p>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {conversations.map((conversation) => {
              const active = conversation.conversationId === activeConversationId;
              return (
                <li key={conversation.conversationId} className="group relative">
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => onSelect(conversation.conversationId)}
                    className={cx(
                      'block w-full cursor-pointer rounded-input border px-2.5 py-2 pr-8 text-left transition-colors',
                      active
                        ? 'border-brandLine bg-brandSoft text-brand'
                        : 'border-transparent text-ink2 hover:bg-panel2',
                    )}
                  >
                    <span className="block truncate text-body font-medium">
                      {conversation.title}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] text-muted">
                      {formatRelative(conversation.updateTime)}
                    </span>
                  </button>
                  {onDelete ? (
                    <button
                      type="button"
                      aria-label={`删除会话：${conversation.title}`}
                      onClick={() => onDelete(conversation)}
                      className={cx(
                        'absolute right-1.5 top-1.5 grid h-6 w-6 cursor-pointer place-items-center rounded',
                        'text-muted opacity-0 transition-opacity hover:bg-dangerSoft hover:text-danger',
                        'group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100',
                      )}
                    >
                      <TrashIcon size={13} />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
