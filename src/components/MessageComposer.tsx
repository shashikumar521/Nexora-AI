import React, { useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Loader2 } from 'lucide-react';

interface MessageComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
  sendOnEnter?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  input,
  setInput,
  onSend,
  isLoading,
  disabled = false,
  sendOnEnter = true,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 2048;

  // Auto-resize textarea height: single-line when empty, expands naturally on multi-line input
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!input) {
      el.style.height = 'auto';
      return;
    }
    el.style.height = 'auto';
    const maxHeight = window.innerWidth < 640 ? 132 : 180;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sendOnEnter && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim() && !disabled) {
        onSend();
      }
    }
  };

  const isSendDisabled = isLoading || !input.trim() || disabled;

  return (
    <div className="w-full max-w-3xl mx-auto px-2.5 sm:px-4 pb-2 sm:pb-4 pt-1.5 sm:pt-2 shrink-0">
      {/* Floating glassmorphic composer container */}
      <div className="relative rounded-2xl bg-[var(--nx-bg-input)] backdrop-blur-xl border border-[var(--nx-border-strong)] shadow-[var(--nx-composer-shadow)] transition-all focus-within:border-[var(--nx-accent)] focus-within:ring-2 focus-within:ring-[var(--nx-accent-soft)]">
        <div className="flex items-end gap-1.5 sm:gap-2 px-2.5 py-2 sm:p-3">
          {/* Attachment button */}
          <button
            type="button"
            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer shrink-0"
            title="Attach file or code context"
            aria-label="Attach file or code context"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Single-line when empty, auto-expanding multiline input */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            maxLength={MAX_CHARS}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'Nexora AI is responding...' : 'Message Nexora AI...'}
            className={`flex-1 min-w-0 bg-transparent text-[16px] sm:text-sm text-[var(--nx-text-heading)] placeholder-[var(--nx-text-subtle)] focus:outline-none resize-none py-1.5 leading-snug max-h-36 sm:max-h-44 font-sans ${
              isLoading ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            disabled={isLoading || disabled}
          />

          {/* Right side controls: character counter & submit button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="hidden sm:inline text-[10px] sm:text-[11px] font-mono text-[var(--nx-text-subtle)]">
              {input.length} / {MAX_CHARS}
            </span>

            <button
              type="button"
              onClick={onSend}
              disabled={isSendDisabled}
              aria-label="Send message"
              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] ${
                isSendDisabled
                  ? 'bg-[var(--nx-bg-surface-alt)] text-[var(--nx-text-subtle)] border border-[var(--nx-border-subtle)] cursor-not-allowed opacity-70'
                  : 'bg-gradient-to-r from-[var(--nx-accent)] to-[var(--nx-accent-end)] text-white shadow-[0_0_15px_rgba(118,87,246,0.45)] hover:opacity-90 active:scale-95 cursor-pointer'
              }`}
              title="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Footer caption (shown on sm+ to keep mobile composer compact) */}
      <div className="hidden sm:flex items-center justify-center gap-1.5 text-[11px] text-[var(--nx-text-subtle)] mt-2 font-sans select-none">
        <span className="w-4 h-4 rounded bg-[#0B1221] flex items-center justify-center overflow-hidden shrink-0 border border-[var(--nx-secondary-border)]">
          <img
            src="/brand/nexora-logo-icon.png"
            alt="Nexora AI"
            className="w-full h-full object-cover"
          />
        </span>
        <p>
          Nexora AI powered by Google Gemini API. Context window retains last 20 messages with adaptive summarization.
        </p>
      </div>
    </div>
  );
};
