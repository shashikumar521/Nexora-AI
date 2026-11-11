import React, { useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Loader2 } from 'lucide-react';

interface MessageComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  input,
  setInput,
  onSend,
  isLoading,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 2048;

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim() && !disabled) {
        onSend();
      }
    }
  };

  const isSendDisabled = isLoading || !input.trim() || disabled;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-2">
      {/* Floating glassmorphic composer container */}
      <div className="relative rounded-2xl bg-[#111827]/90 backdrop-blur-xl border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.4)] transition-all focus-within:border-[#6366F1]/50 focus-within:ring-2 focus-within:ring-[#6366F1]/20">
        <div className="flex items-end gap-2 p-3">
          {/* Attachment button */}
          <button
            type="button"
            className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            title="Attach file or code context"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Multiline auto-sizing input */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            maxLength={MAX_CHARS}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLoading
                ? 'Nexora AI is responding...'
                : 'Message Nexora AI... (Enter to send, Shift+Enter for new line)'
            }
            className={`flex-1 bg-transparent text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none resize-none py-1.5 max-h-40 leading-relaxed font-sans ${
              isLoading ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            disabled={isLoading || disabled}
          />

          {/* Right side controls: character counter & submit button */}
          <div className="flex items-center gap-2 shrink-0 pb-0.5">
            <span className="text-[11px] font-mono text-[#64748B]">
              {input.length} / {MAX_CHARS}
            </span>

            <button
              type="button"
              onClick={onSend}
              disabled={isSendDisabled}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                isSendDisabled
                  ? 'bg-white/5 text-[#64748B] cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] hover:opacity-90 active:scale-95 cursor-pointer'
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

      {/* Footer caption matching design */}
      <p className="text-[11px] text-center text-[#64748B] mt-2 font-sans select-none">
        Nexora AI powered by Google Gemini API. Context window retains last 25 messages with adaptive summarization.
      </p>
    </div>
  );
};
