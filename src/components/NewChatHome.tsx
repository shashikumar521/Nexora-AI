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
      {/* Luminous Neural Emblem */}
      <div className="relative mb-4 sm:mb-6">
        <div className="absolute inset-0 rounded-full bg-[#6366F1]/20 blur-2xl animate-pulse" />
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E1B4B] border border-[#6366F1]/40 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.35)]">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shadow-inner">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 sm:w-6 sm:h-6 text-white"
            >
              <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 3.46v2.08a4 4 0 0 0 1 2.65V18a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4v-2.81a4 4 0 0 0 1-2.65V10.46A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4z" />
              <path d="M12 7v5" />
              <path d="M9 10h6" />
              <path d="M9 15h6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Powered by Pill */}
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-1.5 rounded-2xl sm:rounded-full bg-[#1E293B]/80 border border-[#6366F1]/30 text-[11px] sm:text-xs text-[#CBD5E1] mb-4 sm:mb-5 shadow-sm max-w-full text-center">
        <span className="flex items-center gap-1 text-[#FBBF24]">
          <Zap className="w-3.5 h-3.5 fill-current shrink-0" />
          <span className="font-medium text-[#F8FAFC]">
            Powered by Google {formatModelDisplayName(activeModelName)}
          </span>
        </span>
        <span className="text-white/20 hidden sm:inline">•</span>
        <span className="text-[#94A3B8]">Real-time Multi-turn Context</span>
      </div>

      {/* Hero Headings */}
      <h1 className="font-display font-bold text-xl sm:text-3xl text-white text-center tracking-tight mb-1.5 sm:mb-2 px-1">
        What can I help you with today?
      </h1>
      <p className="text-xs sm:text-sm text-[#94A3B8] text-center mb-5 sm:mb-8 max-w-md px-2">
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
              className="flex items-start gap-3 sm:gap-3.5 p-3.5 sm:p-4 min-h-[68px] rounded-xl bg-[#111827]/75 hover:bg-[#1F2937]/80 border border-white/5 hover:border-[#6366F1]/40 transition-all text-left group cursor-pointer shadow-sm hover:shadow-md active:scale-[0.99] w-full min-w-0"
            >
              <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-[#1E293B] group-hover:bg-[#6366F1]/20 border border-white/10 group-hover:border-[#6366F1]/40 flex items-center justify-center shrink-0 transition-colors">
                <Icon className="w-4 h-4 text-[#818CF8]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-semibold text-sm text-[#F8FAFC] group-hover:text-white transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-[#94A3B8] line-clamp-2 mt-0.5 leading-relaxed break-words">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Modes */}
      <div className="flex items-center justify-center flex-wrap gap-2 mb-5 sm:mb-6 w-full">
        <span className="text-xs text-[#64748B] mr-0.5 w-full sm:w-auto text-center">Quick modes:</span>
        {quickModes.map((mode, idx) => {
          const Icon = mode.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(mode.prompt)}
              className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-full bg-[#111827] hover:bg-[#1E293B] border border-white/10 hover:border-[#6366F1]/30 text-xs text-[#CBD5E1] hover:text-white transition-all cursor-pointer active:scale-[0.98]"
            >
              <Icon className="w-3.5 h-3.5 text-[#818CF8] shrink-0" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Context Status Banner */}
      <div className="w-full p-3.5 rounded-xl bg-[#111827]/60 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse shrink-0 mt-1 sm:mt-0" />
          <span className="text-[#CBD5E1] leading-relaxed break-words">
            <strong className="text-white font-medium">Active Context:</strong> Conversation memory
            automatically retains up to 20 messages with progressive real-time summarization.
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1F2937] text-[11px] font-mono text-[#38BDF8] border border-white/5 shrink-0 self-end sm:self-center">
          <Cpu className="w-3 h-3" />
          <span>Ready</span>
        </div>
      </div>
    </div>
  );
};
