export interface AuthContext {
  uid: string;
  idToken?: string;
}

export class OwnershipForbiddenError extends Error {
  readonly httpStatus = 403;
  readonly code = 'FORBIDDEN';

  constructor(message = 'You do not have permission to access this resource.') {
    super(message);
    this.name = 'OwnershipForbiddenError';
  }
}

export interface DBConversation {
  id: string;
  owner_uid: string;
  title: string;
  created_at: string;
  updated_at: string;
  running_summary: string;
  pinned: number;
}

export interface DBMessage {
  id: string;
  conversation_id: string;
  owner_uid?: string;
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
    create(auth: AuthContext, id: string, title: string): Promise<DBConversation>;
    getAll(auth: AuthContext, search?: string): Promise<DBConversation[]>;
    getById(auth: AuthContext, id: string): Promise<DBConversation | undefined>;
    update(
      auth: AuthContext,
      id: string,
      updates: { title?: string; pinned?: boolean; running_summary?: string }
    ): Promise<DBConversation | undefined>;
    delete(auth: AuthContext, id: string): Promise<{ changes: number }>;
    clearAll(auth: AuthContext): Promise<void>;
  };
  messages: {
    create(
      auth: AuthContext,
      id: string,
      conversationId: string,
      role: 'user' | 'assistant' | 'system',
      content: string,
      tokens?: number
    ): Promise<DBMessage>;
    getById(auth: AuthContext, conversationId: string, id: string): Promise<DBMessage | undefined>;
    getByConversation(auth: AuthContext, conversationId: string): Promise<DBMessage[]>;
    getCountByConversation(auth: AuthContext, conversationId: string): Promise<number>;
    getRecentMessages(
      auth: AuthContext,
      conversationId: string,
      limitCount?: number
    ): Promise<DBMessage[]>;
    getOlderMessages(
      auth: AuthContext,
      conversationId: string,
      excludeRecentCount?: number
    ): Promise<DBMessage[]>;
    deleteById(auth: AuthContext, conversationId: string, messageId: string): Promise<void>;
    deleteByConversation(auth: AuthContext, conversationId: string): Promise<{ changes: number }>;
  };
  settings: {
    get(auth: AuthContext, key: string): Promise<string | null>;
    set(auth: AuthContext, key: string, value: string): Promise<void>;
    getAll(auth: AuthContext): Promise<Record<string, string>>;
  };
}
