import { GoogleGenAI } from '@google/genai';
import { NEXORA_SYSTEM_PROMPT } from '../prompts/systemPrompt.ts';
import { type AuthContext, conversationQueries, messageQueries } from '../db/database.ts';

export const RECENT_MESSAGE_WINDOW = 20;
export const PRIMARY_DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_ATTEMPT_TIMEOUT_MS = 25000;

export const DEPRECATED_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
];

export type GeminiErrorCategory =
  | 'GEMINI_AUTH_ERROR'
  | 'GEMINI_PERMISSION_ERROR'
  | 'GEMINI_MODEL_ERROR'
  | 'GEMINI_RATE_LIMIT'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_SERVER_ERROR';

export class GeminiServiceError extends Error {
  readonly category: GeminiErrorCategory;
  readonly httpStatus: number;
  readonly model: string;
  readonly googleStatus?: string;
  readonly googleReason?: string;
  readonly retryable: boolean;

  constructor(params: {
    message: string;
    category: GeminiErrorCategory;
    httpStatus: number;
    model: string;
    googleStatus?: string;
    googleReason?: string;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'GeminiServiceError';
    this.category = params.category;
    this.httpStatus = params.httpStatus;
    this.model = params.model;
    this.googleStatus = params.googleStatus;
    this.googleReason = params.googleReason;
    this.retryable = Boolean(params.retryable);
  }
}

/**
 * Strip API key patterns and internal URLs before exposing/logging strings.
 */
function redactSecrets(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .replace(/key=[^&\s"']+/gi, 'key=[REDACTED]')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[REDACTED_DATABASE_URL]');
}

/**
 * Model configuration: honor GEMINI_MODEL env var or default strictly to 'gemini-3.1-flash-lite'.
 * Never silently substitute another model when the configured model fails.
 */
export const getActiveModel = (): string => {
  const raw = process.env.GEMINI_MODEL?.trim().replace(/^models\//, '');
  if (raw && !DEPRECATED_MODELS.includes(raw)) {
    return raw;
  }
  return PRIMARY_DEFAULT_MODEL;
};

/**
 * Read and validate GEMINI_API_KEY without ever logging or returning the key itself.
 */
export function getConfiguredGeminiApiKey(): string {
  let apiKey = (process.env.GEMINI_API_KEY ?? '').trim();

  // Handle accidental wrapping quotes in Vercel / .env UI pastes
  if (
    (apiKey.startsWith('"') && apiKey.endsWith('"') && apiKey.length >= 2) ||
    (apiKey.startsWith("'") && apiKey.endsWith("'") && apiKey.length >= 2)
  ) {
    apiKey = apiKey.slice(1, -1).trim();
  }

  const placeholders = new Set(['MY_GEMINI_API_KEY', 'your_gemini_api_key', 'YOUR_API_KEY']);
  if (!apiKey || placeholders.has(apiKey)) {
    throw new GeminiServiceError({
      message:
        'GEMINI_API_KEY is not configured in the backend environment variables. Set a valid Google AI Studio Gemini API key in your deployment settings.',
      category: 'GEMINI_AUTH_ERROR',
      httpStatus: 401,
      model: getActiveModel(),
      googleReason: 'MISSING_API_KEY',
      retryable: false,
    });
  }

  return apiKey;
}

export function isGeminiApiKeyConfigured(): boolean {
  try {
    getConfiguredGeminiApiKey();
    return true;
  } catch {
    return false;
  }
}

const getGenAIClient = () => {
  const apiKey = getConfiguredGeminiApiKey();

  return new GoogleGenAI({
    apiKey,
    vertexai: false,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

interface ParsedGoogleApiError {
  code?: number;
  status?: string;
  message?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

function parseGoogleApiError(err: unknown): ParsedGoogleApiError {
  const errObj = err as { status?: number; code?: number; message?: string };
  const rawMessage = typeof err === 'string' ? err : errObj?.message || '';
  const result: ParsedGoogleApiError = {
    code: typeof errObj?.status === 'number' ? errObj.status : typeof errObj?.code === 'number' ? errObj.code : undefined,
    message: rawMessage,
  };

  // Extract JSON payload embedded in @google/genai ApiError.message
  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart));
      const inner = parsed?.error && typeof parsed.error === 'object' ? parsed.error : parsed;
      if (typeof inner?.code === 'number') result.code = inner.code;
      if (typeof inner?.status === 'string') result.status = inner.status;
      if (typeof inner?.message === 'string') result.message = inner.message;
      if (Array.isArray(inner?.details)) {
        const info = inner.details.find(
          (d: any) => typeof d?.reason === 'string' || typeof d?.metadata === 'object'
        );
        if (info?.reason) result.reason = String(info.reason);
        if (info?.metadata) result.metadata = info.metadata;
      }
    } catch {
      // Keep raw fallback fields
    }
  }

  return result;
}

/**
 * Classify Google Gemini API errors into accurate categories without conflating them with DB errors.
 * Logs full safe Google diagnostics server-side while returning clear, secret-free user messages.
 */
export function classifyGeminiError(err: unknown, model: string): GeminiServiceError {
  if (err instanceof GeminiServiceError) {
    return err;
  }

  const parsed = parseGoogleApiError(err);
  const safeDetail = redactSecrets(parsed.message || '');
  const lower = safeDetail.toLowerCase();
  const reason = parsed.reason || '';
  const statusCode = parsed.code;
  const googleStatus = parsed.status || '';

  console.error('[Gemini] API call failed:', {
    model,
    httpStatus: statusCode ?? 'unknown',
    googleStatus: googleStatus || 'unknown',
    googleReason: reason || 'unknown',
    message: safeDetail || 'Unknown Gemini API error',
  });

  // 1. Timeout / Abort
  const errObj = err as { name?: string };
  if (
    errObj?.name === 'AbortError' ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted')
  ) {
    return new GeminiServiceError({
      message: `Gemini API request timed out waiting for model "${model}". Please try again.`,
      category: 'GEMINI_TIMEOUT',
      httpStatus: 504,
      model,
      googleStatus,
      googleReason: reason || 'TIMEOUT',
      retryable: true,
      cause: err,
    });
  }

  // 2. Authentication / Invalid API Key (400 API_KEY_INVALID, 401 UNAUTHENTICATED)
  if (
    statusCode === 401 ||
    reason === 'API_KEY_INVALID' ||
    googleStatus === 'UNAUTHENTICATED' ||
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid')
  ) {
    return new GeminiServiceError({
      message:
        'Gemini API authentication failed: the configured GEMINI_API_KEY is invalid or malformed. Verify GEMINI_API_KEY in your backend environment variables.',
      category: 'GEMINI_AUTH_ERROR',
      httpStatus: 401,
      model,
      googleStatus: googleStatus || 'UNAUTHENTICATED',
      googleReason: reason || 'API_KEY_INVALID',
      retryable: false,
      cause: err,
    });
  }

  // 3. Permission Denied / Key Restrictions / Disabled Service / Leaked Key (403)
  if (statusCode === 403 || googleStatus === 'PERMISSION_DENIED') {
    if (lower.includes('leaked')) {
      return new GeminiServiceError({
        message:
          'Gemini API rejected the configured GEMINI_API_KEY (HTTP 403): Google flagged this key as leaked and disabled it. Generate a new API key in Google AI Studio and update GEMINI_API_KEY.',
        category: 'GEMINI_AUTH_ERROR',
        httpStatus: 403,
        model,
        googleStatus: googleStatus || 'PERMISSION_DENIED',
        googleReason: reason || 'API_KEY_LEAKED',
        retryable: false,
        cause: err,
      });
    }

    if (reason === 'API_KEY_HTTP_REFERRER_BLOCKED' || lower.includes('referer') || lower.includes('referrer')) {
      return new GeminiServiceError({
        message:
          'Gemini API permission denied (HTTP 403): GEMINI_API_KEY has HTTP referrer restrictions, which block server-side requests. In Google Cloud Console, set the API key Application restrictions to None for backend usage.',
        category: 'GEMINI_PERMISSION_ERROR',
        httpStatus: 403,
        model,
        googleStatus: googleStatus || 'PERMISSION_DENIED',
        googleReason: reason || 'API_KEY_HTTP_REFERRER_BLOCKED',
        retryable: false,
        cause: err,
      });
    }

    if (reason === 'API_KEY_IP_ADDRESS_BLOCKED' || lower.includes('ip address')) {
      return new GeminiServiceError({
        message:
          'Gemini API permission denied (HTTP 403): GEMINI_API_KEY has IP address restrictions that block Vercel serverless IPs. Remove IP restrictions on this key in Google Cloud Console.',
        category: 'GEMINI_PERMISSION_ERROR',
        httpStatus: 403,
        model,
        googleStatus: googleStatus || 'PERMISSION_DENIED',
        googleReason: reason || 'API_KEY_IP_ADDRESS_BLOCKED',
        retryable: false,
        cause: err,
      });
    }

    if (
      reason === 'SERVICE_DISABLED' ||
      reason === 'API_KEY_SERVICE_BLOCKED' ||
      lower.includes('has not been used in project') ||
      lower.includes('service_disabled') ||
      lower.includes('api has not been used') ||
      lower.includes('requests to this api generativelanguage.googleapis.com')
    ) {
      return new GeminiServiceError({
        message:
          'Gemini API permission denied (HTTP 403): Generative Language API (generativelanguage.googleapis.com) is disabled or blocked by API restrictions on GEMINI_API_KEY. Enable the Generative Language API and allow it in your API key restrictions.',
        category: 'GEMINI_PERMISSION_ERROR',
        httpStatus: 403,
        model,
        googleStatus: googleStatus || 'PERMISSION_DENIED',
        googleReason: reason || 'SERVICE_DISABLED',
        retryable: false,
        cause: err,
      });
    }

    const detailSuffix = safeDetail ? ` (${safeDetail})` : '';
    return new GeminiServiceError({
      message: `Gemini API permission denied (HTTP 403) for model "${model}"${detailSuffix}. Check your Google AI Studio / Google Cloud API key permissions and restrictions.`,
      category: 'GEMINI_PERMISSION_ERROR',
      httpStatus: 403,
      model,
      googleStatus: googleStatus || 'PERMISSION_DENIED',
      googleReason: reason || 'PERMISSION_DENIED',
      retryable: false,
      cause: err,
    });
  }

  // 4. Model Not Found / Unsupported (404)
  if (
    statusCode === 404 ||
    googleStatus === 'NOT_FOUND' ||
    lower.includes('not found') ||
    lower.includes('no longer available')
  ) {
    return new GeminiServiceError({
      message: `Gemini model "${model}" was not found or is not accessible on this API endpoint/key (HTTP 404). Verify model availability for your Google AI Studio project.`,
      category: 'GEMINI_MODEL_ERROR',
      httpStatus: 404,
      model,
      googleStatus: googleStatus || 'NOT_FOUND',
      googleReason: reason || 'MODEL_NOT_FOUND',
      retryable: false,
      cause: err,
    });
  }

  // 5. Quota / Rate Limit (429)
  if (
    statusCode === 429 ||
    googleStatus === 'RESOURCE_EXHAUSTED' ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota')
  ) {
    return new GeminiServiceError({
      message: `Gemini API quota or rate limit exceeded (HTTP 429) for model "${model}". Please wait a moment or check your Google AI Studio quota.`,
      category: 'GEMINI_RATE_LIMIT',
      httpStatus: 429,
      model,
      googleStatus: googleStatus || 'RESOURCE_EXHAUSTED',
      googleReason: reason || 'RATE_LIMIT_EXCEEDED',
      retryable: true,
      cause: err,
    });
  }

  // 6. Transient Server Errors (500, 502, 503, 504)
  if (
    (typeof statusCode === 'number' && statusCode >= 500) ||
    googleStatus === 'UNAVAILABLE' ||
    googleStatus === 'INTERNAL' ||
    lower.includes('high demand') ||
    lower.includes('unavailable')
  ) {
    return new GeminiServiceError({
      message: `Gemini API service is temporarily unavailable (HTTP ${statusCode || 503}) for model "${model}". Please retry in a few moments.`,
      category: 'GEMINI_SERVER_ERROR',
      httpStatus: typeof statusCode === 'number' && statusCode >= 500 ? statusCode : 503,
      model,
      googleStatus: googleStatus || 'UNAVAILABLE',
      googleReason: reason || 'SERVICE_UNAVAILABLE',
      retryable: true,
      cause: err,
    });
  }

  // 7. Bad Request (400 other than API_KEY_INVALID)
  if (statusCode === 400 || googleStatus === 'INVALID_ARGUMENT') {
    return new GeminiServiceError({
      message: `Gemini API rejected the request for model "${model}" (HTTP 400${safeDetail ? `: ${safeDetail}` : ''}).`,
      category: 'GEMINI_MODEL_ERROR',
      httpStatus: 400,
      model,
      googleStatus: googleStatus || 'INVALID_ARGUMENT',
      googleReason: reason || 'INVALID_ARGUMENT',
      retryable: false,
      cause: err,
    });
  }

  return new GeminiServiceError({
    message: safeDetail || `Gemini API request failed for model "${model}".`,
    category: 'GEMINI_SERVER_ERROR',
    httpStatus: typeof statusCode === 'number' && statusCode >= 400 ? statusCode : 502,
    model,
    googleStatus,
    googleReason: reason,
    retryable: false,
    cause: err,
  });
}

/**
 * Summarizes older messages when conversation history exceeds the 20-message window
 */
export async function updateRunningSummaryIfNeeded(
  auth: AuthContext,
  conversationId: string
): Promise<string> {
  const conv = await conversationQueries.getById(auth, conversationId);
  if (!conv) return '';

  const totalCount = await messageQueries.getCountByConversation(auth, conversationId);
  if (totalCount <= RECENT_MESSAGE_WINDOW) {
    return conv.running_summary || '';
  }

  const olderMessages = await messageQueries.getOlderMessages(
    auth,
    conversationId,
    RECENT_MESSAGE_WINDOW
  );
  if (olderMessages.length === 0) {
    return conv.running_summary || '';
  }

  try {
    const ai = getGenAIClient();
    const olderFormatted = olderMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Nexora AI'}: ${m.content}`)
      .join('\n\n');

    const summaryPrompt = `You are the memory consolidation engine for Nexora AI.
Update the existing running summary for this conversation by incorporating the older conversation turns provided below.
Rules:
- Capture all key user preferences, personal details (e.g. name, learning goals, tech stack), decisions, and core discussion points.
- Preserve continuity and context so the assistant can accurately reference earlier discussions.
- Keep the summary factual, concise, and structured.

Current Running Summary:
${conv.running_summary ? conv.running_summary : '(No previous summary)'}

Older Conversation Turns to Incorporate:
${olderFormatted}

Provide the updated cumulative running summary:`;

    const { result: summaryResponse } = await callWithRetry(async (modelToUse, signal) => {
      return await ai.models.generateContent({
        model: modelToUse,
        contents: summaryPrompt,
        config: {
          systemInstruction:
            'You summarize conversational memory accurately and concisely for assistant context.',
          abortSignal: signal,
        },
      });
    }, getActiveModel());

    const newSummary = summaryResponse.text?.trim() || conv.running_summary || '';
    if (newSummary) {
      await conversationQueries.update(auth, conversationId, { running_summary: newSummary });
      return newSummary;
    }
  } catch (error) {
    console.warn('[Gemini] Running summary skipped due to error; preserving existing summary.');
    if (error instanceof GeminiServiceError && !error.retryable) {
      throw error;
    }
    return conv.running_summary || '';
  }

  return conv.running_summary || '';
}

/**
 * Generates an automatic 3-5 word title for a new conversation based on the initial user message
 */
export async function generateConversationTitle(userMessage: string): Promise<string> {
  try {
    const ai = getGenAIClient();
    const { result: response } = await callWithRetry(async (modelToUse, signal) => {
      return await ai.models.generateContent({
        model: modelToUse,
        contents: `Create a brief, clean title (maximum 4-6 words, no quotes, no markdown) summarizing this user inquiry:\n\n"${userMessage}"`,
        config: {
          systemInstruction: 'Return only the brief title text, nothing else.',
          abortSignal: signal,
        },
      });
    }, getActiveModel());

    const title = response.text?.trim().replace(/^["']|["']$/g, '');
    return title && title.length <= 60 ? title : 'New Conversation';
  } catch {
    return userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '');
  }
}

/**
 * Construct the full context for Gemini (System instructions + Running Summary + Last 20 messages)
 */
export async function buildConversationContext(
  auth: AuthContext,
  conversationId: string,
  newUserMessage?: string
) {
  const runningSummary = await updateRunningSummaryIfNeeded(auth, conversationId);

  let systemInstruction = NEXORA_SYSTEM_PROMPT;
  if (runningSummary && runningSummary.trim()) {
    systemInstruction += `\n\n[CONVERSATION RUNNING SUMMARY OF EARLIER TURNS]\n${runningSummary}\n[END RUNNING SUMMARY]`;
  }

  const recentMessages = await messageQueries.getRecentMessages(
    auth,
    conversationId,
    RECENT_MESSAGE_WINDOW
  );

  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  let lastRole: 'user' | 'model' | null = null;

  for (const msg of recentMessages) {
    const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
    if (role === lastRole && contents.length > 0) {
      contents[contents.length - 1].parts[0].text += '\n\n' + msg.content;
    } else {
      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
      lastRole = role;
    }
  }

  if (
    newUserMessage &&
    (contents.length === 0 || contents[contents.length - 1].parts[0].text !== newUserMessage)
  ) {
    if (lastRole === 'user' && contents.length > 0) {
      contents[contents.length - 1].parts[0].text += '\n\n' + newUserMessage;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: newUserMessage }],
      });
    }
  }

  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  if (contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: newUserMessage || 'Hello' }],
    });
  }

  return {
    systemInstruction,
    contents,
    runningSummary,
    recentCount: recentMessages.length,
  };
}

/**
 * Execute a Gemini SDK request strictly against the configured model.
 * Retries ONLY transient 429/5xx/timeout errors with exponential backoff.
 * Never retries or silently swaps models on 400/401/403/404 errors.
 */
async function callWithRetry<T>(
  action: (modelName: string, signal: AbortSignal) => Promise<T>,
  primaryModel: string
): Promise<{ result: T; usedModel: string }> {
  const maxAttempts = 3;
  let lastClassified: GeminiServiceError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      console.log(`[Gemini] Calling model ${primaryModel} (attempt ${attempt}/${maxAttempts})...`);

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Timeout after ${GEMINI_ATTEMPT_TIMEOUT_MS}ms calling ${primaryModel}`));
        }, GEMINI_ATTEMPT_TIMEOUT_MS);
      });

      const result = await Promise.race([action(primaryModel, controller.signal), timeoutPromise]);
      console.log(`[Gemini] Successfully generated response from ${primaryModel}.`);
      return { result, usedModel: primaryModel };
    } catch (err: unknown) {
      const classified = classifyGeminiError(err, primaryModel);
      lastClassified = classified;

      // Fail immediately on permanent authentication, permission, invalid-argument, or model-not-found errors
      if (!classified.retryable || attempt >= maxAttempts) {
        throw classified;
      }

      const backoffMs = 600 * Math.pow(2, attempt - 1);
      console.warn(
        `[Gemini] Transient error (${classified.category}, HTTP ${classified.httpStatus}) for ${primaryModel}; retrying in ${backoffMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  throw (
    lastClassified ||
    new GeminiServiceError({
      message: `Gemini API call failed for model "${primaryModel}".`,
      category: 'GEMINI_SERVER_ERROR',
      httpStatus: 503,
      model: primaryModel,
    })
  );
}

/**
 * List available Gemini models using the configured GEMINI_API_KEY.
 */
export async function listAvailableModels(): Promise<string[]> {
  const model = getActiveModel();
  try {
    const ai = getGenAIClient();
    const list = await ai.models.list();
    const modelNames: string[] = [];
    for await (const m of list) {
      if (m.name) modelNames.push(m.name);
    }
    return modelNames;
  } catch (err) {
    throw classifyGeminiError(err, model);
  }
}

/**
 * Verify live Gemini authentication & access for the active model.
 */
export async function verifyGeminiAccess(): Promise<{
  ok: boolean;
  model: string;
  category?: GeminiErrorCategory;
  httpStatus?: number;
  googleReason?: string;
  error?: string;
}> {
  const model = getActiveModel();
  try {
    const ai = getGenAIClient();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      await ai.models.generateContent({
        model,
        contents: 'Reply with OK',
        config: {
          systemInstruction: 'Reply with a single word: OK',
          abortSignal: controller.signal,
        },
      });
      return { ok: true, model };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const classified = classifyGeminiError(err, model);
    return {
      ok: false,
      model,
      category: classified.category,
      httpStatus: classified.httpStatus,
      googleReason: classified.googleReason,
      error: classified.message,
    };
  }
}

/**
 * Generate a complete response (non-streaming)
 */
export async function generateChatResponse(
  auth: AuthContext,
  conversationId: string,
  userMessage: string
) {
  const ai = getGenAIClient();
  const configuredModel = getActiveModel();
  const startTime = Date.now();

  const { systemInstruction, contents, runningSummary, recentCount } =
    await buildConversationContext(auth, conversationId, userMessage);

  const { result: response, usedModel } = await callWithRetry(async (modelToUse, signal) => {
    return await ai.models.generateContent({
      model: modelToUse,
      contents,
      config: {
        systemInstruction,
        abortSignal: signal,
      },
    });
  }, configuredModel);

  const durationMs = Date.now() - startTime;
  const assistantReply =
    response.text || 'I apologize, but I was unable to generate a response. Please try again.';

  return {
    text: assistantReply,
    model: usedModel,
    latencyMs: durationMs,
    runningSummary,
    recentCount,
    tokens: Math.round(assistantReply.length / 4),
  };
}

/**
 * Stream chat response
 */
export async function streamChatResponse(
  auth: AuthContext,
  conversationId: string,
  userMessage: string,
  onChunk: (chunkText: string) => void
) {
  const ai = getGenAIClient();
  const configuredModel = getActiveModel();
  const startTime = Date.now();

  const { systemInstruction, contents, runningSummary, recentCount } =
    await buildConversationContext(auth, conversationId, userMessage);

  const { result: responseStream, usedModel } = await callWithRetry(async (modelToUse, signal) => {
    return await ai.models.generateContentStream({
      model: modelToUse,
      contents,
      config: {
        systemInstruction,
        abortSignal: signal,
      },
    });
  }, configuredModel);

  let fullText = '';
  try {
    for await (const chunk of responseStream) {
      const text = chunk.text || '';
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
  } catch (streamErr) {
    throw classifyGeminiError(streamErr, usedModel);
  }

  const durationMs = Date.now() - startTime;
  return {
    text: fullText,
    model: usedModel,
    latencyMs: durationMs,
    runningSummary,
    recentCount,
    tokens: Math.round(fullText.length / 4),
  };
}
