import {
  getFirebaseAdminFirestore,
  getFirebaseAdminStatus,
  getFirebaseDatabaseId,
  getFirebaseProjectId,
  isFirebaseServiceAccountConfigured,
} from '../lib/firebaseAdmin.ts';
import {
  type AuthContext,
  type DBConversation,
  type DBMessage,
  type DatabaseAdapter,
  OwnershipForbiddenError,
  VALID_SETTING_KEYS,
  nextIsoTimestamp,
} from './types.ts';

function getDocumentsBaseUrl(): string {
  const projectId = encodeURIComponent(getFirebaseProjectId());
  const databaseId = encodeURIComponent(getFirebaseDatabaseId());
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string };

interface FirestoreRestDoc {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

function encodeValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  return { stringValue: String(val) };
}

function decodeValue(val: FirestoreValue | undefined): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  return undefined;
}

function encodeFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const out: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = encodeValue(v);
    }
  }
  return out;
}

function decodeDoc(doc: FirestoreRestDoc): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      out[k] = decodeValue(v);
    }
  }
  if (!out.id && doc.name) {
    const parts = doc.name.split('/');
    out.id = parts[parts.length - 1];
  }
  return out;
}

function mapConversationData(raw: Record<string, unknown>): DBConversation {
  return {
    id: String(raw.id || ''),
    owner_uid: String(raw.ownerUid || raw.owner_uid || ''),
    title: String(raw.title || 'New Chat'),
    created_at: String(raw.created_at || new Date().toISOString()),
    updated_at: String(raw.updated_at || new Date().toISOString()),
    running_summary: String(raw.running_summary ?? ''),
    pinned: Number(raw.pinned) ? 1 : 0,
  };
}

function mapMessageData(raw: Record<string, unknown>): DBMessage {
  return {
    id: String(raw.id || ''),
    conversation_id: String(raw.conversation_id || ''),
    owner_uid: raw.ownerUid ? String(raw.ownerUid) : raw.owner_uid ? String(raw.owner_uid) : undefined,
    role: (raw.role as DBMessage['role']) || 'user',
    content: String(raw.content || ''),
    created_at: String(raw.created_at || new Date().toISOString()),
    tokens: Number(raw.tokens ?? 0),
  };
}

class FirestoreRestHttpError extends Error {
  readonly status: number;
  readonly firestoreStatus?: string;

  constructor(status: number, message: string, firestoreStatus?: string) {
    super(message);
    this.status = status;
    this.firestoreStatus = firestoreStatus;
  }
}

async function firestoreRestFetch<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    idToken?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.idToken) {
    headers['Authorization'] = `Bearer ${options.idToken}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let errMsg = `Firestore HTTP ${res.status}`;
    let errStatus: string | undefined;
    try {
      const parsed = JSON.parse(errText);
      const inner = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error;
      if (inner?.message) errMsg = String(inner.message);
      if (inner?.status) errStatus = String(inner.status);
    } catch {
      if (errText) errMsg = errText.slice(0, 300);
    }
    throw new FirestoreRestHttpError(res.status, errMsg, errStatus);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

function sanitizeFirestoreErrorText(text: string): string {
  return text
    .replace(/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/"private_key"\s*:\s*"[^"]*"/gi, '"private_key":"[REDACTED]"')
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .trim();
}

function normalizeDbError(action: string, error: unknown): Error {
  if (error instanceof OwnershipForbiddenError) {
    return error;
  }
  if (error instanceof FirestoreRestHttpError) {
    if (error.status === 403 || error.firestoreStatus === 'PERMISSION_DENIED') {
      return new OwnershipForbiddenError('You do not have permission to access this resource.');
    }
    if (error.status === 404 && error.message.toLowerCase().includes('database')) {
      return new Error(
        `Database connection failed while ${action}: Firestore database "${getFirebaseDatabaseId()}" was not found. Verify FIREBASE_DATABASE_ID.`,
        { cause: error }
      );
    }
  }

  const errObj = error as { code?: string | number; message?: string };
  const code = errObj?.code !== undefined ? String(errObj.code) : '';
  const rawMessage = errObj?.message || String(error);
  const safeMessage = sanitizeFirestoreErrorText(rawMessage).slice(0, 300);
  const status = getFirebaseAdminStatus();
  const mode = status.initialized ? 'admin' : 'rest';
  const dbId = getFirebaseDatabaseId();

  console.error(
    `[Firestore] ${action} failed (mode=${mode}, database=${dbId}, code=${code || 'ERR'}):`,
    safeMessage
  );

  const lower = safeMessage.toLowerCase();

  if (
    safeMessage.includes('FIREBASE_SERVICE_ACCOUNT_JSON') ||
    safeMessage.includes('Firebase Admin SDK') ||
    code === '16' ||
    code === 'UNAUTHENTICATED'
  ) {
    return new Error(
      `Database connection failed while ${action}: ${safeMessage || 'Firebase Admin authentication error.'}`,
      { cause: error }
    );
  }

  if (code === '5' || code === 'NOT_FOUND' || (lower.includes('database') && lower.includes('not found'))) {
    return new Error(
      `Database connection failed while ${action}: Cloud Firestore database "${dbId}" was not found or is not initialized.`,
      { cause: error }
    );
  }

  if (
    code === '14' ||
    code === 'UNAVAILABLE' ||
    code === '4' ||
    code === 'DEADLINE_EXCEEDED' ||
    lower.includes('timeout') ||
    lower.includes('unavailable') ||
    lower.includes('econn') ||
    lower.includes('enotfound')
  ) {
    return new Error(
      `Database connection failed while ${action} (${code || 'UNAVAILABLE'}). Cloud Firestore is temporarily unreachable.`,
      { cause: error }
    );
  }

  if (code === '7' || code === 'PERMISSION_DENIED') {
    return new Error(
      `Firestore permission denied while ${action}. Verify service account IAM roles (Cloud Datastore User / Firebase Admin).`,
      { cause: error }
    );
  }

  return new Error(
    `Database operation failed while ${action}${code ? ` (${code})` : ''}: ${safeMessage || 'Unknown error'}`,
    { cause: error }
  );
}

function assertAuthContext(auth: AuthContext): string {
  const uid = auth?.uid?.trim();
  if (!uid) {
    throw new OwnershipForbiddenError('Authenticated user UID is required.');
  }
  return uid;
}

/**
 * Use Firebase Admin SDK whenever FIREBASE_SERVICE_ACCOUNT_JSON is configured
 * (even when auth.idToken is present), falling back to user idToken REST v1 only
 * when no server service account is configured.
 */
function resolveAdminOrRest(auth: AuthContext) {
  const adminDb = getFirebaseAdminFirestore();
  if (adminDb) {
    return { adminDb, idToken: undefined as string | undefined };
  }

  if (isFirebaseServiceAccountConfigured()) {
    const status = getFirebaseAdminStatus();
    throw new Error(
      status.error || 'Firebase Admin SDK is configured via FIREBASE_SERVICE_ACCOUNT_JSON but failed to initialize.'
    );
  }

  if (!auth.idToken) {
    throw new OwnershipForbiddenError('Authenticated Firebase ID token is required for Cloud Firestore.');
  }
  return { adminDb: null, idToken: auth.idToken };
}

async function getConversationWithOwnershipCheck(
  auth: AuthContext,
  id: string
): Promise<DBConversation | undefined> {
  const uid = assertAuthContext(auth);
  const { adminDb, idToken } = resolveAdminOrRest(auth);

  if (adminDb) {
    const snap = await adminDb.collection('conversations').doc(id).get();
    if (!snap.exists) return undefined;
    const conv = mapConversationData(snap.data() as Record<string, unknown>);
    if (!conv.owner_uid || conv.owner_uid !== uid) {
      throw new OwnershipForbiddenError('You do not have permission to access this conversation.');
    }
    return conv;
  }

  const url = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(id)}`;
  try {
    const doc = await firestoreRestFetch<FirestoreRestDoc>(url, { idToken });
    const conv = mapConversationData(decodeDoc(doc));
    if (!conv.owner_uid || conv.owner_uid !== uid) {
      throw new OwnershipForbiddenError('You do not have permission to access this conversation.');
    }
    return conv;
  } catch (err) {
    if (err instanceof FirestoreRestHttpError) {
      if (err.status === 404) return undefined;
      if (err.status === 403 || err.firestoreStatus === 'PERMISSION_DENIED') {
        throw new OwnershipForbiddenError('You do not have permission to access this conversation.');
      }
    }
    throw err;
  }
}

export const firestoreAdapter: DatabaseAdapter = {
  providerName: 'Cloud Firestore',

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      if (isFirebaseServiceAccountConfigured()) {
        const adminDb = getFirebaseAdminFirestore();
        if (!adminDb) {
          const status = getFirebaseAdminStatus();
          return {
            ok: false,
            error: status.error || 'Failed to initialize Firebase Admin Firestore.',
          };
        }
        await adminDb.collection('_health').doc('connection').get();
        return { ok: true };
      }

      const projectId = getFirebaseProjectId();
      if (!projectId) {
        return { ok: false, error: 'Firebase projectId is not configured.' };
      }

      const url = `${getDocumentsBaseUrl()}/_health/connection`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || res.status === 404) {
        return { ok: true };
      }
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Firestore] Connection check failed:', message);
      return { ok: false, error: message };
    }
  },

  conversations: {
    create: async (auth: AuthContext, id: string, title: string): Promise<DBConversation> => {
      try {
        const uid = assertAuthContext(auth);
        const now = nextIsoTimestamp();
        const safeTitle = title.slice(0, 200) || 'New Chat';
        const firestoreDoc = {
          id,
          ownerUid: uid,
          title: safeTitle,
          created_at: now,
          updated_at: now,
          running_summary: '',
          pinned: 0,
        };

        const { adminDb, idToken } = resolveAdminOrRest(auth);
        if (adminDb) {
          await adminDb.collection('conversations').doc(id).set(firestoreDoc);
          return mapConversationData(firestoreDoc);
        }

        const url = `${getDocumentsBaseUrl()}/conversations?documentId=${encodeURIComponent(id)}`;
        await firestoreRestFetch(url, {
          method: 'POST',
          idToken,
          body: { fields: encodeFields(firestoreDoc) },
        });
        return mapConversationData(firestoreDoc);
      } catch (error) {
        throw normalizeDbError('creating conversation', error);
      }
    },

    getAll: async (auth: AuthContext, search?: string): Promise<DBConversation[]> => {
      try {
        const uid = assertAuthContext(auth);
        let list: DBConversation[] = [];
        const { adminDb, idToken } = resolveAdminOrRest(auth);

        if (adminDb) {
          const snap = await adminDb
            .collection('conversations')
            .where('ownerUid', '==', uid)
            .get();
          list = snap.docs.map((d) => mapConversationData(d.data() as Record<string, unknown>));
        } else {
          const url = `${getDocumentsBaseUrl()}:runQuery`;
          const rows = await firestoreRestFetch<Array<{ document?: FirestoreRestDoc }>>(url, {
            method: 'POST',
            idToken,
            body: {
              structuredQuery: {
                from: [{ collectionId: 'conversations' }],
                where: {
                  fieldFilter: {
                    field: { fieldPath: 'ownerUid' },
                    op: 'EQUAL',
                    value: { stringValue: uid },
                  },
                },
              },
            },
          });
          list = rows
            .filter((r) => Boolean(r.document))
            .map((r) => mapConversationData(decodeDoc(r.document!)))
            .filter((c) => c.owner_uid === uid);
        }

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

    getById: async (auth: AuthContext, id: string): Promise<DBConversation | undefined> => {
      try {
        return await getConversationWithOwnershipCheck(auth, id);
      } catch (error) {
        throw normalizeDbError('fetching conversation', error);
      }
    },

    update: async (
      auth: AuthContext,
      id: string,
      updates: { title?: string; pinned?: boolean; running_summary?: string }
    ): Promise<DBConversation | undefined> => {
      try {
        const uid = assertAuthContext(auth);
        const existing = await getConversationWithOwnershipCheck(auth, id);
        if (!existing) return undefined;

        const patchFields: Record<string, unknown> = {
          updated_at: nextIsoTimestamp(),
        };
        if (updates.title !== undefined) {
          patchFields.title = updates.title.slice(0, 200) || 'New Chat';
        }
        if (updates.pinned !== undefined) {
          patchFields.pinned = updates.pinned ? 1 : 0;
        }
        if (updates.running_summary !== undefined) {
          patchFields.running_summary = updates.running_summary.slice(0, 20000);
        }

        const { adminDb, idToken } = resolveAdminOrRest(auth);
        if (adminDb) {
          await adminDb.collection('conversations').doc(id).update(patchFields);
          return await getConversationWithOwnershipCheck(auth, id);
        }

        const maskParams = Object.keys(patchFields)
          .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
          .join('&');
        const url = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(id)}?currentDocument.exists=true&${maskParams}`;
        const updatedDoc = await firestoreRestFetch<FirestoreRestDoc>(url, {
          method: 'PATCH',
          idToken,
          body: { fields: encodeFields(patchFields) },
        });
        const mapped = mapConversationData(decodeDoc(updatedDoc));
        if (mapped.owner_uid !== uid) {
          throw new OwnershipForbiddenError();
        }
        return mapped;
      } catch (error) {
        throw normalizeDbError('updating conversation', error);
      }
    },

    delete: async (auth: AuthContext, id: string): Promise<{ changes: number }> => {
      try {
        const existing = await getConversationWithOwnershipCheck(auth, id);
        if (!existing) return { changes: 0 };

        await firestoreAdapter.messages.deleteByConversation(auth, id);

        const { adminDb, idToken } = resolveAdminOrRest(auth);
        if (adminDb) {
          await adminDb.collection('conversations').doc(id).delete();
          return { changes: 1 };
        }

        const url = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(id)}`;
        await firestoreRestFetch(url, {
          method: 'DELETE',
          idToken,
        });
        return { changes: 1 };
      } catch (error) {
        throw normalizeDbError('deleting conversation', error);
      }
    },

    clearAll: async (auth: AuthContext): Promise<void> => {
      try {
        const userConvs = await firestoreAdapter.conversations.getAll(auth);
        for (const conv of userConvs) {
          await firestoreAdapter.conversations.delete(auth, conv.id);
        }
      } catch (error) {
        throw normalizeDbError('clearing user conversations', error);
      }
    },
  },

  messages: {
    create: async (
      auth: AuthContext,
      id: string,
      conversationId: string,
      role: 'user' | 'assistant' | 'system',
      content: string,
      tokens: number = 0
    ): Promise<DBMessage> => {
      try {
        const uid = assertAuthContext(auth);
        const conv = await getConversationWithOwnershipCheck(auth, conversationId);
        if (!conv) {
          throw new Error('Conversation not found.');
        }

        const now = nextIsoTimestamp();
        const safeTokens = Math.max(0, Math.min(1000000, Math.round(tokens)));
        const firestoreDoc = {
          id,
          conversation_id: conversationId,
          ownerUid: uid,
          role,
          content,
          created_at: now,
          tokens: safeTokens,
        };

        const { adminDb, idToken } = resolveAdminOrRest(auth);
        if (adminDb) {
          await adminDb
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .doc(id)
            .set(firestoreDoc);
          await adminDb.collection('conversations').doc(conversationId).update({ updated_at: now });
          return mapMessageData(firestoreDoc);
        }

        const msgUrl = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(
          conversationId
        )}/messages?documentId=${encodeURIComponent(id)}`;
        await firestoreRestFetch(msgUrl, {
          method: 'POST',
          idToken,
          body: { fields: encodeFields(firestoreDoc) },
        });

        const convPatchUrl = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(
          conversationId
        )}?currentDocument.exists=true&updateMask.fieldPaths=updated_at`;
        await firestoreRestFetch(convPatchUrl, {
          method: 'PATCH',
          idToken,
          body: { fields: encodeFields({ updated_at: now }) },
        });

        return mapMessageData(firestoreDoc);
      } catch (error) {
        throw normalizeDbError('creating message', error);
      }
    },

    getById: async (
      auth: AuthContext,
      conversationId: string,
      id: string
    ): Promise<DBMessage | undefined> => {
      try {
        const uid = assertAuthContext(auth);
        const conv = await getConversationWithOwnershipCheck(auth, conversationId);
        if (!conv) return undefined;

        const { adminDb, idToken } = resolveAdminOrRest(auth);
        if (adminDb) {
          const snap = await adminDb
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .doc(id)
            .get();
          if (!snap.exists) return undefined;
          const msg = mapMessageData(snap.data() as Record<string, unknown>);
          if (msg.owner_uid && msg.owner_uid !== uid) {
            throw new OwnershipForbiddenError();
          }
          return msg;
        }

        const url = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(
          conversationId
        )}/messages/${encodeURIComponent(id)}`;
        try {
          const doc = await firestoreRestFetch<FirestoreRestDoc>(url, { idToken });
          return mapMessageData(decodeDoc(doc));
        } catch (err) {
          if (err instanceof FirestoreRestHttpError && err.status === 404) {
            return undefined;
          }
          throw err;
        }
      } catch (error) {
        throw normalizeDbError('fetching message', error);
      }
    },

    getByConversation: async (
      auth: AuthContext,
      conversationId: string
    ): Promise<DBMessage[]> => {
      try {
        const uid = assertAuthContext(auth);
        const conv = await getConversationWithOwnershipCheck(auth, conversationId);
        if (!conv) return [];

        const { adminDb, idToken } = resolveAdminOrRest(auth);
        if (adminDb) {
          const snap = await adminDb
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .where('ownerUid', '==', uid)
            .get();
          return snap.docs
            .map((d) => mapMessageData(d.data() as Record<string, unknown>))
            .sort((a, b) => a.created_at.localeCompare(b.created_at));
        }

        const url = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(
          conversationId
        )}:runQuery`;
        const rows = await firestoreRestFetch<Array<{ document?: FirestoreRestDoc }>>(url, {
          method: 'POST',
          idToken,
          body: {
            structuredQuery: {
              from: [{ collectionId: 'messages' }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'ownerUid' },
                  op: 'EQUAL',
                  value: { stringValue: uid },
                },
              },
            },
          },
        });

        return rows
          .filter((r) => Boolean(r.document))
          .map((r) => mapMessageData(decodeDoc(r.document!)))
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
      } catch (error) {
        throw normalizeDbError('fetching conversation messages', error);
      }
    },

    getCountByConversation: async (
      auth: AuthContext,
      conversationId: string
    ): Promise<number> => {
      try {
        const uid = assertAuthContext(auth);
        const conv = await getConversationWithOwnershipCheck(auth, conversationId);
        if (!conv) return 0;

        const { adminDb, idToken } = resolveAdminOrRest(auth);
        if (adminDb) {
          const snap = await adminDb
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .where('ownerUid', '==', uid)
            .count()
            .get();
          return snap.data().count;
        }

        const url = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(
          conversationId
        )}:runAggregationQuery`;
        const rows = await firestoreRestFetch<
          Array<{ result?: { aggregateFields?: { total?: { integerValue?: string } } } }>
        >(url, {
          method: 'POST',
          idToken,
          body: {
            structuredAggregationQuery: {
              structuredQuery: {
                from: [{ collectionId: 'messages' }],
                where: {
                  fieldFilter: {
                    field: { fieldPath: 'ownerUid' },
                    op: 'EQUAL',
                    value: { stringValue: uid },
                  },
                },
              },
              aggregations: [{ alias: 'total', count: {} }],
            },
          },
        });
        const countStr = rows[0]?.result?.aggregateFields?.total?.integerValue;
        return countStr ? Number(countStr) : 0;
      } catch (error) {
        throw normalizeDbError('counting conversation messages', error);
      }
    },

    getRecentMessages: async (
      auth: AuthContext,
      conversationId: string,
      limitCount: number = 25
    ): Promise<DBMessage[]> => {
      try {
        const all = await firestoreAdapter.messages.getByConversation(auth, conversationId);
        if (all.length <= limitCount) return all;
        return all.slice(-Math.max(1, limitCount));
      } catch (error) {
        throw normalizeDbError('fetching recent messages', error);
      }
    },

    getOlderMessages: async (
      auth: AuthContext,
      conversationId: string,
      excludeRecentCount: number = 25
    ): Promise<DBMessage[]> => {
      try {
        const all = await firestoreAdapter.messages.getByConversation(auth, conversationId);
        if (all.length <= excludeRecentCount) return [];
        return all.slice(0, all.length - excludeRecentCount);
      } catch (error) {
        throw normalizeDbError('fetching older messages', error);
      }
    },

    deleteById: async (
      auth: AuthContext,
      conversationId: string,
      messageId: string
    ): Promise<void> => {
      try {
        const conv = await getConversationWithOwnershipCheck(auth, conversationId);
        if (!conv) return;

        const { adminDb, idToken } = resolveAdminOrRest(auth);
        if (adminDb) {
          await adminDb
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .doc(messageId)
            .delete();
          return;
        }

        const url = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(
          conversationId
        )}/messages/${encodeURIComponent(messageId)}`;
        try {
          await firestoreRestFetch(url, {
            method: 'DELETE',
            idToken,
          });
        } catch (err) {
          if (err instanceof FirestoreRestHttpError && err.status === 404) {
            return;
          }
          throw err;
        }
      } catch (error) {
        throw normalizeDbError('deleting message', error);
      }
    },

    deleteByConversation: async (
      auth: AuthContext,
      conversationId: string
    ): Promise<{ changes: number }> => {
      try {
        const uid = assertAuthContext(auth);
        const conv = await getConversationWithOwnershipCheck(auth, conversationId);
        if (!conv) return { changes: 0 };

        const { adminDb, idToken } = resolveAdminOrRest(auth);
        if (adminDb) {
          const snap = await adminDb
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .where('ownerUid', '==', uid)
            .get();
          let changes = 0;
          for (let i = 0; i < snap.docs.length; i += 400) {
            const batch = adminDb.batch();
            const chunk = snap.docs.slice(i, i + 400);
            for (const d of chunk) {
              batch.delete(d.ref);
              changes++;
            }
            await batch.commit();
          }
          return { changes };
        }

        const queryUrl = `${getDocumentsBaseUrl()}/conversations/${encodeURIComponent(
          conversationId
        )}:runQuery`;
        const rows = await firestoreRestFetch<Array<{ document?: FirestoreRestDoc }>>(queryUrl, {
          method: 'POST',
          idToken,
          body: {
            structuredQuery: {
              from: [{ collectionId: 'messages' }],
              select: { fields: [] },
              where: {
                fieldFilter: {
                  field: { fieldPath: 'ownerUid' },
                  op: 'EQUAL',
                  value: { stringValue: uid },
                },
              },
            },
          },
        });

        const docNames = rows.map((r) => r.document?.name).filter((n): n is string => Boolean(n));
        if (docNames.length === 0) return { changes: 0 };

        const commitUrl = `${getDocumentsBaseUrl()}:commit`;
        let changes = 0;
        for (let i = 0; i < docNames.length; i += 400) {
          const chunk = docNames.slice(i, i + 400);
          await firestoreRestFetch(commitUrl, {
            method: 'POST',
            idToken,
            body: {
              writes: chunk.map((name) => ({ delete: name })),
            },
          });
          changes += chunk.length;
        }
        return { changes };
      } catch (error) {
        throw normalizeDbError('deleting conversation messages', error);
      }
    },
  },

  settings: {
    get: async (auth: AuthContext, key: string): Promise<string | null> => {
      if (!VALID_SETTING_KEYS.has(key)) return null;
      try {
        const uid = assertAuthContext(auth);
        const { adminDb, idToken } = resolveAdminOrRest(auth);

        if (adminDb) {
          const snap = await adminDb
            .collection('users')
            .doc(uid)
            .collection('settings')
            .doc(key)
            .get();
          if (!snap.exists) return null;
          return (snap.data()?.value as string) ?? null;
        }

        const url = `${getDocumentsBaseUrl()}/users/${encodeURIComponent(
          uid
        )}/settings/${encodeURIComponent(key)}`;
        try {
          const doc = await firestoreRestFetch<FirestoreRestDoc>(url, { idToken });
          const data = decodeDoc(doc);
          return typeof data.value === 'string' ? data.value : null;
        } catch (err) {
          if (err instanceof FirestoreRestHttpError && err.status === 404) {
            return null;
          }
          throw err;
        }
      } catch (error) {
        throw normalizeDbError('reading setting', error);
      }
    },

    set: async (auth: AuthContext, key: string, value: string): Promise<void> => {
      if (!VALID_SETTING_KEYS.has(key)) return;
      try {
        const uid = assertAuthContext(auth);
        const safeValue = String(value).slice(0, 100);
        const { adminDb, idToken } = resolveAdminOrRest(auth);

        if (adminDb) {
          await adminDb
            .collection('users')
            .doc(uid)
            .collection('settings')
            .doc(key)
            .set({ key, value: safeValue });
          return;
        }

        const url = `${getDocumentsBaseUrl()}/users/${encodeURIComponent(
          uid
        )}/settings/${encodeURIComponent(key)}`;
        await firestoreRestFetch(url, {
          method: 'PATCH',
          idToken,
          body: { fields: encodeFields({ key, value: safeValue }) },
        });
      } catch (error) {
        throw normalizeDbError('saving setting', error);
      }
    },

    getAll: async (auth: AuthContext): Promise<Record<string, string>> => {
      try {
        const uid = assertAuthContext(auth);
        const { adminDb, idToken } = resolveAdminOrRest(auth);

        if (adminDb) {
          const snap = await adminDb.collection('users').doc(uid).collection('settings').get();
          const result: Record<string, string> = {};
          for (const d of snap.docs) {
            const data = d.data() as { key?: string; value?: string };
            if (data.key && data.value !== undefined) {
              result[data.key] = String(data.value);
            }
          }
          return result;
        }

        const url = `${getDocumentsBaseUrl()}/users/${encodeURIComponent(uid)}:runQuery`;
        const rows = await firestoreRestFetch<Array<{ document?: FirestoreRestDoc }>>(url, {
          method: 'POST',
          idToken,
          body: {
            structuredQuery: {
              from: [{ collectionId: 'settings' }],
            },
          },
        });

        const result: Record<string, string> = {};
        for (const r of rows) {
          if (!r.document) continue;
          const data = decodeDoc(r.document);
          if (typeof data.key === 'string' && typeof data.value === 'string') {
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
