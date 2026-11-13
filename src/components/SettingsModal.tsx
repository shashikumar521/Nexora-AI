import React, { useState, useEffect } from 'react';
import { AppSettings, MemoryStatus } from '../types';
import {
  X,
  Sliders,
  Sparkles,
  Cpu,
  Shield,
  Info,
  Check,
  Sun,
  Moon,
  Laptop,
  Database,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { formatModelDisplayName } from '../utils/format';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  memoryStatus: MemoryStatus | null;
  onClearCurrentChat: () => void;
  onClearAllData: () => void;
  onExportTranscripts: (format: 'json' | 'markdown') => void;
  activeModelName: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  memoryStatus,
  onClearCurrentChat,
  onClearAllData,
  onExportTranscripts,
  activeModelName,
}) => {
  const [activeTab, setActiveTab] = useState<
    'general' | 'model' | 'memory' | 'privacy' | 'about'
  >('general');

  // Form states
  const [theme, setTheme] = useState(settings.theme);
  const [typographyScale, setTypographyScale] = useState(settings.typographyScale);
  const [sendOnEnter, setSendOnEnter] = useState(settings.sendOnEnter);
  const [streamResponses, setStreamResponses] = useState(settings.streamResponses);
  const [showSyntaxHighlighting, setShowSyntaxHighlighting] = useState(
    settings.showSyntaxHighlighting
  );
  const [language, setLanguage] = useState(settings.language || 'en-US');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync local form state when modal opens or persisted settings update
  useEffect(() => {
    if (isOpen) {
      setTheme(settings.theme);
      setTypographyScale(settings.typographyScale);
      setSendOnEnter(settings.sendOnEnter);
      setStreamResponses(settings.streamResponses);
      setShowSyntaxHighlighting(settings.showSyntaxHighlighting);
      setLanguage(settings.language || 'en-US');
      setSaveError(null);
      setSavedSuccess(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSavedSuccess(false);

    try {
      await onSaveSettings({
        theme,
        typographyScale,
        sendOnEnter,
        streamResponses,
        showSyntaxHighlighting,
        language,
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save settings. Please try again.');
      setSavedSuccess(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    setTheme('dark');
    setTypographyScale('14px');
    setSendOnEnter(true);
    setStreamResponses(true);
    setShowSyntaxHighlighting(true);
    setLanguage('en-US');
    setSaveError(null);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'model', label: 'AI Model & Engine', icon: Sparkles },
    { id: 'memory', label: 'Conversation Memory', icon: Cpu },
    { id: 'privacy', label: 'Data & Privacy', icon: Shield },
    { id: 'about', label: 'About Nexora', icon: Info },
  ];

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] sm:inset-0 z-40 sm:z-50 flex items-center justify-center sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:h-auto sm:max-w-4xl bg-[#0B0F19] sm:border sm:border-white/10 sm:rounded-2xl shadow-2xl flex flex-col sm:max-h-[90vh] overflow-hidden">
        {/* Top Header Bar matching Stitch AI */}
        <div className="px-3.5 sm:px-6 py-3 sm:py-4 bg-[#111827] border-b border-white/5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Sliders className="w-4 h-4 text-[#818CF8] shrink-0" />
              <span className="font-display sm:font-mono font-semibold sm:font-normal text-sm sm:text-xs text-white sm:text-[#94A3B8] sm:tracking-wider sm:uppercase truncate">
                <span className="sm:hidden">Workspace Settings</span>
                <span className="hidden sm:inline">SYSTEM CONFIGURATION</span>
              </span>
              <span className="hidden sm:inline text-white/20">/</span>
              <span className="hidden sm:inline font-sans font-medium text-xs text-white truncate">
                Preferences & AI Engine
              </span>
            </div>

            <div className="hidden md:flex items-center gap-3 pl-3 border-l border-white/10 text-[11px] font-mono text-[#94A3B8]">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Cloud Sync: Ready
              </span>
              <span className="flex items-center gap-1 text-[#64748B]">
                <Database className="w-3 h-3" />
                PostgreSQL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRevert}
              disabled={isSaving}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
            >
              Revert Defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 min-h-[36px] rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:opacity-90 text-white text-xs font-medium shadow-[0_0_15px_rgba(99,102,241,0.4)] cursor-pointer disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline Error Banner inside Settings */}
        {saveError && (
          <div className="mx-3.5 sm:mx-6 mt-3 p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="break-words">{saveError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="text-red-300 hover:text-white text-xs px-2 py-1 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation Pills */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-[#0E1524] border-b border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#1F2937] text-white shadow-xs border border-white/10'
                    : 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-white/5'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? 'text-[#818CF8]' : 'text-[#64748B]'}`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-5 sm:space-y-6 min-w-0">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-5 sm:space-y-6 max-w-3xl">
              {/* Interface Appearance */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-white">
                      Interface Appearance
                    </h3>
                    <p className="text-xs text-[#94A3B8]">
                      Choose your visual aesthetic and display calibration across workspace canvases.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#6366F1]/10 text-[#818CF8] border border-[#6366F1]/20 shrink-0">
                    {theme === 'dark' ? 'Dark Mode Active' : theme === 'light' ? 'Light Mode Active' : 'System Sync'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Light Mode Card */}
                  <div
                    onClick={() => setTheme('light')}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'border-[#6366F1] bg-[#1E293B]/80 shadow-[0_0_15px_rgba(99,102,241,0.2)] ring-1 ring-[#6366F1]'
                        : 'border-white/5 bg-[#111827]/70 hover:border-white/20'
                    }`}
                  >
                    <div className="h-14 sm:h-16 rounded-lg bg-gradient-to-r from-[#F8FAFF] to-[#E9EDFF] flex items-center justify-center mb-3 border border-white/20">
                      <Sun className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-white">Light Mode</span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          theme === 'light'
                            ? 'border-[#6366F1] bg-[#6366F1]'
                            : 'border-[#64748B]'
                        }`}
                      >
                        {theme === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                      High-contrast daytime canvas with luminous pastel glass accents.
                    </p>
                  </div>

                  {/* Nexora Dark Card */}
                  <div
                    onClick={() => setTheme('dark')}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'border-[#6366F1] bg-[#1E293B]/80 shadow-[0_0_15px_rgba(99,102,241,0.2)] ring-1 ring-[#6366F1]'
                        : 'border-white/5 bg-[#111827]/70 hover:border-white/20'
                    }`}
                  >
                    <div className="h-14 sm:h-16 rounded-lg bg-[#0B0F19] flex items-center justify-center mb-3 border border-[#6366F1]/30 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#6366F1]/10 to-transparent" />
                      <Moon className="w-6 h-6 text-[#818CF8]" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white">Nexora Dark</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#6366F1]/20 text-[#A5B4FC]">
                          ACTIVE
                        </span>
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          theme === 'dark'
                            ? 'border-[#6366F1] bg-[#6366F1]'
                            : 'border-[#64748B]'
                        }`}
                      >
                        {theme === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                      Deep obsidian (#0B0F19) with subtle violet glow and slate syntax.
                    </p>
                  </div>

                  {/* System Synchronized Card */}
                  <div
                    onClick={() => setTheme('system')}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                      theme === 'system'
                        ? 'border-[#6366F1] bg-[#1E293B]/80 shadow-[0_0_15px_rgba(99,102,241,0.2)] ring-1 ring-[#6366F1]'
                        : 'border-white/5 bg-[#111827]/70 hover:border-white/20'
                    }`}
                  >
                    <div className="h-14 sm:h-16 rounded-lg bg-gradient-to-br from-[#1E293B] to-[#0F172A] flex items-center justify-center mb-3 border border-white/10">
                      <Laptop className="w-6 h-6 text-[#94A3B8]" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-white">System Synchronized</span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          theme === 'system'
                            ? 'border-[#6366F1] bg-[#6366F1]'
                            : 'border-[#64748B]'
                        }`}
                      >
                        {theme === 'system' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                      Dynamically tracks your operating system dark/light theme preference.
                    </p>
                  </div>
                </div>
              </div>

              {/* Language & Regional Localization */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#111827] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-semibold text-xs text-white">
                    Language & Regional Localization
                  </h4>
                  <p className="text-xs text-[#94A3B8]">
                    Controls interface prompt guidance, error taxonomy, and automated formatting.
                  </p>
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-[#1F2937] text-xs text-white px-3 py-2 sm:py-1.5 min-h-[38px] rounded-lg border border-white/10 focus:outline-none focus:border-[#6366F1] w-full sm:w-auto shrink-0"
                >
                  <option value="en-US">English (United States) — Default</option>
                  <option value="en-GB">English (United Kingdom)</option>
                  <option value="es-ES">Spanish (Español)</option>
                  <option value="fr-FR">French (Français)</option>
                  <option value="de-DE">German (Deutsch)</option>
                  <option value="ja-JP">Japanese (日本語)</option>
                </select>
              </div>

              {/* Typography Scale */}
              <div>
                <h4 className="font-semibold text-xs text-white mb-2">Transcript Typography Scale</h4>
                <div className="grid grid-cols-3 gap-2">
                  {(['12px', '14px', '16px'] as const).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setTypographyScale(scale)}
                      className={`py-2.5 sm:py-2 px-2 sm:px-3 min-h-[42px] rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        typographyScale === scale
                          ? 'border-[#6366F1] bg-[#6366F1]/10 text-white shadow-xs'
                          : 'border-white/5 bg-[#111827] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {scale === '12px'
                        ? '12px Compact'
                        : scale === '14px'
                        ? '14px Default'
                        : '16px Comfortable'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Composition Switches */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111827] border border-white/5">
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-white block">
                      Send Message on Enter <kbd className="text-[10px] bg-white/10 px-1 py-0.5 rounded text-[#94A3B8]">↵ Return</kbd>
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      Pressing Return sends prompt instantly. Shift + Return enters a multi-line carriage return.
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle Send Message on Enter"
                    onClick={() => setSendOnEnter(!sendOnEnter)}
                    className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer shrink-0 ${
                      sendOnEnter ? 'bg-[#6366F1]' : 'bg-[#1F2937]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        sendOnEnter ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111827] border border-white/5">
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-white block">
                      Stream AI Responses in Real-time (SSE)
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      Receive tokens via chunked Server-Sent Events for fluid progressive rendering.
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle Stream AI Responses"
                    onClick={() => setStreamResponses(!streamResponses)}
                    className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer shrink-0 ${
                      streamResponses ? 'bg-[#6366F1]' : 'bg-[#1F2937]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        streamResponses ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111827] border border-white/5">
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-white block">
                      Show Code Line Numbers & Language Badges
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      Embed dual-tier syntax container headers with token approximations and fast clipboard copy.
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle Syntax Highlighting"
                    onClick={() => setShowSyntaxHighlighting(!showSyntaxHighlighting)}
                    className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer shrink-0 ${
                      showSyntaxHighlighting ? 'bg-[#6366F1]' : 'bg-[#1F2937]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        showSyntaxHighlighting ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI MODEL & ENGINE */}
          {activeTab === 'model' && (
            <div className="space-y-6 max-w-3xl">
              {/* Configured Model Card */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#111827] border border-white/5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#818CF8]" />
                    <h3 className="font-display font-semibold text-sm text-white">
                      Google Gemini API Engine
                    </h3>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Ready & Connected
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs text-[#64748B] block">CONFIGURED BACKEND MODEL</span>
                    <span className="font-mono text-sm font-bold text-white">
                      {formatModelDisplayName(activeModelName)}
                    </span>
                    {activeModelName && activeModelName !== formatModelDisplayName(activeModelName) && (
                      <span className="font-mono text-[11px] text-[#818CF8] block break-all">
                        ID: {activeModelName}
                      </span>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <span className="text-xs text-[#64748B] block">AVG LATENCY</span>
                    <span className="font-mono text-xs text-[#38BDF8]">~420ms (High-Fidelity)</span>
                  </div>
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Model availability is configured dynamically by the backend server environment variable{' '}
                  <code className="font-mono text-[#A5B4FC]">GEMINI_MODEL</code>. Nexora AI connects
                  securely to the Google Gemini API through server-side proxy routes, preventing any client-side credential exposure.
                </p>
              </div>

              {/* Persona Tone Preset */}
              <div className="p-4 rounded-xl bg-[#111827] border border-white/5 space-y-2">
                <h4 className="font-semibold text-xs text-white">Assistant Persona Tone</h4>
                <div className="p-3 rounded-lg bg-[#1E293B]/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs text-[#CBD5E1]">Preset Mode</span>
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#6366F1]/20 text-[#A5B4FC] border border-[#6366F1]/30 w-fit">
                    Friendly • Intelligent • Professional
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  Nexora AI provides natural conversational explanations, programming support, and educational assistance adapted for both beginners and advanced engineers.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: CONVERSATION MEMORY */}
          {activeTab === 'memory' && (
            <div className="space-y-6 max-w-3xl">
              <div className="p-4 sm:p-5 rounded-xl bg-[#111827] border border-white/5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#38BDF8]" />
                    <h3 className="font-display font-semibold text-sm text-white">
                      Conversation Memory Strategy
                    </h3>
                  </div>
                  <span className="text-[11px] sm:text-xs font-mono px-2.5 py-1 rounded-full bg-[#6366F1]/20 text-[#A5B4FC] border border-[#6366F1]/30">
                    Semantic buffer & progressive summarization
                  </span>
                </div>

                <div className="space-y-2 text-xs text-[#CBD5E1] leading-relaxed">
                  <p>
                    Nexora AI implements a dual-tier conversational context management strategy:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[#94A3B8]">
                    <li>
                      <strong className="text-white">Recent Buffer:</strong> The 20 most recent messages are kept in complete, verbatim chronological order for zero-loss immediate context.
                    </li>
                    <li>
                      <strong className="text-white">Progressive Running Summary:</strong> When history grows beyond 20 messages, older messages are synthesized into a consolidated running summary that preserves vital personal details, code decisions, and prior conclusions.
                    </li>
                    <li>
                      <strong className="text-white">Strict Isolation:</strong> Each conversation has its own unique ID and isolated memory record in PostgreSQL.
                    </li>
                  </ul>
                </div>

                {/* Active Context Metric */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#94A3B8]">Active Conversation Buffer</span>
                    <span className="font-mono text-white">
                      {memoryStatus?.recentMessagesCount || 0} / {memoryStatus?.maxRecentWindow || 20} messages in direct window
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#94A3B8]">Running Summary Status</span>
                    <span className="font-mono text-emerald-400">
                      {memoryStatus?.hasRunningSummary ? 'Active (Summarizing earlier turns)' : 'Within direct buffer window'}
                    </span>
                  </div>

                  {memoryStatus?.runningSummary && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <span className="text-[11px] text-[#64748B] block mb-1 uppercase font-mono">
                        Active Running Summary Content:
                      </span>
                      <p className="text-xs text-[#CBD5E1] bg-white/5 p-2.5 rounded-lg font-mono whitespace-pre-wrap break-words">
                        {memoryStatus.runningSummary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATA & PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-5 max-w-3xl">
              <div className="p-4 rounded-xl bg-[#111827] border border-white/5 space-y-3">
                <h3 className="font-display font-semibold text-sm text-white">
                  Storage & Persistent Data Isolation
                </h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Conversations, preferences, and summaries are stored persistently in PostgreSQL. No third-party analytics, telemetry, or external ad tracking exists in this application.
                </p>
              </div>

              {/* Data actions */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[#111827] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xs text-white">Export Transcripts</h4>
                    <p className="text-[11px] text-[#94A3B8]">
                      Download your conversation history in standard JSON or clean Markdown format.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onExportTranscripts('json')}
                      className="px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-xs text-white transition-colors cursor-pointer"
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => onExportTranscripts('markdown')}
                      className="px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-xs text-white transition-colors cursor-pointer"
                    >
                      Markdown
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#111827] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xs text-white">Clear Active Chat Messages</h4>
                    <p className="text-[11px] text-[#94A3B8]">
                      Wipes all message history and summary for the currently selected conversation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClearCurrentChat}
                    className="px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                  >
                    Clear Active Chat
                  </button>
                </div>

                {/* Irreversible Purge */}
                <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xs text-red-300">
                      Delete All Workspace Data
                    </h4>
                    <p className="text-[11px] text-red-200/70">
                      Permanently drops all conversations and messages from PostgreSQL.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClearAllData}
                    className="flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge Workspace</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ABOUT NEXORA */}
          {activeTab === 'about' && (
            <div className="space-y-6 max-w-3xl text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(99,102,241,0.4)] border border-white/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-8 h-8 text-white"
                >
                  <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-2 3.46v2.08a4 4 0 0 0 1 2.65V18a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4v-2.81a4 4 0 0 0 1-2.65V10.46A4 4 0 0 0 16 7V6a4 4 0 0 0-4-4z" />
                  <path d="M12 7v5" />
                  <path d="M9 10h6" />
                  <path d="M9 15h6" />
                </svg>
              </div>

              <div>
                <h3 className="font-display font-bold text-lg text-white">Nexora AI</h3>
                <span className="text-xs font-mono text-[#818CF8]">v1.0 Production Release</span>
                <p className="text-xs text-[#94A3B8] max-w-md mx-auto mt-2 leading-relaxed">
                  Built with React.js & Google Gemini API. Empowering seamless human-agent cognitive workflow with 20-message memory and continuous progressive summarization.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left text-xs">
                <div className="p-3 rounded-lg bg-[#111827] border border-white/5">
                  <span className="text-[10px] text-[#64748B] block">Frontend</span>
                  <span className="font-semibold text-white">React 19</span>
                </div>
                <div className="p-3 rounded-lg bg-[#111827] border border-white/5">
                  <span className="text-[10px] text-[#64748B] block">Backend</span>
                  <span className="font-semibold text-white">Express / Node</span>
                </div>
                <div className="p-3 rounded-lg bg-[#111827] border border-white/5">
                  <span className="text-[10px] text-[#64748B] block">Database</span>
                  <span className="font-semibold text-white">PostgreSQL</span>
                </div>
                <div className="p-3 rounded-lg bg-[#111827] border border-white/5">
                  <span className="text-[10px] text-[#64748B] block">AI Provider</span>
                  <span className="font-semibold text-white">Google Gemini</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-3.5 sm:px-6 py-3 sm:py-3.5 bg-[#111827] border-t border-white/5 flex items-center justify-between gap-2 text-xs shrink-0">
          <span className="hidden sm:inline text-[#64748B]">
            Settings are persisted to PostgreSQL upon confirmation.
          </span>
          <button
            type="button"
            onClick={handleRevert}
            disabled={isSaving}
            className="sm:hidden px-3 py-2 min-h-[40px] rounded-lg bg-white/5 hover:bg-white/10 text-[#CBD5E1] transition-colors cursor-pointer disabled:opacity-50"
          >
            Revert
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 rounded-lg bg-white/5 hover:bg-white/10 text-[#CBD5E1] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:opacity-90 text-white font-medium cursor-pointer disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Preferences</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
