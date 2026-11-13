import React from 'react';
import {
  Menu,
  Sparkles,
  Sun,
  Moon,
  Share2,
  RotateCcw,
  Trash2,
  ChevronDown,
  Cpu,
} from 'lucide-react';
import { NexoraLogo } from './NexoraLogo';
import { MemoryStatus } from '../types';
import { formatModelDisplayName } from '../utils/format';

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onOpenMemoryModal: () => void;
  onResetContext: () => void;
  onClearContext: () => void;
  onShare: () => void;
  activeModelName: string;
  theme: 'dark' | 'light' | 'system';
  onToggleTheme: () => void;
  memoryStatus: MemoryStatus | null;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleSidebar,
  onOpenSettings,
  onOpenMemoryModal,
  onResetContext,
  onClearContext,
  onShare,
  activeModelName,
  theme,
  onToggleTheme,
  memoryStatus,
}) => {
  const recentMsgs = memoryStatus?.recentMessagesCount || 0;
  const maxWindow = memoryStatus?.maxRecentWindow || 20;
  const hasSummary = memoryStatus?.hasRunningSummary || false;
  const activeTokens = memoryStatus?.activeContextTokens || 0;

  return (
    <header className="h-14 sm:h-16 px-2.5 sm:px-4 bg-[#0B0F19]/85 backdrop-blur-xl border-b border-white/5 flex items-center justify-between gap-1.5 sm:gap-2 select-none z-30 shrink-0 min-w-0">
      {/* Left: Hamburger & Compact Logo */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="shrink-0">
          <NexoraLogo size="sm" showBadge={false} />
        </div>
      </div>

      {/* Center: Compact Model Selector & Conversation Memory Status */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-x-auto py-1 no-scrollbar">
        {/* Model Pill */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 min-h-[34px] rounded-full bg-[#111827] hover:bg-[#1E293B] border border-white/10 text-[11px] sm:text-xs text-[#E2E8F0] transition-colors shrink-0 cursor-pointer max-w-[130px] sm:max-w-none"
          title="Click to view AI Model configuration"
        >
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#818CF8] shrink-0" />
          <span className="font-medium font-sans truncate">
            {formatModelDisplayName(activeModelName)}
          </span>
          <ChevronDown className="w-3 h-3 text-[#64748B] shrink-0 hidden sm:inline" />
        </button>

        {/* Conversation Memory Status Badge */}
        <button
          type="button"
          onClick={onOpenMemoryModal}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 min-h-[34px] rounded-full bg-[#111827] hover:bg-[#1E293B] border border-[#6366F1]/30 hover:border-[#6366F1]/60 text-[11px] sm:text-xs transition-all shrink-0 cursor-pointer group"
          title="Click to inspect Conversation Memory & Running Summary"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[#CBD5E1] hidden md:inline font-sans">
            Conversation Memory Active
          </span>
          <span className="font-mono text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-md bg-[#6366F1]/20 text-[#A5B4FC] border border-[#6366F1]/30">
            {hasSummary ? (
              <>
                <span className="sm:hidden">{recentMsgs}+sum</span>
                <span className="hidden sm:inline">{recentMsgs} msgs + running summary</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">{recentMsgs}/{maxWindow}</span>
                <span className="hidden sm:inline">{recentMsgs}/{maxWindow} msgs</span>
              </>
            )}
          </span>
        </button>

        {/* Token capacity pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827]/60 border border-white/5 text-[11px] font-mono text-[#94A3B8] shrink-0">
          <Cpu className="w-3 h-3 text-[#38BDF8]" />
          <span>{activeTokens.toLocaleString()} / 1M tk</span>
        </div>
      </div>

      {/* Right: Actions & Theme Switch */}
      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onShare}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Share conversation"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden xl:inline">Share</span>
        </button>

        <button
          type="button"
          onClick={onResetContext}
          className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Reset / refresh context memory"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onClearContext}
          className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          title="Clear all messages in active chat"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear context</span>
        </button>

        {/* Light / Dark Mode Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          )}
        </button>
      </div>
    </header>
  );
};
