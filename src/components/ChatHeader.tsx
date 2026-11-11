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
  const hasSummary = memoryStatus?.hasRunningSummary || false;
  const activeTokens = memoryStatus?.activeContextTokens || 0;

  return (
    <header className="h-16 px-4 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between gap-2 select-none z-30 shrink-0">
      {/* Left: Mobile hamburger & Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <NexoraLogo size="sm" showBadge={false} />
        </div>
      </div>

      {/* Center: Model Selector & Conversation Memory Status */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar max-w-xl">
        {/* Model Pill */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111827] hover:bg-[#1E293B] border border-white/10 text-xs text-[#E2E8F0] transition-colors shrink-0 cursor-pointer"
          title="Click to view AI Model configuration"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#818CF8]" />
          <span className="font-medium font-sans">{activeModelName}</span>
          <ChevronDown className="w-3 h-3 text-[#64748B]" />
        </button>

        {/* Conversation Memory Status Badge */}
        <button
          onClick={onOpenMemoryModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111827] hover:bg-[#1E293B] border border-[#6366F1]/30 hover:border-[#6366F1]/60 text-xs transition-all shrink-0 cursor-pointer group"
          title="Click to inspect Conversation Memory & Running Summary"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[#CBD5E1] hidden md:inline font-sans">
            Conversation Memory Active
          </span>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#6366F1]/20 text-[#A5B4FC] border border-[#6366F1]/30">
            {hasSummary ? `${recentMsgs} msgs + running summary` : `${recentMsgs}/20 msgs`}
          </span>
        </button>

        {/* Token capacity pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111827]/60 border border-white/5 text-[11px] font-mono text-[#94A3B8] shrink-0">
          <Cpu className="w-3 h-3 text-[#38BDF8]" />
          <span>{activeTokens.toLocaleString()} / 1M tk</span>
        </div>
      </div>

      {/* Right: Actions & Theme Switch */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onShare}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Share conversation"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden xl:inline">Share</span>
        </button>

        <button
          onClick={onResetContext}
          className="p-2 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Reset / refresh context memory"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={onClearContext}
          className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          title="Clear all messages in active chat"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear context</span>
        </button>

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-[#94A3B8] hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer ml-1"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
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
