// In-memory deduplication for messages sent via /send-message API
// Prevents race conditions where Chatwoot webhook arrives before SQLite write completes

const apiSentMessageIds = new Set<number>();

export function markMessageAsApiSent(chatwootMessageId: number): void {
  apiSentMessageIds.add(chatwootMessageId);
  // Auto-expire after 30 seconds
  setTimeout(() => apiSentMessageIds.delete(chatwootMessageId), 30000);
}

export function wasMessageSentByApi(chatwootMessageId: number): boolean {
  return apiSentMessageIds.has(chatwootMessageId);
}
