import type { DBConversation, DBMessage, DatabaseAdapter } from './types.ts';
import { postgresAdapter } from './postgres.ts';

export type { DBConversation, DBMessage };

let cachedFirestoreAdapter: DatabaseAdapter | null = null;

async function getAdapter(): Promise<DatabaseAdapter> {
  if (process.env.DATABASE_URL?.trim()) {
    return postgresAdapter;
  }

  // On Vercel production/preview, DATABASE_URL (Neon PostgreSQL) is mandatory.
  if (process.env.VERCEL) {
    throw new Error(
      'DATABASE_URL is not configured in Vercel environment variables. Set DATABASE_URL to your Neon PostgreSQL connection string.'
    );
  }

  // Fallback for AI Studio preview / Cloud Run environment where Cloud Firestore is provisioned.
  if (!cachedFirestoreAdapter) {
    const mod = await import('./firestore.ts');
    cachedFirestoreAdapter = mod.firestoreAdapter;
  }
  return cachedFirestoreAdapter;
}

export function getDatabaseProviderName(): string {
  if (process.env.DATABASE_URL?.trim()) {
    return 'PostgreSQL (Neon)';
  }
  if (process.env.VERCEL) {
    return 'PostgreSQL (unconfigured)';
  }
  return 'Cloud Firestore';
}

export async function testDatabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const adapter = await getAdapter();
    return await adapter.testConnection();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

export const conversationQueries = {
  create: async (id: string, title: string): Promise<DBConversation> =>
    (await getAdapter()).conversations.create(id, title),

  getAll: async (search?: string): Promise<DBConversation[]> =>
    (await getAdapter()).conversations.getAll(search),

  getById: async (id: string): Promise<DBConversation | undefined> =>
    (await getAdapter()).conversations.getById(id),

  update: async (
    id: string,
    updates: { title?: string; pinned?: boolean; running_summary?: string }
  ): Promise<DBConversation | undefined> =>
    (await getAdapter()).conversations.update(id, updates),

  delete: async (id: string): Promise<{ changes: number }> =>
    (await getAdapter()).conversations.delete(id),

  clearAll: async (): Promise<void> => (await getAdapter()).conversations.clearAll(),
};

export const messageQueries = {
  create: async (
    id: string,
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokens: number = 0
  ): Promise<DBMessage> =>
    (await getAdapter()).messages.create(id, conversationId, role, content, tokens),

  getById: async (conversationId: string, id: string): Promise<DBMessage | undefined> =>
    (await getAdapter()).messages.getById(conversationId, id),

  getByConversation: async (conversationId: string): Promise<DBMessage[]> =>
    (await getAdapter()).messages.getByConversation(conversationId),

  getCountByConversation: async (conversationId: string): Promise<number> =>
    (await getAdapter()).messages.getCountByConversation(conversationId),

  getRecentMessages: async (
    conversationId: string,
    limitCount: number = 25
  ): Promise<DBMessage[]> =>
    (await getAdapter()).messages.getRecentMessages(conversationId, limitCount),

  getOlderMessages: async (
    conversationId: string,
    excludeRecentCount: number = 25
  ): Promise<DBMessage[]> =>
    (await getAdapter()).messages.getOlderMessages(conversationId, excludeRecentCount),

  deleteById: async (conversationId: string, messageId: string): Promise<void> =>
    (await getAdapter()).messages.deleteById(conversationId, messageId),

  deleteByConversation: async (conversationId: string): Promise<{ changes: number }> =>
    (await getAdapter()).messages.deleteByConversation(conversationId),
};

export const settingsQueries = {
  get: async (key: string): Promise<string | null> => (await getAdapter()).settings.get(key),

  set: async (key: string, value: string): Promise<void> =>
    (await getAdapter()).settings.set(key, value),

  getAll: async (): Promise<Record<string, string>> => (await getAdapter()).settings.getAll(),
};
