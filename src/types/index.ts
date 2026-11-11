export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  tokens?: number;
  model?: string;
  latencyMs?: number;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  running_summary: string;
  pinned: number;
}

export interface MemoryStatus {
  conversationId: string;
  strategy: string;
  totalStoredMessages: number;
  recentMessagesCount: number;
  maxRecentWindow: number;
  hasRunningSummary: boolean;
  runningSummary: string | null;
  activeContextTokens: number;
  tokenCapacity: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  typographyScale: '12px' | '14px' | '16px';
  sendOnEnter: boolean;
  streamResponses: boolean;
  showSyntaxHighlighting: boolean;
  language: string;
  model: string;
}

export interface HealthStatus {
  status: string;
  app: string;
  version: string;
  model: string;
  apiKeyConfigured: boolean;
  database: string;
}
