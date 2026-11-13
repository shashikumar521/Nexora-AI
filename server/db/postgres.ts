import { Pool, type PoolConfig } from 'pg';
import {
  type AuthContext,
  type DBConversation,
  type DBMessage,
  type DatabaseAdapter,
  OwnershipForbiddenError,
  VALID_SETTING_KEYS,
  nextIsoTimestamp,
} from './types.ts';

declare global {
  var _nexoraPgPool: Pool | undefined;
  var _nexoraPgUrl: string | undefined;
  var _nexoraPgSchemaPromise: Promise<void> | null | undefined;
}

function shouldUseSsl(connectionString: string): boolean {
  const lower = connectionString.toLowerCase();
  if (lower.includes('sslmode=disable')) return false;
  if (
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-full') ||
    lower.includes('sslmode=verify-ca') ||
    lower.includes('.neon.tech')
  ) {
    return true;
  }
  const isLocalHost = lower.includes('localhost') || lower.includes('127.0.0.1');
  if (isLocalHost) return false;
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not configured.');
  }

  if (globalThis._nexoraPgPool && globalThis._nexoraPgUrl === connectionString) {
    return globalThis._nexoraPgPool;
  }

  if (globalThis._nexoraPgPool && globalThis._nexoraPgUrl !== connectionString) {
    globalThis._nexoraPgPool.end().catch(() => {});
    globalThis._nexoraPgPool = undefined;
    globalThis._nexoraPgSchemaPromise = null;
  }

  const config: PoolConfig = {
    connectionString,
    max: 5,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: process.env.VERCEL ? 10000 : 3000,
    query_timeout: 15000,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
  };

  const pool = new Pool(config);
  pool.on('error', (err) => {
    console.error('[PostgreSQL] Unexpected idle client error:', err?.message || err);
  });

  globalThis._nexoraPgPool = pool;
  globalThis._nexoraPgUrl = connectionString;
  return pool;
}

function normalizePgError(action: string, error: unknown): Error {
  if (error instanceof OwnershipForbiddenError) {
    return error;
  }
  const errObj = error as { code?: string; message?: string };
  const rawMessage = errObj?.message || String(error);
  const sanitized = rawMessage
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/password=[^\s&]+/gi, 'password=[REDACTED]');

  console.error(`[PostgreSQL] ${action} failed (${errObj?.code || 'ERR'}):`, sanitized);

  if (
    errObj?.code === 'ETIMEDOUT' ||
    errObj?.code === '57014' ||
    sanitized.toLowerCase().includes('timeout')
  ) {
    return new Error(`Database request timed out while ${action}. Please try again.`, {
      cause: error,
    });
  }

  if (
    errObj?.code === 'ECONNREFUSED' ||
    errObj?.code === 'ENOTFOUND' ||
    errObj?.code === '28P01' ||
    errObj?.code === '57P01' ||
    sanitized.includes('DATABASE_URL')
  ) {
    return new Error(
      `Database connection failed while ${action}. Verify DATABASE_URL and database availability.`,
      { cause: error }
    );
  }

  if (errObj?.code === '42501') {
    return new Error(
      `PostgreSQL permission denied while ${action}. Verify database role privileges on Neon.`,
      { cause: error }
    );
  }

  return new Error(`Database operation failed while ${action}.`, { cause: error });
}

async function ensureSchema(): Promise<void> {
  if (!globalThis._nexoraPgSchemaPromise) {
    const pool = getPool();
    globalThis._nexoraPgSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id VARCHAR(128) PRIMARY KEY,
          owner_uid VARCHAR(128),
          title VARCHAR(200) NOT NULL DEFAULT 'New Chat',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          running_summary TEXT NOT NULL DEFAULT '',
          pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1))
        );

        ALTER TABLE conversations ADD COLUMN IF NOT EXISTS owner_uid VARCHAR(128);

        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(128) PRIMARY KEY,
          conversation_id VARCHAR(128) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          owner_uid VARCHAR(128),
          role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          tokens INTEGER NOT NULL DEFAULT 0 CHECK (tokens >= 0)
        );

        ALTER TABLE messages ADD COLUMN IF NOT EXISTS owner_uid VARCHAR(128);

        CREATE TABLE IF NOT EXISTS user_settings (
          uid VARCHAR(128) NOT NULL,
          key VARCHAR(64) NOT NULL,
          value VARCHAR(255) NOT NULL,
          PRIMARY KEY (uid, key)
        );

        CREATE INDEX IF NOT EXISTS idx_conversations_owner_pinned_updated
          ON conversations (owner_uid, pinned DESC, updated_at DESC);

        CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
          ON messages (conversation_id, created_at ASC);
      `);
    })().catch((err) => {
      globalThis._nexoraPgSchemaPromise = null;
      throw err;
    });
  }

  await globalThis._nexoraPgSchemaPromise;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return new Date().toISOString();
}

function mapConversationRow(row: Record<string, any>): DBConversation {
  return {
    id: String(row.id),
    owner_uid: String(row.owner_uid ?? ''),
    title: String(row.title ?? 'New Chat'),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    running_summary: String(row.running_summary ?? ''),
    pinned: Number(row.pinned) ? 1 : 0,
  };
}

function mapMessageRow(row: Record<string, any>): DBMessage {
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    owner_uid: row.owner_uid ? String(row.owner_uid) : undefined,
    role: row.role as DBMessage['role'],
    content: String(row.content ?? ''),
    created_at: toIso(row.created_at),
    tokens: Number(row.tokens ?? 0),
  };
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function assertUid(auth: AuthContext): string {
  const uid = auth?.uid?.trim();
  if (!uid) {
    throw new OwnershipForbiddenError('Authenticated user UID is required.');
  }
  return uid;
}

async function assertConversationOwnership(
  uid: string,
  conversationId: string
): Promise<DBConversation | undefined> {
  const res = await getPool().query(
    `SELECT id, owner_uid, title, created_at, updated_at, running_summary, pinned
     FROM conversations
     WHERE id = $1`,
    [conversationId]
  );
  if (!res.rows[0]) return undefined;
  const conv = mapConversationRow(res.rows[0]);
  if (!conv.owner_uid || conv.owner_uid !== uid) {
    throw new OwnershipForbiddenError('You do not have permission to access this conversation.');
  }
  return conv;
}

export const postgresAdapter: DatabaseAdapter = {
  providerName: 'PostgreSQL (Neon)',

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await ensureSchema();
      await getPool().query('SELECT 1 AS ok');
      return { ok: true };
    } catch (error) {
      const normalized = normalizePgError('checking database connectivity', error);
      return { ok: false, error: normalized.message };
    }
  },

  conversations: {
    async create(auth: AuthContext, id: string, title: string): Promise<DBConversation> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const now = nextIsoTimestamp();
        const safeTitle = title.slice(0, 200) || 'New Chat';
        const res = await getPool().query(
          `INSERT INTO conversations (id, owner_uid, title, created_at, updated_at, running_summary, pinned)
           VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, '', 0)
           RETURNING id, owner_uid, title, created_at, updated_at, running_summary, pinned`,
          [id, uid, safeTitle, now, now]
        );
        return mapConversationRow(res.rows[0]);
      } catch (error) {
        throw normalizePgError('creating conversation', error);
      }
    },

    async getAll(auth: AuthContext, search?: string): Promise<DBConversation[]> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const trimmed = search?.trim();
        const res = trimmed
          ? await getPool().query(
              `SELECT id, owner_uid, title, created_at, updated_at, running_summary, pinned
               FROM conversations
               WHERE owner_uid = $1 AND title ILIKE $2 ESCAPE '\\'
               ORDER BY pinned DESC, updated_at DESC`,
              [uid, `%${escapeIlikePattern(trimmed)}%`]
            )
          : await getPool().query(
              `SELECT id, owner_uid, title, created_at, updated_at, running_summary, pinned
               FROM conversations
               WHERE owner_uid = $1
               ORDER BY pinned DESC, updated_at DESC`,
              [uid]
            );
        return res.rows.map(mapConversationRow);
      } catch (error) {
        throw normalizePgError('listing conversations', error);
      }
    },

    async getById(auth: AuthContext, id: string): Promise<DBConversation | undefined> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        return await assertConversationOwnership(uid, id);
      } catch (error) {
        throw normalizePgError('fetching conversation', error);
      }
    },

    async update(
      auth: AuthContext,
      id: string,
      updates: { title?: string; pinned?: boolean; running_summary?: string }
    ): Promise<DBConversation | undefined> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const existing = await assertConversationOwnership(uid, id);
        if (!existing) return undefined;

        const setClauses: string[] = [];
        const values: unknown[] = [];
        let paramIdx = 1;

        if (updates.title !== undefined) {
          setClauses.push(`title = $${paramIdx++}`);
          values.push(updates.title.slice(0, 200) || 'New Chat');
        }
        if (updates.pinned !== undefined) {
          setClauses.push(`pinned = $${paramIdx++}`);
          values.push(updates.pinned ? 1 : 0);
        }
        if (updates.running_summary !== undefined) {
          setClauses.push(`running_summary = $${paramIdx++}`);
          values.push(updates.running_summary.slice(0, 20000));
        }

        const now = nextIsoTimestamp();
        setClauses.push(`updated_at = $${paramIdx++}::timestamptz`);
        values.push(now);

        values.push(id, uid);
        const res = await getPool().query(
          `UPDATE conversations
           SET ${setClauses.join(', ')}
           WHERE id = $${paramIdx} AND owner_uid = $${paramIdx + 1}
           RETURNING id, owner_uid, title, created_at, updated_at, running_summary, pinned`,
          values
        );

        return res.rows[0] ? mapConversationRow(res.rows[0]) : undefined;
      } catch (error) {
        throw normalizePgError('updating conversation', error);
      }
    },

    async delete(auth: AuthContext, id: string): Promise<{ changes: number }> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const existing = await assertConversationOwnership(uid, id);
        if (!existing) return { changes: 0 };

        const res = await getPool().query(
          'DELETE FROM conversations WHERE id = $1 AND owner_uid = $2',
          [id, uid]
        );
        return { changes: res.rowCount ?? 0 };
      } catch (error) {
        throw normalizePgError('deleting conversation', error);
      }
    },

    async clearAll(auth: AuthContext): Promise<void> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        await getPool().query('DELETE FROM conversations WHERE owner_uid = $1', [uid]);
      } catch (error) {
        throw normalizePgError('clearing user conversations', error);
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
      const uid = assertUid(auth);
      await ensureSchema();
      const existing = await assertConversationOwnership(uid, conversationId);
      if (!existing) {
        throw new Error('Conversation not found.');
      }

      const client = await getPool().connect();
      try {
        const now = nextIsoTimestamp();
        const safeTokens = Math.max(0, Math.min(1000000, Math.round(tokens)));

        await client.query('BEGIN');
        const msgRes = await client.query(
          `INSERT INTO messages (id, conversation_id, owner_uid, role, content, created_at, tokens)
           VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7)
           RETURNING id, conversation_id, owner_uid, role, content, created_at, tokens`,
          [id, conversationId, uid, role, content, now, safeTokens]
        );
        await client.query(
          `UPDATE conversations
           SET updated_at = $3::timestamptz
           WHERE id = $1 AND owner_uid = $2`,
          [conversationId, uid, now]
        );
        await client.query('COMMIT');

        return mapMessageRow(msgRes.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw normalizePgError('creating message', error);
      } finally {
        client.release();
      }
    },

    async getById(
      auth: AuthContext,
      conversationId: string,
      id: string
    ): Promise<DBMessage | undefined> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const existing = await assertConversationOwnership(uid, conversationId);
        if (!existing) return undefined;

        const res = await getPool().query(
          `SELECT id, conversation_id, owner_uid, role, content, created_at, tokens
           FROM messages
           WHERE conversation_id = $1 AND id = $2`,
          [conversationId, id]
        );
        return res.rows[0] ? mapMessageRow(res.rows[0]) : undefined;
      } catch (error) {
        throw normalizePgError('fetching message', error);
      }
    },

    async getByConversation(auth: AuthContext, conversationId: string): Promise<DBMessage[]> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const existing = await assertConversationOwnership(uid, conversationId);
        if (!existing) return [];

        const res = await getPool().query(
          `SELECT id, conversation_id, owner_uid, role, content, created_at, tokens
           FROM messages
           WHERE conversation_id = $1
           ORDER BY created_at ASC`,
          [conversationId]
        );
        return res.rows.map(mapMessageRow);
      } catch (error) {
        throw normalizePgError('fetching conversation messages', error);
      }
    },

    async getCountByConversation(auth: AuthContext, conversationId: string): Promise<number> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const existing = await assertConversationOwnership(uid, conversationId);
        if (!existing) return 0;

        const res = await getPool().query(
          `SELECT COUNT(*)::int AS count
           FROM messages
           WHERE conversation_id = $1`,
          [conversationId]
        );
        return Number(res.rows[0]?.count ?? 0);
      } catch (error) {
        throw normalizePgError('counting conversation messages', error);
      }
    },

    async getRecentMessages(
      auth: AuthContext,
      conversationId: string,
      limitCount: number = 25
    ): Promise<DBMessage[]> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const existing = await assertConversationOwnership(uid, conversationId);
        if (!existing) return [];

        const safeLimit = Math.max(1, Math.min(200, Math.floor(limitCount)));
        const res = await getPool().query(
          `SELECT id, conversation_id, owner_uid, role, content, created_at, tokens
           FROM (
             SELECT id, conversation_id, owner_uid, role, content, created_at, tokens
             FROM messages
             WHERE conversation_id = $1
             ORDER BY created_at DESC
             LIMIT $2
           ) recent
           ORDER BY created_at ASC`,
          [conversationId, safeLimit]
        );
        return res.rows.map(mapMessageRow);
      } catch (error) {
        throw normalizePgError('fetching recent messages', error);
      }
    },

    async getOlderMessages(
      auth: AuthContext,
      conversationId: string,
      excludeRecentCount: number = 25
    ): Promise<DBMessage[]> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const existing = await assertConversationOwnership(uid, conversationId);
        if (!existing) return [];

        const safeOffset = Math.max(0, Math.floor(excludeRecentCount));
        const res = await getPool().query(
          `SELECT id, conversation_id, owner_uid, role, content, created_at, tokens
           FROM (
             SELECT id, conversation_id, owner_uid, role, content, created_at, tokens
             FROM messages
             WHERE conversation_id = $1
             ORDER BY created_at DESC
             OFFSET $2
           ) older
           ORDER BY created_at ASC`,
          [conversationId, safeOffset]
        );
        return res.rows.map(mapMessageRow);
      } catch (error) {
        throw normalizePgError('fetching older messages', error);
      }
    },

    async deleteById(
      auth: AuthContext,
      conversationId: string,
      messageId: string
    ): Promise<void> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const existing = await assertConversationOwnership(uid, conversationId);
        if (!existing) return;

        await getPool().query(
          'DELETE FROM messages WHERE conversation_id = $1 AND id = $2',
          [conversationId, messageId]
        );
      } catch (error) {
        throw normalizePgError('deleting message', error);
      }
    },

    async deleteByConversation(
      auth: AuthContext,
      conversationId: string
    ): Promise<{ changes: number }> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const existing = await assertConversationOwnership(uid, conversationId);
        if (!existing) return { changes: 0 };

        const res = await getPool().query('DELETE FROM messages WHERE conversation_id = $1', [
          conversationId,
        ]);
        return { changes: res.rowCount ?? 0 };
      } catch (error) {
        throw normalizePgError('deleting conversation messages', error);
      }
    },
  },

  settings: {
    async get(auth: AuthContext, key: string): Promise<string | null> {
      if (!VALID_SETTING_KEYS.has(key)) return null;
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const res = await getPool().query(
          'SELECT value FROM user_settings WHERE uid = $1 AND key = $2',
          [uid, key]
        );
        return res.rows[0]?.value ?? null;
      } catch (error) {
        throw normalizePgError('reading setting', error);
      }
    },

    async set(auth: AuthContext, key: string, value: string): Promise<void> {
      if (!VALID_SETTING_KEYS.has(key)) return;
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        await getPool().query(
          `INSERT INTO user_settings (uid, key, value)
           VALUES ($1, $2, $3)
           ON CONFLICT (uid, key) DO UPDATE SET value = EXCLUDED.value`,
          [uid, key, String(value).slice(0, 100)]
        );
      } catch (error) {
        throw normalizePgError('saving setting', error);
      }
    },

    async getAll(auth: AuthContext): Promise<Record<string, string>> {
      try {
        const uid = assertUid(auth);
        await ensureSchema();
        const res = await getPool().query(
          'SELECT key, value FROM user_settings WHERE uid = $1',
          [uid]
        );
        const result: Record<string, string> = {};
        for (const row of res.rows) {
          if (row.key && row.value !== undefined) {
            result[String(row.key)] = String(row.value);
          }
        }
        return result;
      } catch (error) {
        throw normalizePgError('reading settings', error);
      }
    },
  },
};
