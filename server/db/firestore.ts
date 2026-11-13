import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  writeBatch,
  getCountFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import {
  type DBConversation,
  type DBMessage,
  type DatabaseAdapter,
  VALID_SETTING_KEYS,
  nextIsoTimestamp,
} from './types.ts';

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

function normalizeDbError(action: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Firestore] ${action} failed:`, message);
  return new Error(`Database operation failed while ${action}.`, { cause: error });
}

export const firestoreAdapter: DatabaseAdapter = {
  providerName: 'Cloud Firestore',

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await getDocFromServer(doc(firestoreDb, '_health', 'connection'));
      return { ok: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Firestore] Connection check failed:', message);
      return { ok: false, error: message };
    }
  },

  conversations: {
    create: async (id: string, title: string): Promise<DBConversation> => {
      try {
        const now = nextIsoTimestamp();
        const conv: DBConversation = {
          id,
          title: title.slice(0, 200) || 'New Chat',
          created_at: now,
          updated_at: now,
          running_summary: '',
          pinned: 0,
        };
        await setDoc(doc(firestoreDb, 'conversations', id), conv);
        return conv;
      } catch (error) {
        throw normalizeDbError('creating conversation', error);
      }
    },

    getAll: async (search?: string): Promise<DBConversation[]> => {
      try {
        const snap = await getDocs(collection(firestoreDb, 'conversations'));
        let list = snap.docs.map((d) => d.data() as DBConversation);
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          list = list.filter((c) => c.title.toLowerCase().includes(q));
        }
        return list.sort(
          (a, b) => b.pinned - a.pinned || b.updated_at.localeCompare(a.updated_at)
        );
      } catch (error) {
        throw normalizeDbError('listing conversations', error);
      }
    },

    getById: async (id: string): Promise<DBConversation | undefined> => {
      try {
        const snap = await getDoc(doc(firestoreDb, 'conversations', id));
        return snap.exists() ? (snap.data() as DBConversation) : undefined;
      } catch (error) {
        throw normalizeDbError('fetching conversation', error);
      }
    },

    update: async (
      id: string,
      updates: { title?: string; pinned?: boolean; running_summary?: string }
    ): Promise<DBConversation | undefined> => {
      try {
        const convRef = doc(firestoreDb, 'conversations', id);
        const existingSnap = await getDoc(convRef);
        if (!existingSnap.exists()) return undefined;

        const patch: Partial<DBConversation> = {
          updated_at: nextIsoTimestamp(),
        };
        if (updates.title !== undefined) {
          patch.title = updates.title.slice(0, 200) || 'New Chat';
        }
        if (updates.pinned !== undefined) {
          patch.pinned = updates.pinned ? 1 : 0;
        }
        if (updates.running_summary !== undefined) {
          patch.running_summary = updates.running_summary.slice(0, 20000);
        }

        await updateDoc(convRef, patch);
        const updatedSnap = await getDoc(convRef);
        return updatedSnap.exists() ? (updatedSnap.data() as DBConversation) : undefined;
      } catch (error) {
        throw normalizeDbError('updating conversation', error);
      }
    },

    delete: async (id: string): Promise<{ changes: number }> => {
      try {
        await firestoreAdapter.messages.deleteByConversation(id);
        const convRef = doc(firestoreDb, 'conversations', id);
        const snap = await getDoc(convRef);
        if (!snap.exists()) return { changes: 0 };
        await deleteDoc(convRef);
        return { changes: 1 };
      } catch (error) {
        throw normalizeDbError('deleting conversation', error);
      }
    },

    clearAll: async (): Promise<void> => {
      try {
        const convSnap = await getDocs(collection(firestoreDb, 'conversations'));
        for (const convDoc of convSnap.docs) {
          await firestoreAdapter.messages.deleteByConversation(convDoc.id);
          await deleteDoc(convDoc.ref);
        }
      } catch (error) {
        throw normalizeDbError('clearing all conversations', error);
      }
    },
  },

  messages: {
    create: async (
      id: string,
      conversationId: string,
      role: 'user' | 'assistant' | 'system',
      content: string,
      tokens: number = 0
    ): Promise<DBMessage> => {
      try {
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
        await setDoc(doc(firestoreDb, 'conversations', conversationId, 'messages', id), msg);
        await updateDoc(doc(firestoreDb, 'conversations', conversationId), {
          updated_at: now,
        });
        return msg;
      } catch (error) {
        throw normalizeDbError('creating message', error);
      }
    },

    getById: async (conversationId: string, id: string): Promise<DBMessage | undefined> => {
      try {
        const snap = await getDoc(doc(firestoreDb, 'conversations', conversationId, 'messages', id));
        return snap.exists() ? (snap.data() as DBMessage) : undefined;
      } catch (error) {
        throw normalizeDbError('fetching message', error);
      }
    },

    getByConversation: async (conversationId: string): Promise<DBMessage[]> => {
      try {
        const q = query(
          collection(firestoreDb, 'conversations', conversationId, 'messages'),
          orderBy('created_at', 'asc')
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => d.data() as DBMessage);
      } catch (error) {
        throw normalizeDbError('fetching conversation messages', error);
      }
    },

    getCountByConversation: async (conversationId: string): Promise<number> => {
      try {
        const coll = collection(firestoreDb, 'conversations', conversationId, 'messages');
        const snap = await getCountFromServer(coll);
        return snap.data().count;
      } catch (error) {
        throw normalizeDbError('counting conversation messages', error);
      }
    },

    getRecentMessages: async (conversationId: string, limitCount: number = 25): Promise<DBMessage[]> => {
      try {
        const q = query(
          collection(firestoreDb, 'conversations', conversationId, 'messages'),
          orderBy('created_at', 'desc'),
          limit(limitCount)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => d.data() as DBMessage).reverse();
      } catch (error) {
        throw normalizeDbError('fetching recent messages', error);
      }
    },

    getOlderMessages: async (
      conversationId: string,
      excludeRecentCount: number = 25
    ): Promise<DBMessage[]> => {
      try {
        const convMessages = await firestoreAdapter.messages.getByConversation(conversationId);
        if (convMessages.length <= excludeRecentCount) return [];
        return convMessages.slice(0, convMessages.length - excludeRecentCount);
      } catch (error) {
        throw normalizeDbError('fetching older messages', error);
      }
    },

    deleteById: async (conversationId: string, messageId: string): Promise<void> => {
      try {
        await deleteDoc(doc(firestoreDb, 'conversations', conversationId, 'messages', messageId));
      } catch (error) {
        throw normalizeDbError('deleting message', error);
      }
    },

    deleteByConversation: async (conversationId: string): Promise<{ changes: number }> => {
      try {
        const msgsSnap = await getDocs(
          collection(firestoreDb, 'conversations', conversationId, 'messages')
        );
        let changes = 0;
        const docs = msgsSnap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(firestoreDb);
          const chunk = docs.slice(i, i + 400);
          for (const d of chunk) {
            batch.delete(d.ref);
            changes++;
          }
          await batch.commit();
        }
        return { changes };
      } catch (error) {
        throw normalizeDbError('deleting conversation messages', error);
      }
    },
  },

  settings: {
    get: async (key: string): Promise<string | null> => {
      if (!VALID_SETTING_KEYS.has(key)) return null;
      try {
        const snap = await getDoc(doc(firestoreDb, 'settings', key));
        if (!snap.exists()) return null;
        const data = snap.data() as { key: string; value: string };
        return data.value ?? null;
      } catch (error) {
        throw normalizeDbError('reading setting', error);
      }
    },

    set: async (key: string, value: string): Promise<void> => {
      if (!VALID_SETTING_KEYS.has(key)) return;
      try {
        await setDoc(doc(firestoreDb, 'settings', key), {
          key,
          value: String(value).slice(0, 100),
        });
      } catch (error) {
        throw normalizeDbError('saving setting', error);
      }
    },

    getAll: async (): Promise<Record<string, string>> => {
      try {
        const snap = await getDocs(collection(firestoreDb, 'settings'));
        const result: Record<string, string> = {};
        for (const d of snap.docs) {
          const data = d.data() as { key?: string; value?: string };
          if (data.key && data.value !== undefined) {
            result[data.key] = data.value;
          }
        }
        return result;
      } catch (error) {
        throw normalizeDbError('reading settings', error);
      }
    },
  },
};
