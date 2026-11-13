import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import {
  conversationQueries,
  messageQueries,
  settingsQueries,
  testDatabaseConnection,
  getDatabaseProviderName,
} from '../db/database.ts';
import {
  generateChatResponse,
  streamChatResponse,
  generateConversationTitle,
  getActiveModel,
  getConfiguredGeminiApiKey,
  isGeminiApiKeyConfigured,
  listAvailableModels,
  verifyGeminiAccess,
  GeminiServiceError,
  RECENT_MESSAGE_WINDOW,
} from '../services/gemini.ts';

export const apiRouter = Router();

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

// Basic rate limiting middleware (in-memory token bucket per IP)
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  if (ipRequestCounts.size > 1000) {
    for (const [k, v] of ipRequestCounts.entries()) {
      if (now > v.resetTime) ipRequestCounts.delete(k);
    }
  }
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

function redactSensitiveText(msg: string): string {
  return msg
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/key=[^&\s"']+/gi, 'key=[REDACTED]')
    .replace(/https?:\/\/[^\s"']+/g, '[REDACTED_URL]')
    .replace(/\/app\/[^\s:]+/g, '[INTERNAL_PATH]');
}

type AppErrorCategory =
  | 'GEMINI_AUTH_ERROR'
  | 'GEMINI_PERMISSION_ERROR'
  | 'GEMINI_MODEL_ERROR'
  | 'GEMINI_RATE_LIMIT'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_SERVER_ERROR'
  | 'DATABASE_CONNECTION_ERROR'
  | 'DATABASE_PERMISSION_ERROR'
  | 'DATABASE_ERROR'
  | 'APP_ERROR';

function classifyRouteError(err: unknown): {
  category: AppErrorCategory;
  httpStatus: number;
  message: string;
} {
  if (err instanceof GeminiServiceError) {
    return {
      category: err.category,
      httpStatus: err.httpStatus,
      message: err.message,
    };
  }

  const rawMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const cleanMsg = redactSensitiveText(rawMsg).trim();

  if (cleanMsg.includes('PostgreSQL permission denied')) {
    return {
      category: 'DATABASE_PERMISSION_ERROR',
      httpStatus: 500,
      message: cleanMsg,
    };
  }

  if (
    cleanMsg.includes('DATABASE_URL') ||
    cleanMsg.includes('Database connection failed') ||
    cleanMsg.includes('Database request timed out')
  ) {
    return {
      category: 'DATABASE_CONNECTION_ERROR',
      httpStatus: 503,
      message: cleanMsg,
    };
  }

  if (cleanMsg.includes('Database operation failed')) {
    return {
      category: 'DATABASE_ERROR',
      httpStatus: 500,
      message: cleanMsg,
    };
  }

  return {
    category: 'APP_ERROR',
    httpStatus: 500,
    message: cleanMsg || 'An unexpected server error occurred.',
  };
}

function sanitizeErrorMessage(err: unknown): string {
  return classifyRouteError(err).message;
}

function getDbErrorStatus(err: unknown): number {
  return classifyRouteError(err).httpStatus;
}

/**
 * GET /api/health
 */
apiRouter.get('/health', async (req: Request, res: Response) => {
  const hasKey = isGeminiApiKeyConfigured();
  const dbCheck = await testDatabaseConnection();
  const provider = getDatabaseProviderName();
  const verifyGemini = req.query.verify === 'gemini';
  const geminiVerification = verifyGemini ? await verifyGeminiAccess() : undefined;

  const overallOk = dbCheck.ok && (!verifyGemini || Boolean(geminiVerification?.ok));

  res.status(overallOk ? 200 : dbCheck.ok ? geminiVerification?.httpStatus || 503 : 503).json({
    status: overallOk ? 'ok' : 'degraded',
    app: 'Nexora AI',
    version: '1.0.0',
    model: getActiveModel(),
    apiKeyConfigured: hasKey,
    database: dbCheck.ok ? `connected (${provider})` : 'unavailable',
    ...(dbCheck.ok ? {} : { databaseError: dbCheck.error || 'Database unavailable' }),
    ...(geminiVerification ? { geminiVerification } : {}),
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/models', async (_req: Request, res: Response) => {
  try {
    const modelNames = await listAvailableModels();
    res.json({ models: modelNames });
  } catch (err: unknown) {
    const classified = classifyRouteError(err);
    console.error('[API] GET /models failed:', {
      category: classified.category,
      httpStatus: classified.httpStatus,
      message: classified.message,
    });
    res.status(classified.httpStatus).json({
      error: classified.message,
      code: classified.category,
    });
  }
});

/**
 * GET /api/conversations
 * Retrieve conversation history with optional search
 */
apiRouter.get('/conversations', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const conversations = await conversationQueries.getAll(search);
    res.json({ conversations });
  } catch (error: any) {
    console.error('[API] GET /conversations failed:', error);
    const status = getDbErrorStatus(error);
    res.status(status).json({ error: sanitizeErrorMessage(error) || 'Failed to retrieve conversations.' });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
apiRouter.post('/conversations', async (req: Request, res: Response) => {
  try {
    const id = randomUUID();
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const title = (rawTitle || 'New Chat').slice(0, 200);
    const conversation = await conversationQueries.create(id, title);
    if (!conversation?.id) {
      return res.status(500).json({ error: 'Database did not confirm conversation creation.' });
    }
    res.status(201).json({ conversation });
  } catch (error: any) {
    console.error('[API] POST /conversations failed:', error);
    const status = getDbErrorStatus(error);
    res.status(status).json({
      error: sanitizeErrorMessage(error) || 'Failed to create conversation session in persistent storage.',
    });
  }
});

/**
 * GET /api/conversations/:id
 * Retrieve a conversation and all its messages
 */
apiRouter.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const conversation = await conversationQueries.getById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await messageQueries.getByConversation(id);
    res.json({ conversation, messages });
  } catch (error: any) {
    console.error('[API] GET /conversations/:id failed:', error);
    res.status(getDbErrorStatus(error)).json({ error: sanitizeErrorMessage(error) || 'Failed to retrieve conversation.' });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update title or pinned status
 */
apiRouter.patch('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const { title, pinned } = req.body || {};

    const existing = await conversationQueries.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updated = await conversationQueries.update(id, {
      title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
      pinned: typeof pinned === 'boolean' ? pinned : undefined,
    });

    res.json({ conversation: updated });
  } catch (error: any) {
    console.error('[API] PATCH /conversations/:id failed:', error);
    res.status(getDbErrorStatus(error)).json({ error: sanitizeErrorMessage(error) || 'Failed to update conversation.' });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation and its messages
 */
apiRouter.delete('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const existing = await conversationQueries.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await conversationQueries.delete(id);
    res.json({ success: true, id });
  } catch (error: any) {
    console.error('[API] DELETE /conversations/:id failed:', error);
    res.status(getDbErrorStatus(error)).json({ error: sanitizeErrorMessage(error) || 'Failed to delete conversation.' });
  }
});

/**
 * GET /api/conversations/:id/memory
 * Retrieve memory status and summary metadata for a conversation
 */
apiRouter.get('/conversations/:id/memory', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const conversation = await conversationQueries.getById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const totalMessages = await messageQueries.getCountByConversation(id);
    const recentMessages = await messageQueries.getRecentMessages(id, RECENT_MESSAGE_WINDOW);

    // Calculate approximate tokens for active context window
    const recentTokens = recentMessages.reduce(
      (sum, m) => sum + (m.tokens || Math.round(m.content.length / 4)),
      0
    );
    const summaryTokens = Math.round((conversation.running_summary?.length || 0) / 4);
    const totalActiveTokens = recentTokens + summaryTokens;

    res.json({
      conversationId: id,
      strategy: `Last ${RECENT_MESSAGE_WINDOW} messages + cumulative running summary`,
      totalStoredMessages: totalMessages,
      recentMessagesCount: recentMessages.length,
      maxRecentWindow: RECENT_MESSAGE_WINDOW,
      hasRunningSummary: Boolean(conversation.running_summary && conversation.running_summary.trim()),
      runningSummary: conversation.running_summary || null,
      activeContextTokens: totalActiveTokens,
      tokenCapacity: 1000000, // 1M tokens capacity
    });
  } catch (error: any) {
    console.error('[API] GET /conversations/:id/memory failed:', error);
    res.status(getDbErrorStatus(error)).json({ error: sanitizeErrorMessage(error) || 'Failed to retrieve memory status.' });
  }
});

/**
 * POST /api/conversations/:id/clear
 * Clear all messages in conversation
 */
apiRouter.post('/conversations/:id/clear', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const existing = await conversationQueries.getById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    await messageQueries.deleteByConversation(id);
    await conversationQueries.update(id, { running_summary: '' });
    res.json({ success: true, message: 'Conversation context reset successfully' });
  } catch (error: any) {
    console.error('[API] POST /conversations/:id/clear failed:', error);
    res.status(getDbErrorStatus(error)).json({ error: sanitizeErrorMessage(error) || 'Failed to reset conversation context.' });
  }
});

/**
 * POST /api/chat/:id
 * Send message and receive response (standard or streaming SSE)
 */
apiRouter.post('/chat/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!VALID_ID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Invalid conversation ID format.' });
  }

  const { message, stream = true } = req.body || {};

  // Validation
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message content is required and cannot be empty.' });
  }

  if (message.length > 4096) {
    return res.status(400).json({ error: 'Message exceeds maximum allowed length of 4,096 characters.' });
  }

  // Check API key before mutating DB
  try {
    getConfiguredGeminiApiKey();
  } catch (keyErr: unknown) {
    const classified = classifyRouteError(keyErr);
    return res.status(classified.httpStatus).json({
      error: classified.message,
      code: classified.category,
    });
  }

  try {
    // Ensure conversation exists or create it
    let conversation = await conversationQueries.getById(id);
    if (!conversation) {
      conversation = await conversationQueries.create(id, 'New Chat');
    }

    const userMsgId = randomUUID();
    const userTokens = Math.round(message.trim().length / 4);

    // Store user message
    await messageQueries.create(userMsgId, id, 'user', message.trim(), userTokens);

    // Auto-generate title if this is the very first turn and title is still "New Chat"
    const totalCount = await messageQueries.getCountByConversation(id);
    if (
      totalCount <= 2 &&
      (conversation?.title === 'New Chat' || conversation?.title === 'New Conversation')
    ) {
      generateConversationTitle(message.trim())
        .then((autoTitle) => conversationQueries.update(id, { title: autoTitle }))
        .catch(() => {});
    }

    console.log(`[API] Received chat request for convId: ${id}`);

    if (stream) {
      // Setup SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      try {
        const assistantMsgId = randomUUID();
        const result = await streamChatResponse(id, message.trim(), (chunkText) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
        });

        await messageQueries.create(
          assistantMsgId,
          id,
          'assistant',
          result.text,
          result.tokens
        );

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
      } catch (err: unknown) {
        const classified = classifyRouteError(err);
        console.error('[API] Streaming error in chat route:', {
          conversationId: id,
          category: classified.category,
          httpStatus: classified.httpStatus,
          message: classified.message,
        });
        try {
          await messageQueries.deleteById(id, userMsgId);
        } catch (cleanErr) {
          console.warn('[API] Could not clean up failed user message:', cleanErr);
        }

        if (!res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              error: classified.message,
              code: classified.category,
              status: classified.httpStatus,
            })}\n\n`
          );
          res.end();
        }
      }
    } else {
      try {
        const result = await generateChatResponse(id, message.trim());
        const assistantMsgId = randomUUID();

        const savedAssistant = await messageQueries.create(
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
      } catch (err: unknown) {
        const classified = classifyRouteError(err);
        console.error('[API] Error generating chat response:', {
          conversationId: id,
          category: classified.category,
          httpStatus: classified.httpStatus,
          message: classified.message,
        });
        try {
          await messageQueries.deleteById(id, userMsgId);
        } catch (cleanErr) {
          console.warn('[API] Could not clean up failed user message:', cleanErr);
        }

        res.status(classified.httpStatus).json({
          error: classified.message,
          code: classified.category,
        });
      }
    }
  } catch (err: unknown) {
    const classified = classifyRouteError(err);
    console.error('[API] POST /chat/:id setup failed:', {
      conversationId: id,
      category: classified.category,
      httpStatus: classified.httpStatus,
      message: classified.message,
    });
    res.status(classified.httpStatus).json({
      error: classified.message,
      code: classified.category,
    });
  }
});

/**
 * POST /api/conversations/:id/regenerate
 * Remove last assistant message and re-run with previous user message
 */
apiRouter.post('/conversations/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }

    const messages = await messageQueries.getByConversation(id);
    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages to regenerate' });
    }

    const lastMsg = messages[messages.length - 1];
    let promptMsg = lastMsg;

    if (lastMsg.role === 'assistant') {
      await messageQueries.deleteById(id, lastMsg.id);

      const remaining = await messageQueries.getByConversation(id);
      if (remaining.length === 0) {
        return res.status(400).json({ error: 'No user prompt found to regenerate' });
      }
      promptMsg = remaining[remaining.length - 1];
    }

    const result = await generateChatResponse(id, promptMsg.content);
    const newAssistantId = randomUUID();
    const savedAssistant = await messageQueries.create(
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
  } catch (error: unknown) {
    const classified = classifyRouteError(error);
    console.error('[API] POST /conversations/:id/regenerate failed:', {
      category: classified.category,
      httpStatus: classified.httpStatus,
      message: classified.message,
    });
    res.status(classified.httpStatus).json({
      error: classified.message,
      code: classified.category,
    });
  }
});

/**
 * GET & PUT /api/settings
 * Manage user preferences persisted in Cloud Firestore
 */
const VALID_THEMES = new Set(['dark', 'light', 'system']);
const VALID_SCALES = new Set(['12px', '14px', '16px']);

function formatSettingsResponse(settings: Record<string, string>) {
  return {
    theme: (VALID_THEMES.has(settings['theme']) ? settings['theme'] : 'dark') as 'dark' | 'light' | 'system',
    typographyScale: (VALID_SCALES.has(settings['typographyScale']) ? settings['typographyScale'] : '14px') as '12px' | '14px' | '16px',
    sendOnEnter: settings['sendOnEnter'] !== 'false',
    streamResponses: settings['streamResponses'] !== 'false',
    showSyntaxHighlighting: settings['showSyntaxHighlighting'] !== 'false',
    language: settings['language'] || 'en-US',
    model: getActiveModel(),
  };
}

apiRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await settingsQueries.getAll();
    res.json(formatSettingsResponse(settings));
  } catch (error: any) {
    console.error('[API] GET /settings failed:', error);
    const status = getDbErrorStatus(error);
    res.status(status).json({
      error: sanitizeErrorMessage(error) || 'Failed to load settings from persistent storage.',
    });
  }
});

apiRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Invalid settings payload.' });
    }

    if (body.theme !== undefined) {
      if (!VALID_THEMES.has(String(body.theme))) {
        return res.status(400).json({ error: 'Invalid theme value.' });
      }
      await settingsQueries.set('theme', String(body.theme));
    }
    if (body.typographyScale !== undefined) {
      if (!VALID_SCALES.has(String(body.typographyScale))) {
        return res.status(400).json({ error: 'Invalid typography scale value.' });
      }
      await settingsQueries.set('typographyScale', String(body.typographyScale));
    }
    if (body.sendOnEnter !== undefined) {
      await settingsQueries.set('sendOnEnter', String(Boolean(body.sendOnEnter)));
    }
    if (body.streamResponses !== undefined) {
      await settingsQueries.set('streamResponses', String(Boolean(body.streamResponses)));
    }
    if (body.showSyntaxHighlighting !== undefined) {
      await settingsQueries.set('showSyntaxHighlighting', String(Boolean(body.showSyntaxHighlighting)));
    }
    if (body.language !== undefined) {
      const lang = String(body.language).trim().slice(0, 32);
      if (!lang) {
        return res.status(400).json({ error: 'Invalid language value.' });
      }
      await settingsQueries.set('language', lang);
    }

    const updated = await settingsQueries.getAll();
    res.json({ success: true, settings: formatSettingsResponse(updated) });
  } catch (error: any) {
    console.error('[API] PUT /settings failed:', error);
    const status = getDbErrorStatus(error);
    res.status(status).json({ error: sanitizeErrorMessage(error) || 'Failed to persist settings.' });
  }
});

/**
 * DELETE /api/data/clear
 * Irreversible wipe of all conversations and messages
 */
apiRouter.delete('/data/clear', async (_req: Request, res: Response) => {
  try {
    await conversationQueries.clearAll();
    res.json({ success: true, message: 'All workspace data cleared successfully' });
  } catch (error: any) {
    console.error('[API] DELETE /data/clear failed:', error);
    res.status(getDbErrorStatus(error)).json({ error: sanitizeErrorMessage(error) || 'Failed to clear workspace data.' });
  }
});
