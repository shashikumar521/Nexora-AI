import type { AuthContext, DBConversation, DBMessage, DatabaseAdapter } from './types.ts';
import { OwnershipForbiddenError, VALID_SETTING_KEYS, nextIsoTimestamp } from './types.ts';
import { postgresAdapter } from './postgres.ts';
import {
  getFirebaseAdminStatus,
  isFirebaseServiceAccountConfigured,
} from '../lib/firebaseAdmin.ts';

export type { AuthContext, DBConversation, DBMessage };
export { OwnershipForbiddenError };

let resolvedAdapter: DatabaseAdapter | null = null;
let resolvingAdapterPromise: Promise<DatabaseAdapter> | null = null;

function readCleanEnv(name: string): string {
  let raw = (process.env[name] ?? '').trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
  ) {
    raw = raw.slice(1, -1).trim();
  }
  return raw;
}

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

export function createInMemoryAdapter(): DatabaseAdapter {
  const conversations = new Map<string, DBConversation>();
  const messagesByConv = new Map<string, DBMessage[]>();
  const settingsByUser = new Map<string, Map<string, string>>();

  function assertOwned(auth: AuthContext, id: string): DBConversation | undefined {
    const uid = auth?.uid?.trim();
    if (!uid) throw new OwnershipForbiddenError();
    const conv = conversations.get(id);
    if (!conv) return undefined;
    if (!conv.owner_uid || conv.owner_uid !== uid) {
      throw new OwnershipForbiddenError('You do not have permission to access this conversation.');
    }
    return conv;
  }

  return {
    providerName: 'In-Memory Fallback',
    async testConnection() {
      return { ok: true };
    },
    conversations: {
      async create(auth: AuthContext, id: string, title: string): Promise<DBConversation> {
        const uid = auth?.uid?.trim();
        if (!uid) throw new OwnershipForbiddenError();
        const now = nextIsoTimestamp();
        const conv: DBConversation = {
          id,
          owner_uid: uid,
          title: title.slice(0, 200) || 'New Chat',
          created_at: now,
          updated_at: now,
          running_summary: '',
          pinned: 0,
        };
        conversations.set(id, conv);
        return { ...conv };
      },
      async getAll(auth: AuthContext, search?: string): Promise<DBConversation[]> {
        const uid = auth?.uid?.trim();
        if (!uid) throw new OwnershipForbiddenError();
        let list = Array.from(conversations.values()).filter((c) => c.owner_uid === uid);
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          list = list.filter((c) => c.title.toLowerCase().includes(q));
        }
        return list
          .map((c) => ({ ...c }))
          .sort((a, b) => b.pinned - a.pinned || b.updated_at.localeCompare(a.updated_at));
      },
      async getById(auth: AuthContext, id: string): Promise<DBConversation | undefined> {
        const conv = assertOwned(auth, id);
        return conv ? { ...conv } : undefined;
      },
      async update(
        auth: AuthContext,
        id: string,
        updates: { title?: string; pinned?: boolean; running_summary?: string }
      ): Promise<DBConversation | undefined> {
        const existing = assertOwned(auth, id);
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
      async delete(auth: AuthContext, id: string): Promise<{ changes: number }> {
        const existing = assertOwned(auth, id);
        if (!existing) return { changes: 0 };
        messagesByConv.delete(id);
        conversations.delete(id);
        return { changes: 1 };
      },
      async clearAll(auth: AuthContext): Promise<void> {
        const uid = auth?.uid?.trim();
        if (!uid) throw new OwnershipForbiddenError();
        for (const [id, conv] of conversations.entries()) {
          if (conv.owner_uid === uid) {
            conversations.delete(id);
            messagesByConv.delete(id);
          }
        }
      },
    },
    messages: {
      async create(
        auth: AuthContext,
        id: string,
        conversationId: string,
        role: 'user' | 'assistant' | 'system',
        content: string,
        tokens: number = 0
      ): Promise<DBMessage> {
        const conv = assertOwned(auth, conversationId);
        if (!conv) throw new Error('Conversation not found.');
        const now = nextIsoTimestamp();
        const safeTokens = Math.max(0, Math.min(1000000, Math.round(tokens)));
        const msg: DBMessage = {
          id,
          conversation_id: conversationId,
          owner_uid: auth.uid,
          role,
          content,
          created_at: now,
          tokens: safeTokens,
        };
        const list = messagesByConv.get(conversationId) || [];
        list.push(msg);
        messagesByConv.set(conversationId, list);
        conversations.set(conversationId, { ...conv, updated_at: now });
        return { ...msg };
      },
      async getById(auth: AuthContext, conversationId: string, id: string): Promise<DBMessage | undefined> {
        const conv = assertOwned(auth, conversationId);
        if (!conv) return undefined;
        const list = messagesByConv.get(conversationId) || [];
        const found = list.find((m) => m.id === id);
        return found ? { ...found } : undefined;
      },
      async getByConversation(auth: AuthContext, conversationId: string): Promise<DBMessage[]> {
        const conv = assertOwned(auth, conversationId);
        if (!conv) return [];
        return (messagesByConv.get(conversationId) || []).map((m) => ({ ...m }));
      },
      async getCountByConversation(auth: AuthContext, conversationId: string): Promise<number> {
        const conv = assertOwned(auth, conversationId);
        if (!conv) return 0;
        return (messagesByConv.get(conversationId) || []).length;
      },
      async getRecentMessages(
        auth: AuthContext,
        conversationId: string,
        limitCount: number = 25
      ): Promise<DBMessage[]> {
        const conv = assertOwned(auth, conversationId);
        if (!conv) return [];
        const list = messagesByConv.get(conversationId) || [];
        return list.slice(-Math.max(1, limitCount)).map((m) => ({ ...m }));
      },
      async getOlderMessages(
        auth: AuthContext,
        conversationId: string,
        excludeRecentCount: number = 25
      ): Promise<DBMessage[]> {
        const conv = assertOwned(auth, conversationId);
        if (!conv) return [];
        const list = messagesByConv.get(conversationId) || [];
        if (list.length <= excludeRecentCount) return [];
        return list.slice(0, list.length - excludeRecentCount).map((m) => ({ ...m }));
      },
      async deleteById(auth: AuthContext, conversationId: string, messageId: string): Promise<void> {
        const conv = assertOwned(auth, conversationId);
        if (!conv) return;
        const list = messagesByConv.get(conversationId) || [];
        messagesByConv.set(
          conversationId,
          list.filter((m) => m.id !== messageId)
        );
      },
      async deleteByConversation(auth: AuthContext, conversationId: string): Promise<{ changes: number }> {
        const conv = assertOwned(auth, conversationId);
        if (!conv) return { changes: 0 };
        const count = (messagesByConv.get(conversationId) || []).length;
        messagesByConv.delete(conversationId);
        return { changes: count };
      },
    },
    settings: {
      async get(auth: AuthContext, key: string): Promise<string | null> {
        if (!VALID_SETTING_KEYS.has(key)) return null;
        return settingsByUser.get(auth.uid)?.get(key) ?? null;
      },
      async set(auth: AuthContext, key: string, value: string): Promise<void> {
        if (!VALID_SETTING_KEYS.has(key)) return;
        let userMap = settingsByUser.get(auth.uid);
        if (!userMap) {
          userMap = new Map<string, string>();
          settingsByUser.set(auth.uid, userMap);
        }
        userMap.set(key, String(value).slice(0, 100));
      },
      async getAll(auth: AuthContext): Promise<Record<string, string>> {
        const userMap = settingsByUser.get(auth.uid);
        return userMap ? Object.fromEntries(userMap.entries()) : {};
      },
    },
  };
}

async function resolveAdapter(): Promise<DatabaseAdapter> {
  const dbUrl = readCleanEnv('DATABASE_URL');
  let pgFailureReason = '';
  let fsFailureReason = '';

  if (dbUrl) {
    if (isUsablePostgresUrl(dbUrl)) {
      const pgCheck = await postgresAdapter.testConnection();
      if (pgCheck.ok) {
        console.log('[Database] Connected to PostgreSQL (Neon).');
        return postgresAdapter;
      }
      pgFailureReason = pgCheck.error || 'PostgreSQL connection check failed.';
      console.warn(
        `[Database] PostgreSQL unavailable (${pgFailureReason}); checking Cloud Firestore.`
      );
    } else {
      pgFailureReason = 'DATABASE_URL format is invalid or points to a placeholder host.';
      console.warn(
        '[Database] Ignoring invalid or placeholder DATABASE_URL; checking Cloud Firestore.'
      );
    }
  }

  try {
    const mod = await import('./firestore.ts');
    const fsCheck = await mod.firestoreAdapter.testConnection();
    if (fsCheck.ok) {
      const adminStatus = getFirebaseAdminStatus();
      console.log(
        `[Database] Connected to Cloud Firestore (mode=${
          adminStatus.initialized ? 'Admin SDK' : 'REST'
        }, project=${adminStatus.projectId || 'unknown'}, database=${adminStatus.databaseId}).`
      );
      return mod.firestoreAdapter;
    }
    fsFailureReason = fsCheck.error || 'Cloud Firestore connection check failed.';
    console.warn(`[Database] Cloud Firestore unavailable (${fsFailureReason}).`);
  } catch (err) {
    fsFailureReason = err instanceof Error ? err.message : String(err);
    console.warn('[Database] Failed to initialize Cloud Firestore:', fsFailureReason);
  }

  if (process.env.VERCEL) {
    const parts: string[] = [];
    if (dbUrl) {
      parts.push(`PostgreSQL failed: ${pgFailureReason}`);
    } else {
      parts.push('DATABASE_URL is not set');
    }
    if (isFirebaseServiceAccountConfigured()) {
      parts.push(`Cloud Firestore (Admin SDK) failed: ${fsFailureReason}`);
    } else {
      parts.push(
        `Cloud Firestore service account is not configured (${fsFailureReason || 'set FIREBASE_SERVICE_ACCOUNT_JSON'})`
      );
    }
    throw new Error(
      `Database connection failed on Vercel. ${parts.join('; ')}. Verify DATABASE_URL or FIREBASE_SERVICE_ACCOUNT_JSON + FIREBASE_DATABASE_ID.`
    );
  }

  console.warn('[Database] No persistent database available locally; using in-memory fallback.');
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
    if (resolvedAdapter.providerName === 'Cloud Firestore') {
      const status = getFirebaseAdminStatus();
      return status.initialized
        ? `Cloud Firestore (Admin SDK: ${status.databaseId})`
        : `Cloud Firestore (REST: ${status.databaseId})`;
    }
    return resolvedAdapter.providerName;
  }
  const dbUrl = readCleanEnv('DATABASE_URL');
  if (dbUrl && isUsablePostgresUrl(dbUrl)) {
    return 'PostgreSQL (Neon)';
  }
  if (isFirebaseServiceAccountConfigured()) {
    const status = getFirebaseAdminStatus();
    return `Cloud Firestore (Admin SDK: ${status.databaseId})`;
  }
  return process.env.VERCEL ? 'Database (unconfigured)' : 'Cloud Firestore';
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
  create: async (auth: AuthContext, id: string, title: string): Promise<DBConversation> =>
    (await getAdapter()).conversations.create(auth, id, title),

  getAll: async (auth: AuthContext, search?: string): Promise<DBConversation[]> =>
    (await getAdapter()).conversations.getAll(auth, search),

  getById: async (auth: AuthContext, id: string): Promise<DBConversation | undefined> =>
    (await getAdapter()).conversations.getById(auth, id),

  update: async (
    auth: AuthContext,
    id: string,
    updates: { title?: string; pinned?: boolean; running_summary?: string }
  ): Promise<DBConversation | undefined> =>
    (await getAdapter()).conversations.update(auth, id, updates),

  delete: async (auth: AuthContext, id: string): Promise<{ changes: number }> =>
    (await getAdapter()).conversations.delete(auth, id),

  clearAll: async (auth: AuthContext): Promise<void> =>
    (await getAdapter()).conversations.clearAll(auth),
};

export const messageQueries = {
  create: async (
    auth: AuthContext,
    id: string,
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokens: number = 0
  ): Promise<DBMessage> =>
    (await getAdapter()).messages.create(auth, id, conversationId, role, content, tokens),

  getById: async (
    auth: AuthContext,
    conversationId: string,
    id: string
  ): Promise<DBMessage | undefined> =>
    (await getAdapter()).messages.getById(auth, conversationId, id),

  getByConversation: async (auth: AuthContext, conversationId: string): Promise<DBMessage[]> =>
    (await getAdapter()).messages.getByConversation(auth, conversationId),

  getCountByConversation: async (auth: AuthContext, conversationId: string): Promise<number> =>
    (await getAdapter()).messages.getCountByConversation(auth, conversationId),

  getRecentMessages: async (
    auth: AuthContext,
    conversationId: string,
    limitCount: number = 25
  ): Promise<DBMessage[]> =>
    (await getAdapter()).messages.getRecentMessages(auth, conversationId, limitCount),

  getOlderMessages: async (
    auth: AuthContext,
    conversationId: string,
    excludeRecentCount: number = 25
  ): Promise<DBMessage[]> =>
    (await getAdapter()).messages.getOlderMessages(auth, conversationId, excludeRecentCount),

  deleteById: async (
    auth: AuthContext,
    conversationId: string,
    messageId: string
  ): Promise<void> => (await getAdapter()).messages.deleteById(auth, conversationId, messageId),

  deleteByConversation: async (
    auth: AuthContext,
    conversationId: string
  ): Promise<{ changes: number }> =>
    (await getAdapter()).messages.deleteByConversation(auth, conversationId),
};

export const settingsQueries = {
  get: async (auth: AuthContext, key: string): Promise<string | null> =>
    (await getAdapter()).settings.get(auth, key),

  set: async (auth: AuthContext, key: string, value: string): Promise<void> =>
    (await getAdapter()).settings.set(auth, key, value),

  getAll: async (auth: AuthContext): Promise<Record<string, string>> =>
    (await getAdapter()).settings.getAll(auth),
};
