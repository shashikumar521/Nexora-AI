import React, { useState } from 'react';
import { Message } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { formatModelDisplayName } from '../utils/format';
import {
  Copy,
  Check,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ArrowUpRight,
  Square,
} from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  onStopStreaming?: () => void;
  onSuggestedPrompt?: (prompt: string) => void;
  suggestedPrompts?: string[];
  activeModelName?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isStreaming = false,
  onRegenerate,
  isRegenerating = false,
  onStopStreaming,
  onSuggestedPrompt,
  suggestedPrompts = [],
  activeModelName,
}) => {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);

  const isUser = message.role === 'user';
  const displayModel = formatModelDisplayName(message.model || activeModelName);

  const handleCopy = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(message.content)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => fallbackCopy(message.content));
    } else {
      fallbackCopy(message.content);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy response text', e);
    }
  };

  const formattedTime = new Date(message.created_at || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div className="flex flex-col items-end my-3 sm:my-4 max-w-3xl ml-auto w-full px-1 sm:px-2">
        <div className="flex items-center gap-2 mb-1.5 text-xs text-[#94A3B8]">
          <span className="font-medium text-[#CBD5E1]">You</span>
          <span>•</span>
          <span>{formattedTime}</span>
        </div>
        <div className="bg-[#1F2937] text-white px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl rounded-br-sm border border-white/10 shadow-md max-w-2xl break-words overflow-hidden w-auto">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant Message
  return (
    <div className="flex items-start gap-2.5 sm:gap-3.5 my-4 sm:my-6 max-w-3xl mr-auto w-full px-1 sm:px-2 min-w-0">
      {/* Nexora AI Avatar */}
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.35)] border border-white/20 mt-1">
        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
      </div>

      <div className="flex-1 overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="font-display font-semibold text-sm text-white">Nexora AI</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#6366F1]/15 text-[#A5B4FC] border border-[#6366F1]/30">
            {displayModel}
          </span>
          {isStreaming ? (
            <span className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
              Streaming thoughts...
            </span>
          ) : (
            <span className="text-xs text-[#64748B]">{formattedTime}</span>
          )}
        </div>

        {/* Message Content Body */}
        <div className="bg-transparent rounded-xl w-full max-w-full overflow-hidden">
          <MarkdownRenderer content={message.content} />

          {/* Typing/Streaming cursor if streaming */}
          {isStreaming && (
            <div className="flex items-center gap-2 mt-3 pt-2">
              <span className="inline-block w-2 h-4 bg-[#6366F1] animate-pulse rounded-sm" />
              <span className="text-xs text-[#94A3B8] font-mono">Generating response...</span>
            </div>
          )}
        </div>

        {/* Streaming Stop Button */}
        {isStreaming && onStopStreaming && (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onStopStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop generating</span>
              <kbd className="text-[10px] bg-red-950/60 px-1 py-0.5 rounded ml-1 border border-red-500/20">
                Esc
              </kbd>
            </button>
          </div>
        )}

        {/* Footer actions for completed message */}
        {!isStreaming && (
          <div className="flex items-center justify-between gap-2 sm:gap-3 mt-4 pt-3 border-t border-white/5 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLiked(liked === true ? null : true)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  liked === true
                    ? 'text-[#6366F1] bg-[#6366F1]/10'
                    : 'text-[#64748B] hover:text-white hover:bg-white/5'
                }`}
                title="Helpful response"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLiked(liked === false ? null : false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  liked === false
                    ? 'text-red-400 bg-red-500/10'
                    : 'text-[#64748B] hover:text-white hover:bg-white/5'
                }`}
                title="Not helpful"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-xs"
                title="Copy response to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-white/5 transition-colors cursor-pointer text-xs ${
                    isRegenerating ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="Regenerate response"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-[#818CF8]' : ''}`} />
                  <span className="hidden sm:inline">{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
                </button>
              )}
            </div>

            {/* Model Telemetry Pill */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-mono text-[#94A3B8] bg-[#111827] px-2.5 py-1 rounded-full border border-white/5 flex-wrap">
              <span className="flex items-center gap-1 text-[#818CF8]">
                <Sparkles className="w-3 h-3" />
                {displayModel}
              </span>
              <span>•</span>
              <span>{message.latencyMs ? `${message.latencyMs}ms` : '~420ms'}</span>
              <span>•</span>
              <span>{message.tokens || Math.round(message.content.length / 4)} tokens</span>
            </div>
          </div>
        )}

        {/* Suggested Follow-up Questions (Clickable) */}
        {!isStreaming && suggestedPrompts.length > 0 && onSuggestedPrompt && (
          <div className="mt-4 pt-2">
            <span className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider block mb-2">
              Suggested follow-ups
            </span>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSuggestedPrompt(prompt)}
                  className="flex items-center justify-between sm:justify-start gap-2 px-3 py-2 rounded-xl bg-[#111827] hover:bg-[#1E293B] border border-white/10 hover:border-[#6366F1]/50 text-xs text-[#CBD5E1] hover:text-white transition-all text-left cursor-pointer group active:scale-[0.99] shadow-xs"
                >
                  <span className="leading-snug">{prompt}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#818CF8] transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
