import { Conversation, Message, MemoryStatus, AppSettings, HealthStatus } from '../types';

export const api = {
  async getHealth(): Promise<HealthStatus> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async getConversations(search?: string): Promise<Conversation[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`/api/conversations${query}`);
    if (!res.ok) throw new Error('Failed to fetch conversations');
    const data = await res.json();
    return data.conversations || [];
  },

  async getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) throw new Error('Failed to fetch conversation');
    return res.json();
  },

  async createConversation(title?: string): Promise<Conversation> {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || 'New Chat' }),
    });
    if (!res.ok) throw new Error('Failed to create conversation');
    const data = await res.json();
    return data.conversation;
  },

  async updateConversation(
    id: string,
    updates: { title?: string; pinned?: boolean }
  ): Promise<Conversation> {
    const res = await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update conversation');
    const data = await res.json();
    return data.conversation;
  },

  async deleteConversation(id: string): Promise<void> {
    const res = await fetch(`/api/conversations/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete conversation');
  },

  async getMemoryStatus(id: string): Promise<MemoryStatus> {
    const res = await fetch(`/api/conversations/${id}/memory`);
    if (!res.ok) throw new Error('Failed to fetch memory status');
    return res.json();
  },

  async clearConversationContext(id: string): Promise<void> {
    const res = await fetch(`/api/conversations/${id}/clear`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reset conversation context');
  },

  async clearAllData(): Promise<void> {
    const res = await fetch('/api/data/clear', {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to wipe workspace data');
  },

  async getSettings(): Promise<AppSettings> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to load settings');
    return res.json();
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to persist settings');
  },

  async regenerate(id: string): Promise<{ assistantMessage: Message; model: string; latencyMs: number; tokens: number }> {
    const res = await fetch(`/api/conversations/${id}/regenerate`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Regeneration failed' }));
      throw new Error(err.error || 'Regeneration failed');
    }
    return res.json();
  },

  sendChatMessageStream(
    conversationId: string,
    message: string,
    abortSignal: AbortSignal,
    onChunk: (chunk: string) => void,
    onDone: (meta: { messageId?: string; model?: string; latencyMs?: number; tokens?: number; runningSummary?: string }) => void,
    onError: (err: string) => void
  ) {
    fetch(`/api/chat/${conversationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stream: true }),
      signal: abortSignal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: 'Server error occurred' }));
          onError(errData.error || `HTTP ${response.status}`);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          onError('Failed to initialize stream reader');
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
                onError(data.error || 'Stream error');
              }
            } catch {
              // Ignore partial JSON
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          // Stream cancelled by user
          onDone({ model: 'Cancelled by user' });
        } else {
          onError(err.message || 'Network connection failed');
        }
      });
  },
};
