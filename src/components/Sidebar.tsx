import React, { useState } from 'react';
import { Conversation } from '../types';
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
  isOpen: boolean;
  onClose: () => void;
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
  isOpen,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-72 bg-[#0E1524] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <NexoraLogo size="sm" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 lg:hidden cursor-pointer"
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
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#5558E6] hover:to-[#7C4EE4] text-white font-medium text-sm shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition-all active:scale-[0.98] cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Chat</span>
            </div>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-white/90">
              ⌘N
            </kbd>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-3.5 pb-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-[#111827] text-xs text-[#E2E8F0] placeholder-[#64748B] pl-9 pr-7 py-2 rounded-xl border border-white/5 focus:outline-none focus:border-[#6366F1]/50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 text-[#64748B] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          {conversations.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-[#64748B]">
              No conversations yet. Start a new chat to begin exploring with Nexora AI!
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-6 px-4 text-xs text-[#64748B]">
              No conversations matching &quot;{search}&quot;
            </div>
          ) : (
            Object.entries(groups).map(([groupTitle, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={groupTitle} className="space-y-1">
                  <span className="px-3 text-[10px] font-bold tracking-wider text-[#64748B] uppercase select-none">
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
                              ? 'bg-[#1F2937] text-white font-medium border border-white/10 shadow-xs'
                              : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#111827]'
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
                                className="w-full bg-[#111827] text-white text-xs px-2 py-1 rounded border border-[#6366F1] focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveRename(conv.id)}
                                className="p-1 text-emerald-400 hover:text-emerald-300"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 text-[#64748B] hover:text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <MessageSquare
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isActive ? 'text-[#818CF8]' : 'text-[#64748B]'
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
                                    className="p-1 text-[#818CF8] hover:text-white"
                                    title="Unpin"
                                  >
                                    <Pin className="w-3 h-3 fill-current" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => onTogglePin(conv.id, true)}
                                    className="p-1 text-[#64748B] hover:text-white"
                                    title="Pin conversation"
                                  >
                                    <Pin className="w-3 h-3" />
                                  </button>
                                )}

                                <button
                                  onClick={() => handleStartRename(conv)}
                                  className="p-1 text-[#64748B] hover:text-white"
                                  title="Rename"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>

                                <button
                                  onClick={() => setConfirmDeleteId(conv.id)}
                                  className="p-1 text-[#64748B] hover:text-red-400"
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
          <div className="p-3 mx-2 mb-2 rounded-xl bg-red-950/40 border border-red-500/30 text-xs">
            <p className="text-red-200 mb-2">Delete this conversation permanently?</p>
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
                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[#CBD5E1] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* User Profile Card & Quick Actions matching design */}
        <div className="p-3 border-t border-white/5 space-y-2">
          {/* User Card */}
          <div className="flex items-center gap-3 p-2 rounded-xl bg-[#111827] border border-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#EC4899] flex items-center justify-center font-display font-bold text-xs text-white shadow-xs">
              AM
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white truncate">Alex Morgan</span>
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-[#6366F1]/20 text-[#A5B4FC] border border-[#6366F1]/30">
                  Pro Tier
                </span>
              </div>
              <span className="text-[11px] text-[#64748B] block truncate">
                alex@workspace.ai
              </span>
            </div>
          </div>

          {/* Quick buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSettings}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#94A3B8] hover:text-white hover:bg-[#111827] transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
            <button
              onClick={onOpenHelp}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#94A3B8] hover:text-white hover:bg-[#111827] transition-colors cursor-pointer"
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
