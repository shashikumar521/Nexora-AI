import React, { useState, useEffect } from 'react';
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
  LogOut,
} from 'lucide-react';
import { NexoraLogo } from './NexoraLogo';
import { MemoryStatus } from '../types';
import { type AuthUser } from '../lib/firebase';
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
  user: AuthUser;
  onSignOut: () => void;
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
  user,
  onSignOut,
}) => {
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user.photoURL]);

  const userInitials = (user.displayName || user.email || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'U';
  const recentMsgs = memoryStatus?.recentMessagesCount || 0;
  const maxWindow = memoryStatus?.maxRecentWindow || 20;
  const hasSummary = memoryStatus?.hasRunningSummary || false;
  const activeTokens = memoryStatus?.activeContextTokens || 0;

  return (
    <header className="h-14 sm:h-16 px-2.5 sm:px-4 bg-[var(--nx-bg-header)] backdrop-blur-xl border-b border-[var(--nx-border-subtle)] flex items-center justify-between gap-1.5 sm:gap-2 select-none z-30 shrink-0 min-w-0 transition-colors">
      {/* Left: Hamburger & Compact Logo */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer shrink-0"
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
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 min-h-[34px] rounded-full bg-[var(--nx-bg-pill)] hover:bg-[var(--nx-bg-surface-hover)] border border-[var(--nx-border-subtle)] text-[11px] sm:text-xs text-[var(--nx-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors shrink-0 cursor-pointer max-w-[130px] sm:max-w-none"
          title="Click to view AI Model configuration"
        >
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--nx-accent-icon)] shrink-0" />
          <span className="font-medium font-sans truncate">
            {formatModelDisplayName(activeModelName)}
          </span>
          <ChevronDown className="w-3 h-3 text-[var(--nx-text-subtle)] shrink-0 hidden sm:inline" />
        </button>

        {/* Conversation Memory Status Badge */}
        <button
          type="button"
          onClick={onOpenMemoryModal}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 min-h-[34px] rounded-full bg-[var(--nx-bg-pill)] hover:bg-[var(--nx-bg-surface-hover)] border border-[var(--nx-accent-border)] hover:border-[var(--nx-accent)] text-[11px] sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-all shrink-0 cursor-pointer group"
          title="Click to inspect Conversation Memory & Running Summary"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[var(--nx-text-body)] hidden md:inline font-sans">
            Conversation Memory Active
          </span>
          <span className="font-mono text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-md bg-[var(--nx-accent-soft)] text-[var(--nx-accent-text)] border border-[var(--nx-accent-border)]">
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
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--nx-bg-pill)] border border-[var(--nx-border-subtle)] text-[11px] font-mono text-[var(--nx-text-body)] shrink-0">
          <Cpu className="w-3 h-3 text-[var(--nx-secondary-text)]" />
          <span>{activeTokens.toLocaleString()} / 1M tk</span>
        </div>
      </div>

      {/* Right: Actions & Theme Switch */}
      <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onShare}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer"
          title="Share conversation"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden xl:inline">Share</span>
        </button>

        <button
          type="button"
          onClick={onResetContext}
          className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer"
          title="Reset / refresh context memory"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onClearContext}
          className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--nx-text-muted)] hover:text-red-500 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors cursor-pointer"
          title="Clear all messages in active chat"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear context</span>
        </button>

        {/* Light / Dark Mode Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-[var(--nx-accent-text)]" />
          )}
        </button>

        {/* User Avatar & Sign Out */}
        <div className="hidden sm:flex items-center gap-1 pl-1 ml-0.5 border-l border-[var(--nx-border-subtle)]">
          {user.photoURL && !avatarError ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User profile'}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              title={`${user.displayName || 'Google User'} (${user.email || ''})`}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-[var(--nx-accent-border)]"
            />
          ) : (
            <div
              title={`${user.displayName || 'Google User'} (${user.email || ''})`}
              className="w-7 h-7 rounded-full bg-gradient-to-tr from-[var(--nx-accent)] to-[var(--nx-accent-end)] flex items-center justify-center font-display font-bold text-[10px] text-white"
            >
              {userInitials}
            </div>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--nx-text-muted)] hover:text-red-500 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors cursor-pointer"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
