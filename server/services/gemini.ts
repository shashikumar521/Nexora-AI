import { GoogleGenAI } from '@google/genai';
import { NEXORA_SYSTEM_PROMPT } from '../prompts/systemPrompt.ts';
import { conversationQueries, messageQueries } from '../db/database.ts';

export const RECENT_MESSAGE_WINDOW = 20;

export const DEPRECATED_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-thinking',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-image',
];

// Model configuration: use GEMINI_MODEL env var or default to supported 'gemini-3.1-flash-lite'
export const getActiveModel = (): string => {
  const model = process.env.GEMINI_MODEL?.trim();
  if (model && !DEPRECATED_MODELS.includes(model)) {
    return model;
  }
  return 'gemini-3.1-flash-lite';
};

const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend environment.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

/**
 * Summarizes older messages when conversation history exceeds the 20-message window
 */
export async function updateRunningSummaryIfNeeded(conversationId: string): Promise<string> {
  const conv = await conversationQueries.getById(conversationId);
  if (!conv) return '';

  const totalCount = await messageQueries.getCountByConversation(conversationId);
  if (totalCount <= RECENT_MESSAGE_WINDOW) {
    return conv.running_summary || '';
  }

  // Get older messages that fall outside the 20 most recent
  const olderMessages = await messageQueries.getOlderMessages(conversationId, RECENT_MESSAGE_WINDOW);
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

    const { result: summaryResponse } = await callWithRetry(async (modelToUse) => {
      return await ai.models.generateContent({
        model: modelToUse,
        contents: summaryPrompt,
        config: {
          systemInstruction: 'You summarize conversational memory accurately and concisely for assistant context.',
        },
      });
    }, getActiveModel());

    const newSummary = summaryResponse.text?.trim() || conv.running_summary || '';
    if (newSummary) {
      await conversationQueries.update(conversationId, { running_summary: newSummary });
      return newSummary;
    }
  } catch (error) {
    console.error('Failed to update running summary:', error);
    // Return existing summary as fallback without breaking chat
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
    const { result: response } = await callWithRetry(async (modelToUse) => {
      return await ai.models.generateContent({
        model: modelToUse,
        contents: `Create a brief, clean title (maximum 4-6 words, no quotes, no markdown) summarizing this user inquiry:\n\n"${userMessage}"`,
        config: {
          systemInstruction: 'Return only the brief title text, nothing else.',
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
export async function buildConversationContext(conversationId: string, newUserMessage?: string) {
  // 1. Check & update running summary if needed
  const runningSummary = await updateRunningSummaryIfNeeded(conversationId);

  // 2. Build system instruction with running summary
  let systemInstruction = NEXORA_SYSTEM_PROMPT;
  if (runningSummary && runningSummary.trim()) {
    systemInstruction += `\n\n[CONVERSATION RUNNING SUMMARY OF EARLIER TURNS]\n${runningSummary}\n[END RUNNING SUMMARY]`;
  }

  // 3. Retrieve up to 20 most recent messages in chronological order
  const recentMessages = await messageQueries.getRecentMessages(conversationId, RECENT_MESSAGE_WINDOW);

  // 4. Map DB messages to Gemini Content objects with strict role alternation
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  let lastRole: 'user' | 'model' | null = null;

  for (const msg of recentMessages) {
    const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user';
    if (role === lastRole && contents.length > 0) {
      // Merge consecutive same-role messages
      contents[contents.length - 1].parts[0].text += '\n\n' + msg.content;
    } else {
      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
      lastRole = role;
    }
  }

  // If newUserMessage is passed and wasn't already in DB:
  if (newUserMessage && (contents.length === 0 || contents[contents.length - 1].parts[0].text !== newUserMessage)) {
    if (lastRole === 'user' && contents.length > 0) {
      contents[contents.length - 1].parts[0].text += '\n\n' + newUserMessage;
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: newUserMessage }],
      });
    }
  }

  // Ensure first message starts with 'user'
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  // Fallback if empty
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
 * Helper to call Gemini with retry and fallback models on 503 high demand spikes
 */
async function callWithRetry<T>(
  action: (modelName: string) => Promise<T>,
  primaryModel: string
): Promise<{ result: T; usedModel: string }> {
  const candidateModels = [
    primaryModel,
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
  ]
    .filter((m) => !DEPRECATED_MODELS.includes(m))
    .filter((v, i, a) => a.indexOf(v) === i);

  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini] Calling model ${model} (attempt ${attempt})...`);

        // 20s timeout promise
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout calling Gemini model ${model}`)), 20000)
        );

        const result = await Promise.race([action(model), timeoutPromise]);
        console.log(`[Gemini] Successfully generated response from ${model}!`);
        return { result, usedModel: model };
      } catch (err: any) {
        lastError = err;

        const isNotFound =
          err?.status === 404 ||
          err?.code === 404 ||
          err?.message?.includes('404') ||
          err?.message?.includes('NOT_FOUND') ||
          err?.message?.includes('no longer available') ||
          err?.message?.includes('not found');

        if (isNotFound) {
          console.warn(`[Gemini] Model ${model} is not found or unsupported (404), falling back to alternative active model...`);
          // Do not retry this model - immediately switch to next candidate!
          break;
        }

        const isQuotaExhausted =
          err?.status === 429 ||
          err?.code === 429 ||
          err?.message?.includes('429') ||
          err?.message?.includes('RESOURCE_EXHAUSTED') ||
          err?.message?.includes('Quota exceeded') ||
          err?.message?.includes('quota');

        if (isQuotaExhausted) {
          console.warn(`[Gemini] Quota limit reached for ${model}, immediately falling back to next available model...`);
          // Do not retry the same exhausted model - switch to next candidate model immediately!
          break;
        }

        console.warn(`[Gemini] Call to ${model} failed (attempt ${attempt}):`, err?.message || err);

        const isUnavailable =
          err?.status === 503 ||
          err?.code === 503 ||
          err?.message?.includes('503') ||
          err?.message?.includes('high demand') ||
          err?.message?.includes('UNAVAILABLE') ||
          err?.message?.includes('Timeout');

        if (isUnavailable) {
          // Wait 600ms before next attempt
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }

        // If other error, break to next candidate model
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Generate a complete response (non-streaming)
 */
export async function generateChatResponse(conversationId: string, userMessage: string) {
  const ai = getGenAIClient();
  const configuredModel = getActiveModel();
  const startTime = Date.now();

  const { systemInstruction, contents, runningSummary, recentCount } =
    await buildConversationContext(conversationId, userMessage);

  const { result: response, usedModel } = await callWithRetry(async (modelToUse) => {
    return await ai.models.generateContent({
      model: modelToUse,
      contents,
      config: {
        systemInstruction,
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
  conversationId: string,
  userMessage: string,
  onChunk: (chunkText: string) => void
) {
  const ai = getGenAIClient();
  const configuredModel = getActiveModel();
  const startTime = Date.now();

  const { systemInstruction, contents, runningSummary, recentCount } =
    await buildConversationContext(conversationId, userMessage);

  const { result: responseStream, usedModel } = await callWithRetry(async (modelToUse) => {
    return await ai.models.generateContentStream({
      model: modelToUse,
      contents,
      config: {
        systemInstruction,
      },
    });
  }, configuredModel);

  let fullText = '';
  for await (const chunk of responseStream) {
    const text = chunk.text || '';
    if (text) {
      fullText += text;
      onChunk(text);
    }
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
