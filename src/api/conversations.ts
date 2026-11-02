import { isMockEnabled, request } from './client';
import {
  deleteConversationMock,
  listConversationsMock,
  listMessagesMock,
} from './mock';
import type { ConversationDeleteResult, ConversationSummary, MessageList } from './types';

/** GET /api/conversations（后端已按最近更新倒序） */
export async function listConversations(): Promise<ConversationSummary[]> {
  if (isMockEnabled()) return listConversationsMock();
  return request<ConversationSummary[]>('/api/conversations');
}

/** GET /api/conversations/{conversationId}/messages */
export async function listMessages(
  conversationId: string,
  signal?: AbortSignal,
): Promise<MessageList> {
  if (isMockEnabled()) return listMessagesMock(conversationId, signal);
  return request<MessageList>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    { signal },
  );
}

/** DELETE /api/conversations/{conversationId}（软删，不可恢复） */
export async function deleteConversation(
  conversationId: string,
): Promise<ConversationDeleteResult> {
  if (isMockEnabled()) return deleteConversationMock(conversationId);
  return request<ConversationDeleteResult>(
    `/api/conversations/${encodeURIComponent(conversationId)}`,
    { method: 'DELETE' },
  );
}
