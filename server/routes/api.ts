import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';
import {
  type AuthContext,
  OwnershipForbiddenError,
  conversationQueries,
  messageQueries,
  settingsQueries,
  testDatabaseConnection,
  getDatabaseProviderName,
} from '../db/database.ts';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import {
  getFirebaseAdminStatus,
} from '../lib/firebaseAdmin.ts';
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

function getAuthContext(req: AuthenticatedRequest): AuthContext {
  if (!req.user?.uid) {
    throw new OwnershipForbiddenError('Authentication required.');
  }
  return {
    uid: req.user.uid,
    idToken: req.user.idToken,
  };
}

function redactSensitiveText(msg: string): string {
  return msg
    .replace(/-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/"private_key"\s*:\s*"[^"]*"/gi, '"private_key":"[REDACTED]"')
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/key=[^&\s"']+/gi, 'key=[REDACTED]')
    .replace(/https?:\/\/[^\s"']+/g, '[REDACTED_URL]')
    .replace(/\/app\/[^\s:]+/g, '[INTERNAL_PATH]');
}

type AppErrorCategory =
  | 'FORBIDDEN'
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
  if (err instanceof OwnershipForbiddenError) {
    return {
      category: 'FORBIDDEN',
      httpStatus: 403,
      message: err.message,
    };
  }

  if (err instanceof GeminiServiceError) {
    return {
      category: err.category,
      httpStatus: err.httpStatus,
      message: err.message,
    };
  }

  const rawMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const cleanMsg = redactSensitiveText(rawMsg).trim();

  if (
    cleanMsg.includes('PostgreSQL permission denied') ||
    cleanMsg.includes('Firestore permission denied')
  ) {
    return {
      category: 'DATABASE_PERMISSION_ERROR',
      httpStatus: 500,
      message: cleanMsg,
    };
  }

  if (
    cleanMsg.includes('DATABASE_URL') ||
    cleanMsg.includes('Database connection failed') ||
    cleanMsg.includes('Database request timed out') ||
    cleanMsg.includes('FIREBASE_SERVICE_ACCOUNT_JSON') ||
    cleanMsg.includes('Firebase Admin')
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

function handleRouteError(route: string, err: unknown, res: Response, fallbackMessage: string) {
  const classified = classifyRouteError(err);
  const provider = getDatabaseProviderName();
  const adminStatus = getFirebaseAdminStatus();
  console.error(`[API] ${route} failed:`, {
    category: classified.category,
    httpStatus: classified.httpStatus,
    provider,
    firebaseAdminConfigured: adminStatus.configured,
    firebaseAdminInitialized: adminStatus.initialized,
    message: classified.message || fallbackMessage,
  });
  return res.status(classified.httpStatus).json({
    error: classified.message || fallbackMessage,
    code: classified.category,
  });
}

/**
 * GET /api/health
 * Public readiness probe (never returns private user or conversation data)
 */
apiRouter.get('/health', async (req: Request, res: Response) => {
  const hasKey = isGeminiApiKeyConfigured();
  const dbCheck = await testDatabaseConnection();
  const provider = getDatabaseProviderName();
  const firebaseAdmin = getFirebaseAdminStatus();
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
    firebaseAdmin,
    ...(dbCheck.ok ? {} : { databaseError: dbCheck.error || 'Database unavailable' }),
    ...(geminiVerification ? { geminiVerification } : {}),
    timestamp: new Date().toISOString(),
  });
});

// Protect all user data, chat, model, and settings endpoints with Firebase Auth ID token verification
apiRouter.use(requireAuth);

apiRouter.get('/models', async (_req: AuthenticatedRequest, res: Response) => {
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
 * Retrieve authenticated user's conversation history with optional search
 */
apiRouter.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const search = req.query.search as string | undefined;
    const conversations = await conversationQueries.getAll(auth, search);
    res.json({ conversations });
  } catch (error: unknown) {
    return handleRouteError('GET /conversations', error, res, 'Failed to retrieve conversations.');
  }
});

/**
 * POST /api/conversations
 * Create a new conversation owned by the verified authenticated user
 */
apiRouter.post('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const id = randomUUID();
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const title = (rawTitle || 'New Chat').slice(0, 200);
    const conversation = await conversationQueries.create(auth, id, title);
    if (!conversation?.id) {
      return res.status(500).json({ error: 'Database did not confirm conversation creation.' });
    }
    res.status(201).json({ conversation });
  } catch (error: unknown) {
    return handleRouteError(
      'POST /conversations',
      error,
      res,
      'Failed to create conversation session in persistent storage.'
    );
  }
});

/**
 * GET /api/conversations/:id
 * Retrieve an owned conversation and all its messages
 */
apiRouter.get('/conversations/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const conversation = await conversationQueries.getById(auth, id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await messageQueries.getByConversation(auth, id);
    res.json({ conversation, messages });
  } catch (error: unknown) {
    return handleRouteError('GET /conversations/:id', error, res, 'Failed to retrieve conversation.');
  }
});

/**
 * PATCH /api/conversations/:id
 * Update title or pinned status for an owned conversation
 */
apiRouter.patch('/conversations/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const { title, pinned } = req.body || {};

    const existing = await conversationQueries.getById(auth, id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updated = await conversationQueries.update(auth, id, {
      title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
      pinned: typeof pinned === 'boolean' ? pinned : undefined,
    });

    res.json({ conversation: updated });
  } catch (error: unknown) {
    return handleRouteError('PATCH /conversations/:id', error, res, 'Failed to update conversation.');
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete an owned conversation and its messages
 */
apiRouter.delete('/conversations/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const existing = await conversationQueries.getById(auth, id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await conversationQueries.delete(auth, id);
    res.json({ success: true, id });
  } catch (error: unknown) {
    return handleRouteError('DELETE /conversations/:id', error, res, 'Failed to delete conversation.');
  }
});

/**
 * GET /api/conversations/:id/memory
 * Retrieve memory status and summary metadata for an owned conversation
 */
apiRouter.get('/conversations/:id/memory', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const conversation = await conversationQueries.getById(auth, id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const totalMessages = await messageQueries.getCountByConversation(auth, id);
    const recentMessages = await messageQueries.getRecentMessages(auth, id, RECENT_MESSAGE_WINDOW);

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
      tokenCapacity: 1000000,
    });
  } catch (error: unknown) {
    return handleRouteError('GET /conversations/:id/memory', error, res, 'Failed to retrieve memory status.');
  }
});

/**
 * POST /api/conversations/:id/clear
 * Clear all messages in an owned conversation
 */
apiRouter.post('/conversations/:id/clear', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
    const existing = await conversationQueries.getById(auth, id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    await messageQueries.deleteByConversation(auth, id);
    await conversationQueries.update(auth, id, { running_summary: '' });
    res.json({ success: true, message: 'Conversation context reset successfully' });
  } catch (error: unknown) {
    return handleRouteError('POST /conversations/:id/clear', error, res, 'Failed to reset conversation context.');
  }
});

/**
 * POST /api/chat/:id
 * Send message and receive response (standard or streaming SSE) inside an owned conversation
 */
apiRouter.post('/chat/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (!VALID_ID_REGEX.test(id)) {
    return res.status(400).json({ error: 'Invalid conversation ID format.' });
  }

  const { message, stream = true } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message content is required and cannot be empty.' });
  }

  if (message.length > 4096) {
    return res.status(400).json({ error: 'Message exceeds maximum allowed length of 4,096 characters.' });
  }

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
    const auth = getAuthContext(req);
    // Verify ownership if conversation exists, or create under the authenticated user's UID
    let conversation = await conversationQueries.getById(auth, id);
    if (!conversation) {
      conversation = await conversationQueries.create(auth, id, 'New Chat');
    }

    const userMsgId = randomUUID();
    const userTokens = Math.round(message.trim().length / 4);

    await messageQueries.create(auth, userMsgId, id, 'user', message.trim(), userTokens);

    const totalCount = await messageQueries.getCountByConversation(auth, id);
    if (
      totalCount <= 2 &&
      (conversation?.title === 'New Chat' || conversation?.title === 'New Conversation')
    ) {
      generateConversationTitle(message.trim())
        .then((autoTitle) => conversationQueries.update(auth, id, { title: autoTitle }))
        .catch(() => {});
    }

    console.log(`[API] Received chat request for convId: ${id} (uid: ${auth.uid})`);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      try {
        const assistantMsgId = randomUUID();
        const result = await streamChatResponse(auth, id, message.trim(), (chunkText) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
        });

        await messageQueries.create(
          auth,
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
          await messageQueries.deleteById(auth, id, userMsgId);
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
        const result = await generateChatResponse(auth, id, message.trim());
        const assistantMsgId = randomUUID();

        const savedAssistant = await messageQueries.create(
          auth,
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
          await messageQueries.deleteById(auth, id, userMsgId);
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
 * Remove last assistant message and re-run with previous user message for an owned conversation
 */
apiRouter.post('/conversations/:id/regenerate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const { id } = req.params;
    if (!VALID_ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }

    const existing = await conversationQueries.getById(auth, id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await messageQueries.getByConversation(auth, id);
    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages to regenerate' });
    }

    const lastMsg = messages[messages.length - 1];
    let promptMsg = lastMsg;

    if (lastMsg.role === 'assistant') {
      await messageQueries.deleteById(auth, id, lastMsg.id);

      const remaining = await messageQueries.getByConversation(auth, id);
      if (remaining.length === 0) {
        return res.status(400).json({ error: 'No user prompt found to regenerate' });
      }
      promptMsg = remaining[remaining.length - 1];
    }

    const result = await generateChatResponse(auth, id, promptMsg.content);
    const newAssistantId = randomUUID();
    const savedAssistant = await messageQueries.create(
      auth,
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
 * Manage per-user preferences persisted in database under authenticated UID
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

apiRouter.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const settings = await settingsQueries.getAll(auth);
    res.json(formatSettingsResponse(settings));
  } catch (error: unknown) {
    return handleRouteError('GET /settings', error, res, 'Failed to load settings from persistent storage.');
  }
});

apiRouter.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Invalid settings payload.' });
    }

    if (body.theme !== undefined) {
      if (!VALID_THEMES.has(String(body.theme))) {
        return res.status(400).json({ error: 'Invalid theme value.' });
      }
      await settingsQueries.set(auth, 'theme', String(body.theme));
    }
    if (body.typographyScale !== undefined) {
      if (!VALID_SCALES.has(String(body.typographyScale))) {
        return res.status(400).json({ error: 'Invalid typography scale value.' });
      }
      await settingsQueries.set(auth, 'typographyScale', String(body.typographyScale));
    }
    if (body.sendOnEnter !== undefined) {
      await settingsQueries.set(auth, 'sendOnEnter', String(Boolean(body.sendOnEnter)));
    }
    if (body.streamResponses !== undefined) {
      await settingsQueries.set(auth, 'streamResponses', String(Boolean(body.streamResponses)));
    }
    if (body.showSyntaxHighlighting !== undefined) {
      await settingsQueries.set(auth, 'showSyntaxHighlighting', String(Boolean(body.showSyntaxHighlighting)));
    }
    if (body.language !== undefined) {
      const lang = String(body.language).trim().slice(0, 32);
      if (!lang) {
        return res.status(400).json({ error: 'Invalid language value.' });
      }
      await settingsQueries.set(auth, 'language', lang);
    }

    const updated = await settingsQueries.getAll(auth);
    res.json({ success: true, settings: formatSettingsResponse(updated) });
  } catch (error: unknown) {
    return handleRouteError('PUT /settings', error, res, 'Failed to persist settings.');
  }
});

/**
 * DELETE /api/data/clear
 * Irreversible wipe of ONLY the authenticated user's own conversations and messages
 */
apiRouter.delete('/data/clear', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const auth = getAuthContext(req);
    await conversationQueries.clearAll(auth);
    res.json({ success: true, message: 'All workspace data for your account cleared successfully' });
  } catch (error: unknown) {
    return handleRouteError('DELETE /data/clear', error, res, 'Failed to clear workspace data.');
  }
});
