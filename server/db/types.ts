export interface DBConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  running_summary: string;
  pinned: number;
}

export interface DBMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  tokens: number;
}

export const VALID_SETTING_KEYS = new Set([
  'theme',
  'typographyScale',
  'sendOnEnter',
  'streamResponses',
  'showSyntaxHighlighting',
  'language',
]);

let lastTimestampMs = 0;

export function nextIsoTimestamp(): string {
  const now = Date.now();
  lastTimestampMs = now > lastTimestampMs ? now : lastTimestampMs + 1;
  return new Date(lastTimestampMs).toISOString();
}

export interface DatabaseAdapter {
  readonly providerName: string;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
  conversations: {
    create(id: string, title: string): Promise<DBConversation>;
    getAll(search?: string): Promise<DBConversation[]>;
    getById(id: string): Promise<DBConversation | undefined>;
    update(
      id: string,
      updates: { title?: string; pinned?: boolean; running_summary?: string }
    ): Promise<DBConversation | undefined>;
    delete(id: string): Promise<{ changes: number }>;
    clearAll(): Promise<void>;
  };
  messages: {
    create(
      id: string,
      conversationId: string,
      role: 'user' | 'assistant' | 'system',
      content: string,
      tokens?: number
    ): Promise<DBMessage>;
    getById(conversationId: string, id: string): Promise<DBMessage | undefined>;
    getByConversation(conversationId: string): Promise<DBMessage[]>;
    getCountByConversation(conversationId: string): Promise<number>;
    getRecentMessages(conversationId: string, limitCount?: number): Promise<DBMessage[]>;
    getOlderMessages(conversationId: string, excludeRecentCount?: number): Promise<DBMessage[]>;
    deleteById(conversationId: string, messageId: string): Promise<void>;
    deleteByConversation(conversationId: string): Promise<{ changes: number }>;
  };
  settings: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    getAll(): Promise<Record<string, string>>;
  };
}
