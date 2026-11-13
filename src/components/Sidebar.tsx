import React, { useState, useRef, useEffect } from 'react';
import { Conversation } from '../types';
import { type AuthUser } from '../lib/firebase';
import { NexoraLogo } from './NexoraLogo';
import {
  Plus,
  Search,
  MessageSquare,
  Pin,
  Trash2,
  Edit2,
  Check,
  X,
  Settings,
  HelpCircle,
  SidebarClose,
  MoreVertical,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  user: AuthUser;
  onSignOut: () => void;
  isOpen: boolean;
  onClose: () => void;
  focusSearchTrigger?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onTogglePin,
  onOpenSettings,
  onOpenHelp,
  user,
  onSignOut,
  isOpen,
  onClose,
  focusSearchTrigger = 0,
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [user.photoURL]);

  const userInitials = (user.displayName || user.email || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'U';

  useEffect(() => {
    if (isOpen && focusSearchTrigger > 0) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, focusSearchTrigger]);

  // Filter conversations
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  // Group by date: Today, Yesterday, Previous 7 Days, Older
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const sevenDaysStart = todayStart - 7 * 86400000;

  const groups: { [key: string]: Conversation[] } = {
    'TODAY': [],
    'YESTERDAY': [],
    'PREVIOUS 7 DAYS': [],
    'OLDER': [],
  };

  filtered.forEach((conv) => {
    const time = new Date(conv.updated_at || conv.created_at).getTime();
    if (time >= todayStart) {
      groups['TODAY'].push(conv);
    } else if (time >= yesterdayStart) {
      groups['YESTERDAY'].push(conv);
    } else if (time >= sevenDaysStart) {
      groups['PREVIOUS 7 DAYS'].push(conv);
    } else {
      groups['OLDER'].push(conv);
    }
  });

  const handleStartRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setMenuOpenId(null);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[55] lg:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-[60] w-72 max-w-[85vw] bg-[var(--nx-bg-sidebar)] border-r border-[var(--nx-border-subtle)] flex flex-col pb-[env(safe-area-inset-bottom)] lg:pb-0 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--nx-border-subtle)]">
          <NexoraLogo size="sm" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] lg:hidden cursor-pointer"
            title="Close sidebar"
          >
            <SidebarClose className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button: + New Chat */}
        <div className="p-3.5">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--nx-accent)] to-[var(--nx-accent-end)] hover:opacity-95 text-white font-medium text-sm shadow-[0_4px_16px_rgba(118,87,246,0.35)] transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] focus-visible:ring-offset-2 cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Chat</span>
            </div>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-white/95">
              ⌘N
            </kbd>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-3.5 pb-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[var(--nx-text-subtle)] absolute left-3 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-[var(--nx-bg-surface-alt)] text-xs text-[var(--nx-text-heading)] placeholder-[var(--nx-text-muted)] pl-9 pr-7 py-2.5 sm:py-2 rounded-xl border border-[var(--nx-border-subtle)] focus:outline-none focus:border-[var(--nx-accent)] focus:ring-2 focus:ring-[var(--nx-accent-soft)] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 text-[var(--nx-text-subtle)] hover:text-[var(--nx-text-heading)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          {conversations.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-[var(--nx-text-muted)]">
              No conversations yet. Start a new chat to begin exploring with Nexora AI!
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-6 px-4 text-xs text-[var(--nx-text-muted)]">
              No conversations matching &quot;{search}&quot;
            </div>
          ) : (
            Object.entries(groups).map(([groupTitle, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={groupTitle} className="space-y-1">
                  <span className="px-3 text-[10px] font-bold tracking-wider text-[var(--nx-text-subtle)] uppercase select-none">
                    {groupTitle}
                  </span>
                  <div className="space-y-0.5 mt-1">
                    {items.map((conv) => {
                      const isActive = conv.id === activeId;
                      const isEditing = editingId === conv.id;

                      return (
                        <div
                          key={conv.id}
                          className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[var(--nx-bg-active-item)] text-[var(--nx-text-heading)] font-medium border border-[var(--nx-accent-border)] shadow-xs'
                              : 'text-[var(--nx-text-body)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)]'
                          }`}
                          onClick={() => {
                            if (!isEditing) {
                              onSelectConversation(conv.id);
                              if (window.innerWidth < 1024) onClose();
                            }
                          }}
                        >
                          {isEditing ? (
                            <div
                              className="flex items-center gap-1 w-full"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(conv.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                autoFocus
                                className="w-full bg-[var(--nx-bg-surface)] text-[var(--nx-text-heading)] text-xs px-2 py-1 rounded border border-[var(--nx-accent)] focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveRename(conv.id)}
                                className="p-1 text-[var(--nx-status-emerald)] hover:opacity-80 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 text-[var(--nx-text-subtle)] hover:text-[var(--nx-text-heading)] cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <MessageSquare
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isActive ? 'text-[var(--nx-accent-icon)]' : 'text-[var(--nx-text-subtle)]'
                                  }`}
                                />
                                <span className="truncate">{conv.title}</span>
                              </div>

                              {/* Hover / Active Actions */}
                              <div
                                className={`items-center gap-1 ${
                                  isActive || menuOpenId === conv.id
                                    ? 'flex'
                                    : 'hidden group-hover:flex'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {conv.pinned ? (
                                  <button
                                    onClick={() => onTogglePin(conv.id, false)}
                                    className="p-1 text-[var(--nx-accent-icon)] hover:text-[var(--nx-text-heading)] cursor-pointer"
                                    title="Unpin"
                                  >
                                    <Pin className="w-3 h-3 fill-current" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => onTogglePin(conv.id, true)}
                                    className="p-1 text-[var(--nx-text-subtle)] hover:text-[var(--nx-text-heading)] cursor-pointer"
                                    title="Pin conversation"
                                  >
                                    <Pin className="w-3 h-3" />
                                  </button>
                                )}

                                <button
                                  onClick={() => handleStartRename(conv)}
                                  className="p-1 text-[var(--nx-text-subtle)] hover:text-[var(--nx-text-heading)] cursor-pointer"
                                  title="Rename"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>

                                <button
                                  onClick={() => setConfirmDeleteId(conv.id)}
                                  className="p-1 text-[var(--nx-text-subtle)] hover:text-red-500 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="p-3 mx-2 mb-2 rounded-xl bg-[var(--nx-bg-error)] border border-[var(--nx-border-error)] text-xs">
            <p className="text-[var(--nx-text-error)] mb-2 font-medium">Delete this conversation permanently?</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onDeleteConversation(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-medium cursor-pointer"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-2.5 py-1 rounded bg-[var(--nx-bg-surface-alt)] hover:bg-[var(--nx-bg-surface-hover)] text-[var(--nx-text-primary)] border border-[var(--nx-border-subtle)] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* User Profile Card & Quick Actions matching design */}
        <div className="p-3 border-t border-[var(--nx-border-subtle)] space-y-2">
          {/* Authenticated Google User Card */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--nx-bg-surface-alt)] border border-[var(--nx-border-subtle)]">
            {user.photoURL && !avatarError ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User profile'}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-[var(--nx-accent-border)] shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--nx-accent)] to-[var(--nx-accent-end)] flex items-center justify-center font-display font-bold text-xs text-white shadow-xs shrink-0">
                {userInitials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-[var(--nx-text-heading)] block truncate">
                {user.displayName || 'Google User'}
              </span>
              <span className="text-[11px] text-[var(--nx-text-muted)] block truncate">
                {user.email || 'Authenticated Account'}
              </span>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-[var(--nx-text-muted)] hover:text-red-500 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSettings}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--nx-text-body)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
            <button
              onClick={onOpenHelp}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--nx-text-body)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Help & Feedback</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
