import React from 'react';
import { MemoryStatus } from '../types';
import { Cpu, X, CheckCircle2, RotateCcw, ShieldCheck, Database } from 'lucide-react';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoryStatus: MemoryStatus | null;
  onResetContext: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  memoryStatus,
  onResetContext,
}) => {
  if (!isOpen) return null;

  const recentCount = memoryStatus?.recentMessagesCount || 0;
  const maxRecent = memoryStatus?.maxRecentWindow || 25;
  const totalCount = memoryStatus?.totalStoredMessages || 0;
  const hasSummary = memoryStatus?.hasRunningSummary || false;
  const summary = memoryStatus?.runningSummary || '';
  const activeTokens = memoryStatus?.activeContextTokens || 0;
  const tokenCapacity = memoryStatus?.tokenCapacity || 1000000;
  const percentUsed = Math.min(100, Math.max(0.1, (activeTokens / tokenCapacity) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#1E293B]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/30 flex items-center justify-center text-[#818CF8]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white text-base">
                Conversation Memory Inspector
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Real-time multi-turn context retention & running summary
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Strategy Card */}
          <div className="p-3.5 rounded-xl bg-[#1E293B]/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Context Architecture:</span>
              <span className="font-mono text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded border border-[#38BDF8]/20">
                Last {maxRecent} Messages + Running Summary
              </span>
            </div>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              Nexora AI maintains the most recent {maxRecent} conversational turns in full chronological detail.
              When messages exceed {maxRecent} turns, earlier turns are automatically consolidated into a cumulative
              running summary preserving user goals, code decisions, and context.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#111827] border border-white/5">
              <span className="text-[11px] text-[#64748B] block mb-1">Recent Buffer Window</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-bold text-lg text-white">
                  {recentCount}
                </span>
                <span className="text-xs text-[#94A3B8]">/ {maxRecent} msgs</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[#6366F1] h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (recentCount / maxRecent) * 100)}%` }}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#111827] border border-white/5">
              <span className="text-[11px] text-[#64748B] block mb-1">Total Stored Messages</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-bold text-lg text-white">
                  {totalCount}
                </span>
                <span className="text-xs text-[#94A3B8]">in SQLite DB</span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-400">
                <Database className="w-3 h-3" />
                <span>Isolated Per Conversation</span>
              </div>
            </div>
          </div>

          {/* Token Context Meter */}
          <div className="p-3 rounded-xl bg-[#111827] border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Active Ingested Tokens</span>
              <span className="font-mono text-[#A5B4FC]">
                {activeTokens.toLocaleString()} / 1,000,000 tk ({percentUsed.toFixed(2)}%)
              </span>
            </div>
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#6366F1] to-[#38BDF8] h-full rounded-full transition-all"
                style={{ width: `${Math.max(1, percentUsed)}%` }}
              />
            </div>
          </div>

          {/* Running Summary View */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#818CF8]" />
                <span className="font-semibold text-xs text-white">
                  Active Running Summary
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  hasSummary
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/5 text-[#64748B]'
                }`}
              >
                {hasSummary ? 'Consolidated' : `Not Needed Yet (< ${maxRecent} msgs)`}
              </span>
            </div>

            {hasSummary ? (
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-[#E2E8F0] font-sans leading-relaxed whitespace-pre-wrap">
                {summary}
              </div>
            ) : (
              <p className="text-xs text-[#64748B] italic">
                All {totalCount} conversation message{totalCount === 1 ? '' : 's'} fit completely inside
                the high-fidelity {maxRecent}-message direct context buffer. When earlier messages age out,
                their facts, preferences, and technical conclusions will be summarized here.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 bg-[#1E293B]/40">
          <button
            onClick={() => {
              onResetContext();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Context Memory</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:opacity-90 text-white text-xs font-medium cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
