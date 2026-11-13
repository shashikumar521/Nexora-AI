import type { DBConversation, DBMessage, DatabaseAdapter } from './types.ts';
import { VALID_SETTING_KEYS, nextIsoTimestamp } from './types.ts';
import { postgresAdapter } from './postgres.ts';

export type { DBConversation, DBMessage };

let resolvedAdapter: DatabaseAdapter | null = null;
let resolvingAdapterPromise: Promise<DatabaseAdapter> | null = null;

function isUsablePostgresUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || !/^postgres(?:ql)?:\/\//i.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.trim().toLowerCase();
    if (!host || host === 'base' || host === 'host' || host === 'hostname' || host === 'example.com') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function createInMemoryAdapter(): DatabaseAdapter {
  const conversations = new Map<string, DBConversation>();
  const messagesByConv = new Map<string, DBMessage[]>();
  const settings = new Map<string, string>();

  return {
    providerName: 'In-Memory Fallback',
    async testConnection() {
      return { ok: true };
    },
    conversations: {
      async create(id: string, title: string): Promise<DBConversation> {
        const now = nextIsoTimestamp();
        const conv: DBConversation = {
          id,
          title: title.slice(0, 200) || 'New Chat',
          created_at: now,
          updated_at: now,
          running_summary: '',
          pinned: 0,
        };
        conversations.set(id, conv);
        return { ...conv };
      },
      async getAll(search?: string): Promise<DBConversation[]> {
        let list = Array.from(conversations.values());
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          list = list.filter((c) => c.title.toLowerCase().includes(q));
        }
        return list
          .map((c) => ({ ...c }))
          .sort((a, b) => b.pinned - a.pinned || b.updated_at.localeCompare(a.updated_at));
      },
      async getById(id: string): Promise<DBConversation | undefined> {
        const conv = conversations.get(id);
        return conv ? { ...conv } : undefined;
      },
      async update(
        id: string,
        updates: { title?: string; pinned?: boolean; running_summary?: string }
      ): Promise<DBConversation | undefined> {
        const existing = conversations.get(id);
        if (!existing) return undefined;
        const updated: DBConversation = {
          ...existing,
          updated_at: nextIsoTimestamp(),
          ...(updates.title !== undefined ? { title: updates.title.slice(0, 200) || 'New Chat' } : {}),
          ...(updates.pinned !== undefined ? { pinned: updates.pinned ? 1 : 0 } : {}),
          ...(updates.running_summary !== undefined
            ? { running_summary: updates.running_summary.slice(0, 20000) }
            : {}),
        };
        conversations.set(id, updated);
        return { ...updated };
      },
      async delete(id: string): Promise<{ changes: number }> {
        messagesByConv.delete(id);
        const existed = conversations.delete(id);
        return { changes: existed ? 1 : 0 };
      },
      async clearAll(): Promise<void> {
        conversations.clear();
        messagesByConv.clear();
      },
    },
    messages: {
      async create(
        id: string,
        conversationId: string,
        role: 'user' | 'assistant' | 'system',
        content: string,
        tokens: number = 0
      ): Promise<DBMessage> {
        const now = nextIsoTimestamp();
        const safeTokens = Math.max(0, Math.min(1000000, Math.round(tokens)));
        const msg: DBMessage = {
          id,
          conversation_id: conversationId,
          role,
          content,
          created_at: now,
          tokens: safeTokens,
        };
        const list = messagesByConv.get(conversationId) || [];
        list.push(msg);
        messagesByConv.set(conversationId, list);
        const conv = conversations.get(conversationId);
        if (conv) {
          conversations.set(conversationId, { ...conv, updated_at: now });
        }
        return { ...msg };
      },
      async getById(conversationId: string, id: string): Promise<DBMessage | undefined> {
        const list = messagesByConv.get(conversationId) || [];
        const found = list.find((m) => m.id === id);
        return found ? { ...found } : undefined;
      },
      async getByConversation(conversationId: string): Promise<DBMessage[]> {
        return (messagesByConv.get(conversationId) || []).map((m) => ({ ...m }));
      },
      async getCountByConversation(conversationId: string): Promise<number> {
        return (messagesByConv.get(conversationId) || []).length;
      },
      async getRecentMessages(conversationId: string, limitCount: number = 25): Promise<DBMessage[]> {
        const list = messagesByConv.get(conversationId) || [];
        return list.slice(-Math.max(1, limitCount)).map((m) => ({ ...m }));
      },
      async getOlderMessages(
        conversationId: string,
        excludeRecentCount: number = 25
      ): Promise<DBMessage[]> {
        const list = messagesByConv.get(conversationId) || [];
        if (list.length <= excludeRecentCount) return [];
        return list.slice(0, list.length - excludeRecentCount).map((m) => ({ ...m }));
      },
      async deleteById(conversationId: string, messageId: string): Promise<void> {
        const list = messagesByConv.get(conversationId) || [];
        messagesByConv.set(
          conversationId,
          list.filter((m) => m.id !== messageId)
        );
      },
      async deleteByConversation(conversationId: string): Promise<{ changes: number }> {
        const count = (messagesByConv.get(conversationId) || []).length;
        messagesByConv.delete(conversationId);
        return { changes: count };
      },
    },
    settings: {
      async get(key: string): Promise<string | null> {
        if (!VALID_SETTING_KEYS.has(key)) return null;
        return settings.get(key) ?? null;
      },
      async set(key: string, value: string): Promise<void> {
        if (!VALID_SETTING_KEYS.has(key)) return;
        settings.set(key, String(value).slice(0, 100));
      },
      async getAll(): Promise<Record<string, string>> {
        return Object.fromEntries(settings.entries());
      },
    },
  };
}

async function resolveAdapter(): Promise<DatabaseAdapter> {
  if (process.env.VERCEL) {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error(
        'DATABASE_URL is not configured in Vercel environment variables. Set DATABASE_URL to your Neon PostgreSQL connection string.'
      );
    }
    return postgresAdapter;
  }

  const dbUrl = process.env.DATABASE_URL?.trim() || '';
  if (dbUrl) {
    if (isUsablePostgresUrl(dbUrl)) {
      const pgCheck = await postgresAdapter.testConnection();
      if (pgCheck.ok) {
        console.log('[Database] Connected to PostgreSQL.');
        return postgresAdapter;
      }
      console.warn(
        `[Database] PostgreSQL unavailable (${pgCheck.error || 'connection failed'}); falling back to Cloud Firestore.`
      );
    } else {
      console.warn(
        '[Database] Ignoring invalid or placeholder DATABASE_URL; using Cloud Firestore.'
      );
    }
  }

  try {
    const mod = await import('./firestore.ts');
    const fsCheck = await mod.firestoreAdapter.testConnection();
    if (fsCheck.ok) {
      console.log('[Database] Connected to Cloud Firestore.');
      return mod.firestoreAdapter;
    }
    console.warn(
      `[Database] Cloud Firestore unavailable (${fsCheck.error || 'connection failed'}); using in-memory fallback.`
    );
  } catch (err) {
    console.warn(
      '[Database] Failed to initialize Cloud Firestore; using in-memory fallback.',
      err instanceof Error ? err.message : err
    );
  }

  return createInMemoryAdapter();
}

async function getAdapter(): Promise<DatabaseAdapter> {
  if (resolvedAdapter) {
    return resolvedAdapter;
  }
  if (!resolvingAdapterPromise) {
    resolvingAdapterPromise = resolveAdapter()
      .then((adapter) => {
        resolvedAdapter = adapter;
        return adapter;
      })
      .catch((err) => {
        resolvingAdapterPromise = null;
        throw err;
      });
  }
  return resolvingAdapterPromise;
}

export function getDatabaseProviderName(): string {
  if (resolvedAdapter) {
    return resolvedAdapter.providerName;
  }
  if (process.env.VERCEL) {
    return process.env.DATABASE_URL?.trim() ? 'PostgreSQL (Neon)' : 'PostgreSQL (unconfigured)';
  }
  if (process.env.DATABASE_URL?.trim() && isUsablePostgresUrl(process.env.DATABASE_URL)) {
    return 'PostgreSQL (Neon)';
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
