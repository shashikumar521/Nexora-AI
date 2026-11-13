import React from 'react';
import {
  Lightbulb,
  PenTool,
  Code2,
  Compass,
  Cpu,
  Zap,
  Terminal,
  Network,
  Calculator,
  BookOpen,
} from 'lucide-react';

import { formatModelDisplayName } from '../utils/format';

interface NewChatHomeProps {
  onSelectPrompt: (promptText: string) => void;
  activeModelName?: string;
}

export const NewChatHome: React.FC<NewChatHomeProps> = ({ onSelectPrompt, activeModelName }) => {
  const suggestions = [
    {
      title: 'Learn Something',
      description: 'Explain complex topics in simple language (e.g., Quantum Computing or Epigenetics).',
      prompt: 'Explain Quantum Computing in simple terms using intuitive real-world analogies.',
      icon: Lightbulb,
    },
    {
      title: 'Write & Create',
      description: 'Draft content, refine documentation, and brainstorm product concepts.',
      prompt: 'Draft an engaging executive summary for a high-performance modern web framework.',
      icon: PenTool,
    },
    {
      title: 'Code & Debug',
      description: 'Write clean code, diagnose edge-case errors, and optimize algorithms.',
      prompt:
        'Can you explain how Quantum Superposition and Quantum Entanglement work, and provide a short Python snippet simulating a basic Bell State using Qiskit?',
      icon: Code2,
    },
    {
      title: 'Explore Ideas',
      description: 'Brainstorm tech architecture, research market dynamics, and build prototypes.',
      prompt: 'Compare Microservices vs Modular Monolith architectures for a high-throughput SaaS application.',
      icon: Compass,
    },
  ];

  const quickModes = [
    { label: 'Python & TypeScript', icon: Terminal, prompt: 'Show me an idiomatic TypeScript type guard pattern with example usage.' },
    { label: 'System Architecture', icon: Network, prompt: 'Explain the CQRS pattern with Event Sourcing trade-offs.' },
    { label: 'Math & Reasoning', icon: Calculator, prompt: 'Walk me step-by-step through solving Bayes Theorem with a medical diagnostic test.' },
    { label: 'Creative Writing', icon: BookOpen, prompt: 'Write an evocative introductory scene about a rogue satellite discovering a deep space signal.' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-start sm:justify-center w-full max-w-3xl mx-auto px-2.5 sm:px-4 py-4 sm:py-8 select-none min-w-0">
      {/* Official Nexora AI Brand Emblem (Logo 1) */}
      <div className="relative mb-4 sm:mb-5">
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[#38BDF8]/20 via-[#6366F1]/20 to-[#8B5CF6]/20 blur-2xl animate-pulse" />
        <div className="relative w-36 sm:w-44 rounded-2xl overflow-hidden bg-[#0B1221] border border-[#38BDF8]/30 shadow-[0_0_32px_rgba(56,189,248,0.24)]">
          <img
            src="/brand/nexora-logo-full.png"
            alt="Nexora AI"
            className="w-full h-auto block object-contain"
          />
        </div>
      </div>

      {/* Powered by Pill with Assistant Mascot (Logo 2) */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-1.5 rounded-2xl sm:rounded-full bg-[var(--nx-bg-surface)] border border-[var(--nx-accent-border)] text-[11px] sm:text-xs text-[var(--nx-text-body)] mb-4 sm:mb-5 shadow-[var(--nx-card-shadow)] max-w-full text-center">
        <img
          src="/brand/nexora-assistant-avatar.png"
          alt="Nexora AI Assistant"
          className="w-5 h-5 rounded-full object-cover ring-1 ring-[#38BDF8]/40 bg-[#0B1221] shrink-0"
        />
        <span className="flex items-center gap-1 text-[var(--nx-status-amber)]">
          <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
          <span className="font-medium text-[var(--nx-text-heading)]">
            Powered by Google {formatModelDisplayName(activeModelName)}
          </span>
        </span>
        <span className="text-[var(--nx-border-strong)] hidden sm:inline">•</span>
        <span className="text-[var(--nx-text-muted)]">Real-time Multi-turn Context</span>
      </div>

      {/* Hero Headings */}
      <h1 className="font-display font-bold text-xl sm:text-3xl text-[var(--nx-text-heading)] text-center tracking-tight mb-1.5 sm:mb-2 px-1">
        What can I help you with today?
      </h1>
      <p className="text-xs sm:text-sm text-[var(--nx-text-body)] text-center mb-5 sm:mb-8 max-w-md px-2">
        Ask anything. Explore ideas. Learn something new.
      </p>

      {/* 4 Suggestion Cards: Single-column on mobile, 2x2 grid on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 w-full mb-5 sm:mb-6">
        {suggestions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="flex items-start gap-3 sm:gap-3.5 p-3.5 sm:p-4 min-h-[68px] rounded-xl bg-[var(--nx-bg-surface-soft)] hover:bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] hover:border-[var(--nx-accent-border)] shadow-[var(--nx-card-shadow)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-all text-left group cursor-pointer active:scale-[0.99] w-full min-w-0"
            >
              <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[var(--nx-bg-surface-alt)] group-hover:bg-[var(--nx-accent-soft)] border border-[var(--nx-border-subtle)] group-hover:border-[var(--nx-accent-border)] flex items-center justify-center shrink-0 transition-colors">
                <Icon className="w-4 h-4 text-[var(--nx-accent-icon)]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-semibold text-sm text-[var(--nx-text-heading-alt)] group-hover:text-[var(--nx-text-heading)] transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-[var(--nx-text-body)] line-clamp-2 mt-0.5 leading-relaxed break-words">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Modes */}
      <div className="flex items-center justify-center flex-wrap gap-2 mb-5 sm:mb-6 w-full">
        <span className="text-xs text-[var(--nx-text-subtle)] mr-0.5 w-full sm:w-auto text-center">Quick modes:</span>
        {quickModes.map((mode, idx) => {
          const Icon = mode.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(mode.prompt)}
              className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-full bg-[var(--nx-bg-surface)] hover:bg-[var(--nx-bg-surface-alt)] border border-[var(--nx-border-subtle)] hover:border-[var(--nx-accent-border)] shadow-xs text-xs text-[var(--nx-text-body)] hover:text-[var(--nx-text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-all cursor-pointer active:scale-[0.98]"
            >
              <Icon className="w-3.5 h-3.5 text-[var(--nx-accent-icon)] shrink-0" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Context Status Banner */}
      <div className="w-full p-3.5 rounded-xl bg-[var(--nx-bg-surface-soft)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[var(--nx-secondary)] animate-pulse shrink-0 mt-1 sm:mt-0" />
          <span className="text-[var(--nx-text-body)] leading-relaxed break-words">
            <strong className="text-[var(--nx-text-heading)] font-medium">Active Context:</strong> Conversation memory
            automatically retains up to 20 messages with progressive real-time summarization.
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--nx-bg-pill)] text-[11px] font-mono text-[var(--nx-secondary-text)] border border-[var(--nx-secondary-border)] shrink-0 self-end sm:self-center">
          <Cpu className="w-3 h-3" />
          <span>Ready</span>
        </div>
      </div>
    </div>
  );
};
