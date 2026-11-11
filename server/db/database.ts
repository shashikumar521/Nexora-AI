import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || './data/nexora.sqlite';
const resolvedDbPath = path.resolve(process.cwd(), dbPath);

// Ensure directory exists
const dir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(resolvedDbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    running_summary TEXT DEFAULT '',
    pinned INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    tokens INTEGER DEFAULT 0,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at);
`);

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

export const conversationQueries = {
  create: (id: string, title: string) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at, running_summary, pinned)
      VALUES (?, ?, ?, ?, '', 0)
    `);
    stmt.run(id, title, now, now);
    return conversationQueries.getById(id);
  },

  getAll: (search?: string): DBConversation[] => {
    if (search && search.trim()) {
      const stmt = db.prepare(`
        SELECT * FROM conversations 
        WHERE title LIKE ? 
        ORDER BY pinned DESC, updated_at DESC
      `);
      return stmt.all(`%${search.trim()}%`) as DBConversation[];
    }
    const stmt = db.prepare(`
      SELECT * FROM conversations 
      ORDER BY pinned DESC, updated_at DESC
    `);
    return stmt.all() as DBConversation[];
  },

  getById: (id: string): DBConversation | undefined => {
    const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
    return stmt.get(id) as DBConversation | undefined;
  },

  update: (id: string, updates: { title?: string; pinned?: boolean; running_summary?: string }) => {
    const sets: string[] = ['updated_at = ?'];
    const values: (string | number)[] = [new Date().toISOString()];

    if (updates.title !== undefined) {
      sets.push('title = ?');
      values.push(updates.title);
    }
    if (updates.pinned !== undefined) {
      sets.push('pinned = ?');
      values.push(updates.pinned ? 1 : 0);
    }
    if (updates.running_summary !== undefined) {
      sets.push('running_summary = ?');
      values.push(updates.running_summary);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE conversations SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return conversationQueries.getById(id);
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM conversations WHERE id = ?');
    return stmt.run(id);
  },

  clearAll: () => {
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM conversations').run();
  }
};

export const messageQueries = {
  create: (id: string, conversationId: string, role: 'user' | 'assistant' | 'system', content: string, tokens: number = 0) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at, tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, conversationId, role, content, now, tokens);

    // Update conversation's updated_at
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);

    return messageQueries.getById(id);
  },

  getById: (id: string): DBMessage | undefined => {
    const stmt = db.prepare('SELECT * FROM messages WHERE id = ?');
    return stmt.get(id) as DBMessage | undefined;
  },

  getByConversation: (conversationId: string): DBMessage[] => {
    const stmt = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC');
    return stmt.all(conversationId) as DBMessage[];
  },

  getCountByConversation: (conversationId: string): number => {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?');
    const result = stmt.get(conversationId) as { count: number };
    return result ? result.count : 0;
  },

  getRecentMessages: (conversationId: string, limit: number = 25): DBMessage[] => {
    // Get the most recent N messages, returned in chronological order
    const stmt = db.prepare(`
      SELECT * FROM (
        SELECT * FROM messages 
        WHERE conversation_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      ) ORDER BY created_at ASC
    `);
    return stmt.all(conversationId, limit) as DBMessage[];
  },

  getOlderMessages: (conversationId: string, excludeRecentCount: number = 25): DBMessage[] => {
    // Messages older than the most recent N
    const stmt = db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      AND id NOT IN (
        SELECT id FROM messages 
        WHERE conversation_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      )
      ORDER BY created_at ASC
    `);
    return stmt.all(conversationId, conversationId, excludeRecentCount) as DBMessage[];
  },

  deleteByConversation: (conversationId: string) => {
    const stmt = db.prepare('DELETE FROM messages WHERE conversation_id = ?');
    return stmt.run(conversationId);
  }
};

export const settingsQueries = {
  get: (key: string): string | null => {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  },
  set: (key: string, value: string) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  },
  getAll: (): Record<string, string> => {
    const stmt = db.prepare('SELECT * FROM settings');
    const rows = stmt.all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }
};
