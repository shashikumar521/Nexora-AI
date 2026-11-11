import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import {
  conversationQueries,
  messageQueries,
  settingsQueries,
  db,
} from '../db/database.ts';
import {
  generateChatResponse,
  streamChatResponse,
  generateConversationTitle,
  getActiveModel,
} from '../services/gemini.ts';

export const apiRouter = Router();

// Basic rate limiting middleware (in-memory token bucket per IP)
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = ipRequestCounts.get(ip);

  if (!record || now > record.resetTime) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before sending another prompt.',
    });
  }

  record.count += 1;
  next();
}

apiRouter.use(rateLimiter);

/**
 * GET /api/health
 */
apiRouter.get('/health', (req: Request, res: Response) => {
  const key = process.env.GEMINI_API_KEY || '';
  const hasKey = Boolean(key && key.trim() && key !== 'MY_GEMINI_API_KEY');
  res.json({
    status: 'ok',
    app: 'Nexora AI',
    version: '1.0.0',
    model: getActiveModel(),
    apiKeyConfigured: hasKey,
    database: 'connected (SQLite)',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/models', async (req: Request, res: Response) => {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const list = await ai.models.list();
    const modelNames = [];
    for await (const m of list) {
      modelNames.push(m.name);
    }
    res.json({ models: modelNames });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/conversations
 * Retrieve conversation history with optional search
 */
apiRouter.get('/conversations', (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const conversations = conversationQueries.getAll(search);
    res.json({ conversations });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve conversations', details: error.message });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
apiRouter.post('/conversations', (req: Request, res: Response) => {
  try {
    const id = randomUUID();
    const title = req.body?.title?.trim() || 'New Chat';
    const conversation = conversationQueries.create(id, title);
    res.status(201).json({ conversation });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create conversation', details: error.message });
  }
});

/**
 * GET /api/conversations/:id
 * Retrieve a conversation and all its messages
 */
apiRouter.get('/conversations/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conversation = conversationQueries.getById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = messageQueries.getByConversation(id);
    res.json({ conversation, messages });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve conversation', details: error.message });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update title or pinned status
 */
apiRouter.patch('/conversations/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, pinned } = req.body;

    const existing = conversationQueries.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updated = conversationQueries.update(id, {
      title: typeof title === 'string' ? title.trim() : undefined,
      pinned: typeof pinned === 'boolean' ? pinned : undefined,
    });

    res.json({ conversation: updated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update conversation', details: error.message });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation and its messages
 */
apiRouter.delete('/conversations/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = conversationQueries.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    conversationQueries.delete(id);
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete conversation', details: error.message });
  }
});

/**
 * GET /api/conversations/:id/memory
 * Retrieve memory status and summary metadata for a conversation
 */
apiRouter.get('/conversations/:id/memory', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conversation = conversationQueries.getById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const totalMessages = messageQueries.getCountByConversation(id);
    const recentMessages = messageQueries.getRecentMessages(id, 25);

    // Calculate approximate tokens for active context window
    const recentTokens = recentMessages.reduce((sum, m) => sum + (m.tokens || Math.round(m.content.length / 4)), 0);
    const summaryTokens = Math.round((conversation.running_summary?.length || 0) / 4);
    const totalActiveTokens = recentTokens + summaryTokens;

    res.json({
      conversationId: id,
      strategy: 'Last 25 messages + cumulative running summary',
      totalStoredMessages: totalMessages,
      recentMessagesCount: recentMessages.length,
      maxRecentWindow: 25,
      hasRunningSummary: Boolean(conversation.running_summary && conversation.running_summary.trim()),
      runningSummary: conversation.running_summary || null,
      activeContextTokens: totalActiveTokens,
      tokenCapacity: 1000000, // 1M tokens capacity
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve memory status', details: error.message });
  }
});

/**
 * POST /api/conversations/:id/clear
 * Clear all messages in conversation
 */
apiRouter.post('/conversations/:id/clear', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    messageQueries.deleteByConversation(id);
    conversationQueries.update(id, { running_summary: '' });
    res.json({ success: true, message: 'Conversation context reset successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reset context', details: error.message });
  }
});

function sanitizeErrorMessage(err: any): string {
  if (!err) return 'An error occurred while communicating with Gemini API.';
  const msg = typeof err === 'string' ? err : err.message || '';
  const status = err.status || err.code;

  if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || msg.includes('429')) {
    return 'Gemini API rate limit exceeded. Please wait a moment and try again.';
  }
  if (status === 403 || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return 'Permission denied. Please check your Gemini API key in AI Studio Secrets.';
  }
  if (msg.includes('Timeout') || msg.includes('timed out')) {
    return 'Request timed out waiting for the AI model to respond. Please try again.';
  }
  if (status === 503 || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
    return 'The AI model is currently busy. Please retry in a few moments.';
  }

  // Strip any API keys, URLs, or internal filesystem paths
  const clean = msg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
    .replace(/https?:\/\/[^\s]+/g, '[REDACTED_URL]')
    .replace(/\/app\/[^\s:]+/g, '[INTERNAL_PATH]');

  return clean.trim() || 'An error occurred while generating the response from Gemini.';
}

/**
 * POST /api/chat/:id
 * Send message and receive response (standard or streaming SSE)
 */
apiRouter.post('/chat/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message, stream = true } = req.body;

  // Validation
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message content is required and cannot be empty.' });
  }

  if (message.length > 4096) {
    return res.status(400).json({ error: 'Message exceeds maximum allowed length of 4,096 characters.' });
  }

  // Ensure conversation exists or create it
  let conversation = conversationQueries.getById(id);
  if (!conversation) {
    conversation = conversationQueries.create(id, 'New Chat');
  }

  // Check API key
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured in backend environment. Please check the Secrets panel in AI Studio.',
    });
  }

  const userMsgId = randomUUID();
  const userTokens = Math.round(message.length / 4);

  // Store user message
  messageQueries.create(userMsgId, id, 'user', message.trim(), userTokens);

  // Auto-generate title if this is the very first turn and title is still "New Chat"
  const totalCount = messageQueries.getCountByConversation(id);
  if (totalCount <= 2 && (conversation?.title === 'New Chat' || conversation?.title === 'New Conversation')) {
    generateConversationTitle(message.trim()).then((autoTitle) => {
      conversationQueries.update(id, { title: autoTitle });
    }).catch(() => {});
  }

  console.log(`[API] Received chat request for convId: ${id}, message: "${message.slice(0, 30)}..."`);
  // Handle Streaming vs JSON
  if (stream) {
    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const assistantMsgId = randomUUID();
      console.log(`[API] Starting streamChatResponse...`);

      const result = await streamChatResponse(id, message.trim(), (chunkText) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
      });

      console.log(`[API] streamChatResponse completed. Length: ${result.text.length}`);

      // Save assistant message to database
      messageQueries.create(
        assistantMsgId,
        id,
        'assistant',
        result.text,
        result.tokens
      );

      // Send completion event

      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          messageId: assistantMsgId,
          model: result.model,
          latencyMs: result.latencyMs,
          tokens: result.tokens,
          runningSummary: result.runningSummary,
        })}\n\n`
      );
      res.end();
    } catch (err: any) {
      console.error('[API] Streaming error in chat route:', err?.message || err);
      // Remove unanswered user message so failed turn leaves no corrupt or orphan entry in SQLite
      try {
        db.prepare('DELETE FROM messages WHERE id = ?').run(userMsgId);
      } catch (cleanErr) {
        console.warn('[API] Could not clean up failed user message:', cleanErr);
      }

      const errorMessage = sanitizeErrorMessage(err);
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
      res.end();
    }
  } else {
    // Non-streaming standard response
    try {
      console.log(`[API] Calling generateChatResponse...`);
      const result = await generateChatResponse(id, message.trim());
      console.log(`[API] generateChatResponse returned! Model: ${result.model}`);
      const assistantMsgId = randomUUID();

      // Store assistant message
      const savedAssistant = messageQueries.create(
        assistantMsgId,
        id,
        'assistant',
        result.text,
        result.tokens
      );

      res.json({
        userMessage: { id: userMsgId, role: 'user', content: message.trim() },
        assistantMessage: savedAssistant,
        model: result.model,
        latencyMs: result.latencyMs,
        tokens: result.tokens,
        runningSummary: result.runningSummary,
      });
    } catch (err: any) {
      console.error('[API] Error generating chat response:', err?.message || err);
      // Remove unanswered user message so failed turn leaves no corrupt or orphan entry in SQLite
      try {
        db.prepare('DELETE FROM messages WHERE id = ?').run(userMsgId);
      } catch (cleanErr) {
        console.warn('[API] Could not clean up failed user message:', cleanErr);
      }

      const errorMessage = sanitizeErrorMessage(err);
      res.status(500).json({ error: errorMessage });
    }
  }
});

/**
 * POST /api/conversations/:id/regenerate
 * Remove last assistant message and re-run with previous user message
 */
apiRouter.post('/conversations/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const messages = messageQueries.getByConversation(id);
    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages to regenerate' });
    }

    const lastMsg = messages[messages.length - 1];
    let promptMsg = lastMsg;

    if (lastMsg.role === 'assistant') {
      // Delete last assistant message
      db.prepare('DELETE FROM messages WHERE id = ?').run(lastMsg.id);

      // Find the user prompt right before it
      const remaining = messageQueries.getByConversation(id);
      if (remaining.length === 0) {
        return res.status(400).json({ error: 'No user prompt found to regenerate' });
      }
      promptMsg = remaining[remaining.length - 1];
    }

    const result = await generateChatResponse(id, promptMsg.content);
    const newAssistantId = randomUUID();
    const savedAssistant = messageQueries.create(
      newAssistantId,
      id,
      'assistant',
      result.text,
      result.tokens
    );

    res.json({
      assistantMessage: savedAssistant,
      model: result.model,
      latencyMs: result.latencyMs,
      tokens: result.tokens,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to regenerate response', details: error.message });
  }
});

/**
 * GET & PUT /api/settings
 * Manage user preferences persisted in SQLite
 */
apiRouter.get('/settings', (req: Request, res: Response) => {
  try {
    const settings = settingsQueries.getAll();
    res.json({
      theme: settings['theme'] || 'dark',
      typographyScale: settings['typographyScale'] || '14px',
      sendOnEnter: settings['sendOnEnter'] !== 'false',
      streamResponses: settings['streamResponses'] !== 'false',
      showSyntaxHighlighting: settings['showSyntaxHighlighting'] !== 'false',
      language: settings['language'] || 'en-US',
      model: getActiveModel(),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to read settings', details: error.message });
  }
});

apiRouter.put('/settings', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (body.theme !== undefined) settingsQueries.set('theme', body.theme);
    if (body.typographyScale !== undefined) settingsQueries.set('typographyScale', body.typographyScale);
    if (body.sendOnEnter !== undefined) settingsQueries.set('sendOnEnter', String(body.sendOnEnter));
    if (body.streamResponses !== undefined) settingsQueries.set('streamResponses', String(body.streamResponses));
    if (body.showSyntaxHighlighting !== undefined) settingsQueries.set('showSyntaxHighlighting', String(body.showSyntaxHighlighting));
    if (body.language !== undefined) settingsQueries.set('language', body.language);

    res.json({ success: true, settings: settingsQueries.getAll() });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save settings', details: error.message });
  }
});

/**
 * DELETE /api/data/clear
 * Irreversible wipe of all conversations and messages
 */
apiRouter.delete('/data/clear', (req: Request, res: Response) => {
  try {
    conversationQueries.clearAll();
    res.json({ success: true, message: 'All workspace data cleared successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to clear workspace data', details: error.message });
  }
});
