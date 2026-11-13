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
  const maxRecent = memoryStatus?.maxRecentWindow || 20;
  const totalCount = memoryStatus?.totalStoredMessages || 0;
  const hasSummary = memoryStatus?.hasRunningSummary || false;
  const summary = memoryStatus?.runningSummary || '';
  const activeTokens = memoryStatus?.activeContextTokens || 0;
  const tokenCapacity = memoryStatus?.tokenCapacity || 1000000;
  const percentUsed = Math.min(100, Math.max(0.1, (activeTokens / tokenCapacity) * 100));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-[var(--nx-bg-overlay)] backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[85dvh] flex flex-col bg-[var(--nx-bg-modal-alt)] border border-[var(--nx-border-subtle)] rounded-2xl shadow-2xl overflow-hidden text-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--nx-border-subtle)] bg-[var(--nx-bg-surface-alt)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--nx-accent-soft)] border border-[var(--nx-accent-border)] flex items-center justify-center text-[var(--nx-accent-icon)]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-[var(--nx-text-heading)] text-base">
                Conversation Memory Inspector
              </h3>
              <p className="text-xs text-[var(--nx-text-muted)]">
                Real-time multi-turn context retention & running summary
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close memory inspector"
            className="p-1.5 rounded-lg text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Strategy Card */}
          <div className="p-3.5 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] space-y-2 shadow-[var(--nx-card-shadow)]">
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="text-[var(--nx-text-muted)]">Context Architecture:</span>
              <span className="font-mono text-[var(--nx-secondary-text)] bg-[var(--nx-secondary-soft)] px-2 py-0.5 rounded border border-[var(--nx-secondary-border)]">
                Last {maxRecent} Messages + Running Summary
              </span>
            </div>
            <p className="text-xs text-[var(--nx-text-body)] leading-relaxed">
              Nexora AI maintains the most recent {maxRecent} conversational turns in full chronological detail.
              When messages exceed {maxRecent} turns, earlier turns are automatically consolidated into a cumulative
              running summary preserving user goals, code decisions, and context.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)]">
              <span className="text-[11px] text-[var(--nx-text-subtle)] block mb-1">Recent Buffer Window</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-bold text-lg text-[var(--nx-text-heading)]">
                  {recentCount}
                </span>
                <span className="text-xs text-[var(--nx-text-muted)]">/ {maxRecent} msgs</span>
              </div>
              <div className="w-full bg-[var(--nx-border-subtle)] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-[var(--nx-accent)] h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (recentCount / maxRecent) * 100)}%` }}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)]">
              <span className="text-[11px] text-[var(--nx-text-subtle)] block mb-1">Total Stored Messages</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-bold text-lg text-[var(--nx-text-heading)]">
                  {totalCount}
                </span>
                <span className="text-xs text-[var(--nx-text-muted)]">in PostgreSQL</span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--nx-status-emerald)]">
                <Database className="w-3 h-3" />
                <span>Isolated Per Conversation</span>
              </div>
            </div>
          </div>

          {/* Token Context Meter */}
          <div className="p-3 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="text-[var(--nx-text-muted)]">Active Ingested Tokens</span>
              <span className="font-mono text-[var(--nx-accent-text)]">
                {activeTokens.toLocaleString()} / 1,000,000 tk ({percentUsed.toFixed(2)}%)
              </span>
            </div>
            <div className="w-full bg-[var(--nx-border-subtle)] h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[var(--nx-accent)] to-[var(--nx-secondary)] h-full rounded-full transition-all"
                style={{ width: `${Math.max(1, percentUsed)}%` }}
              />
            </div>
          </div>

          {/* Running Summary View */}
          <div className="p-3.5 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--nx-accent-icon)]" />
                <span className="font-semibold text-xs text-[var(--nx-text-heading)]">
                  Active Running Summary
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  hasSummary
                    ? 'bg-emerald-500/15 text-[var(--nx-status-emerald)] border border-emerald-500/30'
                    : 'bg-[var(--nx-bg-pill)] text-[var(--nx-text-subtle)] border border-[var(--nx-border-subtle)]'
                }`}
              >
                {hasSummary ? 'Consolidated' : `Not Needed Yet (< ${maxRecent} msgs)`}
              </span>
            </div>

            {hasSummary ? (
              <div className="p-3 rounded-lg bg-[var(--nx-bg-surface-alt)] border border-[var(--nx-border-subtle)] text-xs text-[var(--nx-text-primary)] font-sans leading-relaxed whitespace-pre-wrap">
                {summary}
              </div>
            ) : (
              <p className="text-xs text-[var(--nx-text-subtle)] italic">
                All {totalCount} conversation message{totalCount === 1 ? '' : 's'} fit completely inside
                the high-fidelity {maxRecent}-message direct context buffer. When earlier messages age out,
                their facts, preferences, and technical conclusions will be summarized here.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-3.5 sm:p-4 border-t border-[var(--nx-border-subtle)] bg-[var(--nx-bg-surface-alt)] shrink-0">
          <button
            onClick={() => {
              onResetContext();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Context Memory</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[var(--nx-accent)] to-[var(--nx-accent-end)] hover:opacity-90 text-white text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
