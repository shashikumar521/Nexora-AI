import React from 'react';
import { MessageSquare, Search, History, Settings } from 'lucide-react';

interface MobileNavProps {
  activeView: 'chat' | 'settings';
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
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0B0F19]/95 backdrop-blur-xl border-t border-white/10 z-40 flex items-center justify-around px-2 select-none">
      <button
        onClick={onSelectChat}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] transition-colors cursor-pointer ${
          activeView === 'chat' ? 'text-[#818CF8] font-medium' : 'text-[#64748B] hover:text-white'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        <span>Chat</span>
      </button>

      <button
        onClick={onOpenSearch}
        className="flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] text-[#64748B] hover:text-white transition-colors cursor-pointer"
      >
        <Search className="w-4 h-4" />
        <span>Search</span>
      </button>

      <button
        onClick={onOpenHistory}
        className="flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] text-[#64748B] hover:text-white transition-colors cursor-pointer"
      >
        <History className="w-4 h-4" />
        <span>History</span>
      </button>

      <button
        onClick={onOpenSettings}
        className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] transition-colors cursor-pointer ${
          activeView === 'settings' ? 'text-[#818CF8] font-medium' : 'text-[#64748B] hover:text-white'
        }`}
      >
        <Settings className="w-4 h-4" />
        <span>Settings</span>
      </button>
    </nav>
  );
};
