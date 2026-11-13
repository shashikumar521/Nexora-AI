import React from 'react';
import { MessageSquare, Search, History, Settings } from 'lucide-react';

interface MobileNavProps {
  activeView: 'chat' | 'search' | 'history' | 'settings';
  onSelectChat: () => void;
  onOpenSearch: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeView,
  onSelectChat,
  onOpenSearch,
  onOpenHistory,
  onOpenSettings,
}) => {
  return (
    <nav
      aria-label="Mobile navigation"
      className="sm:hidden fixed bottom-0 left-0 right-0 bg-[var(--nx-bg-header)] backdrop-blur-xl border-t border-[var(--nx-border-subtle)] z-50 pb-[env(safe-area-inset-bottom)] select-none"
    >
      <div className="h-14 flex items-center justify-around px-2">
        <button
          type="button"
          onClick={onSelectChat}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[60px] min-h-[44px] px-3 py-1 rounded-xl text-[11px] transition-colors cursor-pointer ${
            activeView === 'chat'
              ? 'text-[var(--nx-accent-text)] font-semibold bg-[var(--nx-accent-soft)]'
              : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>

        <button
          type="button"
          onClick={onOpenSearch}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[60px] min-h-[44px] px-3 py-1 rounded-xl text-[11px] transition-colors cursor-pointer ${
            activeView === 'search'
              ? 'text-[var(--nx-accent-text)] font-semibold bg-[var(--nx-accent-soft)]'
              : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)]'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Search</span>
        </button>

        <button
          type="button"
          onClick={onOpenHistory}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[60px] min-h-[44px] px-3 py-1 rounded-xl text-[11px] transition-colors cursor-pointer ${
            activeView === 'history'
              ? 'text-[var(--nx-accent-text)] font-semibold bg-[var(--nx-accent-soft)]'
              : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>History</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[60px] min-h-[44px] px-3 py-1 rounded-xl text-[11px] transition-colors cursor-pointer ${
            activeView === 'settings'
              ? 'text-[var(--nx-accent-text)] font-semibold bg-[var(--nx-accent-soft)]'
              : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
};
