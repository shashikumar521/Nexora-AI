import { Conversation, Message, MemoryStatus, AppSettings, HealthStatus } from '../types';
import { getCurrentIdToken } from '../lib/firebase';

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function apiUrl(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

async function authenticatedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const makeRequest = async (forceRefresh: boolean) => {
    const token = await getCurrentIdToken(forceRefresh);
    if (!token) {
      unauthorizedHandler?.();
      throw new Error('Authentication required. Please sign in with Google.');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return fetch(apiUrl(path), {
      ...init,
      headers,
    });
  };

  let res = await makeRequest(false);

  if (res.status === 401) {
    // Attempt a silent token refresh once before failing
    try {
      const retryRes = await makeRequest(true);
      if (retryRes.status !== 401) {
        return retryRes;
      }
      res = retryRes;
    } catch {
      // Fall through to 401 handler
    }
    unauthorizedHandler?.();
  }

  return res;
}

async function parseJsonResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    if (contentType.includes('text/html')) {
      throw new Error(
        'Backend API returned HTML instead of JSON. Ensure the Express backend server is running and handling /api/* routes.'
      );
    }
    if (!res.ok) {
      throw new Error(`${fallbackError} (HTTP ${res.status})`);
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const serverMsg = data?.error || data?.message;
    throw new Error(serverMsg || `${fallbackError} (HTTP ${res.status})`);
  }

  if (data === null) {
    throw new Error('Server returned an empty or malformed JSON response.');
  }

  return data as T;
}

export const api = {
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(apiUrl('/api/health'));
    return parseJsonResponse<HealthStatus>(res, 'Health check failed');
  },

  async getConversations(search?: string): Promise<Conversation[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await authenticatedFetch(`/api/conversations${query}`);
    const data = await parseJsonResponse<{ conversations?: Conversation[] }>(
      res,
      'Failed to fetch conversations'
    );
    return data.conversations || [];
  },

  async getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const res = await authenticatedFetch(`/api/conversations/${encodeURIComponent(id)}`);
    return parseJsonResponse<{ conversation: Conversation; messages: Message[] }>(
      res,
      'Failed to fetch conversation'
    );
  },

  async createConversation(title?: string): Promise<Conversation> {
    const res = await authenticatedFetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || 'New Chat' }),
    });
    const data = await parseJsonResponse<{ conversation?: Conversation }>(
      res,
      'Failed to create conversation session'
    );
    if (!data.conversation || !data.conversation.id) {
      throw new Error('Server did not confirm a valid conversation ID.');
    }
    return data.conversation;
  },

  async updateConversation(
    id: string,
    updates: { title?: string; pinned?: boolean }
  ): Promise<Conversation> {
    const res = await authenticatedFetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await parseJsonResponse<{ conversation: Conversation }>(
      res,
      'Failed to update conversation'
    );
    return data.conversation;
  },

  async deleteConversation(id: string): Promise<void> {
    const res = await authenticatedFetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await parseJsonResponse(res, 'Failed to delete conversation');
  },

  async getMemoryStatus(id: string): Promise<MemoryStatus> {
    const res = await authenticatedFetch(`/api/conversations/${encodeURIComponent(id)}/memory`);
    return parseJsonResponse<MemoryStatus>(res, 'Failed to fetch memory status');
  },

  async clearConversationContext(id: string): Promise<void> {
    const res = await authenticatedFetch(`/api/conversations/${encodeURIComponent(id)}/clear`, {
      method: 'POST',
    });
    await parseJsonResponse(res, 'Failed to reset conversation context');
  },

  async clearAllData(): Promise<void> {
    const res = await authenticatedFetch('/api/data/clear', {
      method: 'DELETE',
    });
    await parseJsonResponse(res, 'Failed to wipe workspace data');
  },

  async getSettings(): Promise<AppSettings> {
    const res = await authenticatedFetch('/api/settings');
    return parseJsonResponse<AppSettings>(res, 'Failed to load settings');
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const res = await authenticatedFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await parseJsonResponse<{ success?: boolean; settings?: AppSettings }>(
      res,
      'Failed to save settings'
    );
    if (!data.success || !data.settings) {
      throw new Error('Server did not confirm that settings were saved.');
    }
    return data.settings;
  },

  async regenerate(
    id: string
  ): Promise<{ assistantMessage: Message; model: string; latencyMs: number; tokens: number }> {
    const res = await authenticatedFetch(`/api/conversations/${encodeURIComponent(id)}/regenerate`, {
      method: 'POST',
    });
    return parseJsonResponse<{
      assistantMessage: Message;
      model: string;
      latencyMs: number;
      tokens: number;
    }>(res, 'Regeneration failed');
  },

  async sendChatMessage(
    conversationId: string,
    message: string,
    abortSignal?: AbortSignal
  ): Promise<{
    assistantMessage: Message;
    model: string;
    latencyMs: number;
    tokens: number;
    runningSummary?: string;
  }> {
    const res = await authenticatedFetch(`/api/chat/${encodeURIComponent(conversationId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stream: false }),
      signal: abortSignal,
    });
    return parseJsonResponse(res, 'Failed to send message');
  },

  sendChatMessageStream(
    conversationId: string,
    message: string,
    abortSignal: AbortSignal,
    onChunk: (chunk: string) => void,
    onDone: (meta: {
      messageId?: string;
      model?: string;
      latencyMs?: number;
      tokens?: number;
      runningSummary?: string;
    }) => void,
    onError: (err: string) => void
  ) {
    authenticatedFetch(`/api/chat/${encodeURIComponent(conversationId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stream: true }),
      signal: abortSignal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: '' }));
          let msg = errData.error;
          if (!msg) {
            if (response.status === 401) msg = 'Your session expired. Please sign in with Google again.';
            else if (response.status === 429) msg = 'Gemini API rate limit exceeded. Please wait a moment and try again.';
            else if (response.status === 503) msg = 'The AI model is currently busy. Please retry in a few moments.';
            else if (response.status === 403) msg = 'Permission denied. Please verify your account access or API configuration.';
            else msg = `Server error (${response.status}). Please try again.`;
          }
          onError(msg);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          onError('Failed to initialize stream reader. Please try again.');
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'chunk' && data.text) {
                onChunk(data.text);
              } else if (data.type === 'done') {
                onDone({
                  messageId: data.messageId,
                  model: data.model,
                  latencyMs: data.latencyMs,
                  tokens: data.tokens,
                  runningSummary: data.runningSummary,
                });
              } else if (data.type === 'error') {
                onError(data.error || 'Gemini encountered an issue generating a response.');
              }
            } catch {
              // Ignore partial JSON
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          onDone({ model: 'Cancelled by user' });
        } else {
          onError(
            err.message?.includes('fetch')
              ? 'Unable to reach the server. Please check your internet connection.'
              : err.message || 'Network request failed'
          );
        }
      });
  },
};
