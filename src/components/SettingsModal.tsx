import React, { useState, useEffect } from 'react';
import { AppSettings, MemoryStatus } from '../types';
import { type AuthUser } from '../lib/firebase';
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
  LogOut,
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
  user: AuthUser;
  onSignOut: () => void;
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
  user,
  onSignOut,
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
    <div className="fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] sm:inset-0 z-40 sm:z-50 flex items-center justify-center sm:p-6 bg-[var(--nx-bg-overlay)] backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:h-auto sm:max-w-4xl bg-[var(--nx-bg-modal)] sm:border sm:border-[var(--nx-border-subtle)] sm:rounded-2xl shadow-2xl flex flex-col sm:max-h-[90vh] overflow-hidden">
        {/* Top Header Bar matching Stitch AI */}
        <div className="px-3.5 sm:px-6 py-3 sm:py-4 bg-[var(--nx-bg-modal-header)] border-b border-[var(--nx-border-subtle)] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Sliders className="w-4 h-4 text-[var(--nx-accent-icon)] shrink-0" />
              <span className="font-display sm:font-mono font-semibold sm:font-normal text-sm sm:text-xs text-[var(--nx-text-heading)] sm:text-[var(--nx-text-muted)] sm:tracking-wider sm:uppercase truncate">
                <span className="sm:hidden">Workspace Settings</span>
                <span className="hidden sm:inline">SYSTEM CONFIGURATION</span>
              </span>
              <span className="hidden sm:inline text-[var(--nx-border-strong)]">/</span>
              <span className="hidden sm:inline font-sans font-medium text-xs text-[var(--nx-text-heading)] truncate">
                Preferences & AI Engine
              </span>
            </div>

            <div className="hidden md:flex items-center gap-3 pl-3 border-l border-[var(--nx-border-subtle)] text-[11px] font-mono text-[var(--nx-text-muted)]">
              <span className="flex items-center gap-1.5 text-[var(--nx-status-emerald)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--nx-status-emerald)] animate-pulse" />
                Cloud Sync: Ready
              </span>
              <span className="flex items-center gap-1 text-[var(--nx-text-subtle)]">
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
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Revert Defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 min-h-[36px] rounded-xl bg-gradient-to-r from-[var(--nx-accent)] to-[var(--nx-accent-end)] hover:opacity-90 text-white text-xs font-medium shadow-[0_0_15px_rgba(118,87,246,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline Error Banner inside Settings */}
        {saveError && (
          <div className="mx-3.5 sm:mx-6 mt-3 p-3 rounded-xl bg-[var(--nx-bg-error)] border border-[var(--nx-border-error)] text-xs text-[var(--nx-text-error)] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="break-words">{saveError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="text-[var(--nx-text-error-muted)] hover:text-[var(--nx-text-error)] text-xs px-2 py-1 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation Pills */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-[var(--nx-bg-sidebar)] border-b border-[var(--nx-border-subtle)] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-xl text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--nx-bg-active-item)] text-[var(--nx-text-heading)] shadow-xs border border-[var(--nx-accent-border)]'
                    : 'text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-hover-ghost)]'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--nx-accent-icon)]' : 'text-[var(--nx-text-subtle)]'}`}
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
                    <h3 className="font-display font-semibold text-sm text-[var(--nx-text-heading)]">
                      Interface Appearance
                    </h3>
                    <p className="text-xs text-[var(--nx-text-muted)]">
                      Choose your visual aesthetic and display calibration across workspace canvases.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--nx-accent-soft)] text-[var(--nx-accent-text)] border border-[var(--nx-accent-border)] shrink-0">
                    {theme === 'dark' ? 'Dark Mode Active' : theme === 'light' ? 'Light Mode Active' : 'System Sync'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Light Mode Card */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setTheme('light')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setTheme('light');
                      }
                    }}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] ${
                      theme === 'light'
                        ? 'border-[var(--nx-accent)] bg-[var(--nx-bg-active-item)] shadow-[0_0_15px_rgba(118,87,246,0.18)] ring-1 ring-[var(--nx-accent)]'
                        : 'border-[var(--nx-border-subtle)] bg-[var(--nx-bg-surface)] hover:border-[var(--nx-border-strong)] shadow-[var(--nx-card-shadow)]'
                    }`}
                  >
                    <div className="h-14 sm:h-16 rounded-lg bg-gradient-to-r from-[#F8FAFC] to-[#EEF2FF] flex items-center justify-center mb-3 border border-[#CBD5E1]">
                      <Sun className="w-6 h-6 text-[#7657F6]" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[var(--nx-text-heading)]">Light Mode</span>
                        {theme === 'light' && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--nx-accent-soft)] text-[var(--nx-accent-text)] border border-[var(--nx-accent-border)]">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          theme === 'light'
                            ? 'border-[var(--nx-accent)] bg-[var(--nx-accent)]'
                            : 'border-[var(--nx-text-subtle)]'
                        }`}
                      >
                        {theme === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--nx-text-muted)] leading-relaxed">
                      High-contrast daytime canvas with crisp white cards and violet accents.
                    </p>
                  </div>

                  {/* Nexora Dark Card */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setTheme('dark')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setTheme('dark');
                      }
                    }}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] ${
                      theme === 'dark'
                        ? 'border-[var(--nx-accent)] bg-[var(--nx-bg-active-item)] shadow-[0_0_15px_rgba(99,102,241,0.2)] ring-1 ring-[var(--nx-accent)]'
                        : 'border-[var(--nx-border-subtle)] bg-[var(--nx-bg-surface)] hover:border-[var(--nx-border-strong)] shadow-[var(--nx-card-shadow)]'
                    }`}
                  >
                    <div className="h-14 sm:h-16 rounded-lg bg-[#0B0F19] flex items-center justify-center mb-3 border border-[#6366F1]/30 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-tr from-[#6366F1]/10 to-transparent" />
                      <Moon className="w-6 h-6 text-[#818CF8]" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[var(--nx-text-heading)]">Nexora Dark</span>
                        {theme === 'dark' && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--nx-accent-soft)] text-[var(--nx-accent-text)] border border-[var(--nx-accent-border)]">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          theme === 'dark'
                            ? 'border-[var(--nx-accent)] bg-[var(--nx-accent)]'
                            : 'border-[var(--nx-text-subtle)]'
                        }`}
                      >
                        {theme === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--nx-text-muted)] leading-relaxed">
                      Deep obsidian (#0B0F19) with subtle violet glow and slate syntax.
                    </p>
                  </div>

                  {/* System Synchronized Card */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setTheme('system')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setTheme('system');
                      }
                    }}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] ${
                      theme === 'system'
                        ? 'border-[var(--nx-accent)] bg-[var(--nx-bg-active-item)] shadow-[0_0_15px_rgba(118,87,246,0.18)] ring-1 ring-[var(--nx-accent)]'
                        : 'border-[var(--nx-border-subtle)] bg-[var(--nx-bg-surface)] hover:border-[var(--nx-border-strong)] shadow-[var(--nx-card-shadow)]'
                    }`}
                  >
                    <div className="h-14 sm:h-16 rounded-lg bg-gradient-to-br from-[#1E293B] to-[#0F172A] flex items-center justify-center mb-3 border border-white/10">
                      <Laptop className="w-6 h-6 text-[#94A3B8]" />
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-[var(--nx-text-heading)]">System Synchronized</span>
                        {theme === 'system' && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[var(--nx-accent-soft)] text-[var(--nx-accent-text)] border border-[var(--nx-accent-border)]">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          theme === 'system'
                            ? 'border-[var(--nx-accent)] bg-[var(--nx-accent)]'
                            : 'border-[var(--nx-text-subtle)]'
                        }`}
                      >
                        {theme === 'system' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--nx-text-muted)] leading-relaxed">
                      Dynamically tracks your operating system dark/light theme preference.
                    </p>
                  </div>
                </div>
              </div>

              {/* Language & Regional Localization */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-semibold text-xs text-[var(--nx-text-heading)]">
                    Language & Regional Localization
                  </h4>
                  <p className="text-xs text-[var(--nx-text-muted)]">
                    Controls interface prompt guidance, error taxonomy, and automated formatting.
                  </p>
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-[var(--nx-bg-surface-alt)] text-xs text-[var(--nx-text-heading)] px-3 py-2 sm:py-1.5 min-h-[38px] rounded-lg border border-[var(--nx-border-strong)] focus:outline-none focus:border-[var(--nx-accent)] focus:ring-2 focus:ring-[var(--nx-accent-soft)] w-full sm:w-auto shrink-0 cursor-pointer"
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
                <h4 className="font-semibold text-xs text-[var(--nx-text-heading)] mb-2">Transcript Typography Scale</h4>
                <div className="grid grid-cols-3 gap-2">
                  {(['12px', '14px', '16px'] as const).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setTypographyScale(scale)}
                      className={`py-2.5 sm:py-2 px-2 sm:px-3 min-h-[42px] rounded-xl text-xs font-medium border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-all cursor-pointer ${
                        typographyScale === scale
                          ? 'border-[var(--nx-accent)] bg-[var(--nx-accent-soft)] text-[var(--nx-text-heading)] shadow-xs'
                          : 'border-[var(--nx-border-subtle)] bg-[var(--nx-bg-surface)] text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:border-[var(--nx-border-strong)]'
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
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)]">
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-[var(--nx-text-heading)] block">
                      Send Message on Enter <kbd className="text-[10px] bg-[var(--nx-kbd-bg)] px-1 py-0.5 rounded text-[var(--nx-kbd-text)] border border-[var(--nx-border-subtle)]">↵ Return</kbd>
                    </span>
                    <span className="text-[11px] text-[var(--nx-text-muted)]">
                      Pressing Return sends prompt instantly. Shift + Return enters a multi-line carriage return.
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle Send Message on Enter"
                    onClick={() => setSendOnEnter(!sendOnEnter)}
                    className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] ${
                      sendOnEnter ? 'bg-[var(--nx-accent)]' : 'bg-[var(--nx-toggle-off)]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                        sendOnEnter ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)]">
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-[var(--nx-text-heading)] block">
                      Stream AI Responses in Real-time (SSE)
                    </span>
                    <span className="text-[11px] text-[var(--nx-text-muted)]">
                      Receive tokens via chunked Server-Sent Events for fluid progressive rendering.
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle Stream AI Responses"
                    onClick={() => setStreamResponses(!streamResponses)}
                    className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] ${
                      streamResponses ? 'bg-[var(--nx-accent)]' : 'bg-[var(--nx-toggle-off)]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                        streamResponses ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)]">
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-[var(--nx-text-heading)] block">
                      Show Code Line Numbers & Language Badges
                    </span>
                    <span className="text-[11px] text-[var(--nx-text-muted)]">
                      Embed dual-tier syntax container headers with token approximations and fast clipboard copy.
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle Syntax Highlighting"
                    onClick={() => setShowSyntaxHighlighting(!showSyntaxHighlighting)}
                    className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] ${
                      showSyntaxHighlighting ? 'bg-[var(--nx-accent)]' : 'bg-[var(--nx-toggle-off)]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
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
              <div className="p-4 sm:p-5 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--nx-accent-icon)]" />
                    <h3 className="font-display font-semibold text-sm text-[var(--nx-text-heading)]">
                      Google Gemini API Engine
                    </h3>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--nx-status-emerald)] font-mono">
                    <span className="w-2 h-2 rounded-full bg-[var(--nx-status-emerald)] animate-pulse" />
                    Ready & Connected
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-[var(--nx-bg-surface-alt)] border border-[var(--nx-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs text-[var(--nx-text-subtle)] block">CONFIGURED BACKEND MODEL</span>
                    <span className="font-mono text-sm font-bold text-[var(--nx-text-heading)]">
                      {formatModelDisplayName(activeModelName)}
                    </span>
                    {activeModelName && activeModelName !== formatModelDisplayName(activeModelName) && (
                      <span className="font-mono text-[11px] text-[var(--nx-accent-text)] block break-all">
                        ID: {activeModelName}
                      </span>
                    )}
                  </div>
                  <div className="sm:text-right">
                    <span className="text-xs text-[var(--nx-text-subtle)] block">AVG LATENCY</span>
                    <span className="font-mono text-xs text-[var(--nx-secondary-text)]">~420ms (High-Fidelity)</span>
                  </div>
                </div>

                <p className="text-xs text-[var(--nx-text-muted)] leading-relaxed">
                  Model availability is configured dynamically by the backend server environment variable{' '}
                  <code className="font-mono text-[var(--nx-accent-text)]">GEMINI_MODEL</code>. Nexora AI connects
                  securely to the Google Gemini API through server-side proxy routes, preventing any client-side credential exposure.
                </p>
              </div>

              {/* Persona Tone Preset with Assistant Profile Avatar (Logo 2) */}
              <div className="p-4 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] space-y-2">
                <h4 className="font-semibold text-xs text-[var(--nx-text-heading)]">Assistant Persona & Profile</h4>
                <div className="p-3 rounded-lg bg-[var(--nx-bg-surface-alt)] border border-[var(--nx-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/brand/nexora-assistant-avatar.png"
                      alt="Nexora AI Assistant Avatar"
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-[#38BDF8]/40 bg-[#0B1221] shrink-0"
                    />
                    <span className="text-xs text-[var(--nx-text-body)]">Preset Mode</span>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-[var(--nx-accent-soft)] text-[var(--nx-accent-text)] border border-[var(--nx-accent-border)] w-fit">
                    Friendly • Intelligent • Professional
                  </span>
                </div>
                <p className="text-[11px] text-[var(--nx-text-muted)]">
                  Nexora AI provides natural conversational explanations, programming support, and educational assistance adapted for both beginners and advanced engineers.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: CONVERSATION MEMORY */}
          {activeTab === 'memory' && (
            <div className="space-y-6 max-w-3xl">
              <div className="p-4 sm:p-5 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[var(--nx-secondary-text)]" />
                    <h3 className="font-display font-semibold text-sm text-[var(--nx-text-heading)]">
                      Conversation Memory Strategy
                    </h3>
                  </div>
                  <span className="text-[11px] sm:text-xs font-mono px-2.5 py-1 rounded-full bg-[var(--nx-accent-soft)] text-[var(--nx-accent-text)] border border-[var(--nx-accent-border)]">
                    Semantic buffer & progressive summarization
                  </span>
                </div>

                <div className="space-y-2 text-xs text-[var(--nx-text-body)] leading-relaxed">
                  <p>
                    Nexora AI implements a dual-tier conversational context management strategy:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[var(--nx-text-muted)]">
                    <li>
                      <strong className="text-[var(--nx-text-heading)]">Recent Buffer:</strong> The 20 most recent messages are kept in complete, verbatim chronological order for zero-loss immediate context.
                    </li>
                    <li>
                      <strong className="text-[var(--nx-text-heading)]">Progressive Running Summary:</strong> When history grows beyond 20 messages, older messages are synthesized into a consolidated running summary that preserves vital personal details, code decisions, and prior conclusions.
                    </li>
                    <li>
                      <strong className="text-[var(--nx-text-heading)]">Strict Isolation:</strong> Each conversation has its own unique ID and isolated memory record in PostgreSQL.
                    </li>
                  </ul>
                </div>

                {/* Active Context Metric */}
                <div className="p-4 rounded-xl bg-[var(--nx-bg-surface-alt)] border border-[var(--nx-border-subtle)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--nx-text-muted)]">Active Conversation Buffer</span>
                    <span className="font-mono text-[var(--nx-text-heading)]">
                      {memoryStatus?.recentMessagesCount || 0} / {memoryStatus?.maxRecentWindow || 20} messages in direct window
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--nx-text-muted)]">Running Summary Status</span>
                    <span className="font-mono text-[var(--nx-status-emerald)]">
                      {memoryStatus?.hasRunningSummary ? 'Active (Summarizing earlier turns)' : 'Within direct buffer window'}
                    </span>
                  </div>

                  {memoryStatus?.runningSummary && (
                    <div className="mt-2 pt-2 border-t border-[var(--nx-border-subtle)]">
                      <span className="text-[11px] text-[var(--nx-text-subtle)] block mb-1 uppercase font-mono">
                        Active Running Summary Content:
                      </span>
                      <p className="text-xs text-[var(--nx-text-primary)] bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] p-2.5 rounded-lg font-mono whitespace-pre-wrap break-words">
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
              {/* Authenticated Google Account */}
              <div className="p-4 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User profile'}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-[var(--nx-accent-border)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--nx-accent)] to-[var(--nx-accent-end)] flex items-center justify-center font-display font-bold text-sm text-white shrink-0">
                      {(user.displayName || user.email || 'U')[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-sm text-[var(--nx-text-heading)] truncate">
                      {user.displayName || 'Google User'}
                    </h3>
                    <p className="text-xs text-[var(--nx-text-muted)] truncate">
                      {user.email || 'Verified Google Account'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignOut();
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-[var(--nx-bg-surface-alt)] hover:bg-red-500/10 hover:text-red-500 border border-[var(--nx-border-subtle)] hover:border-red-500/30 text-xs font-medium text-[var(--nx-text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] space-y-3">
                <h3 className="font-display font-semibold text-sm text-[var(--nx-text-heading)]">
                  Storage & Persistent Data Isolation
                </h3>
                <p className="text-xs text-[var(--nx-text-muted)] leading-relaxed">
                  Conversations, preferences, and summaries are stored persistently under your verified Firebase account UID. No third-party analytics, telemetry, or external ad tracking exists in this application.
                </p>
              </div>

              {/* Data actions */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xs text-[var(--nx-text-heading)]">Export Transcripts</h4>
                    <p className="text-[11px] text-[var(--nx-text-muted)]">
                      Download your conversation history in standard JSON or clean Markdown format.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onExportTranscripts('json')}
                      className="px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-[var(--nx-bg-surface-alt)] hover:bg-[var(--nx-bg-surface-hover)] border border-[var(--nx-border-subtle)] text-xs text-[var(--nx-text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer"
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => onExportTranscripts('markdown')}
                      className="px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-[var(--nx-bg-surface-alt)] hover:bg-[var(--nx-bg-surface-hover)] border border-[var(--nx-border-subtle)] text-xs text-[var(--nx-text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer"
                    >
                      Markdown
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xs text-[var(--nx-text-heading)]">Clear Active Chat Messages</h4>
                    <p className="text-[11px] text-[var(--nx-text-muted)]">
                      Wipes all message history and summary for the currently selected conversation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClearCurrentChat}
                    className="px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-[var(--nx-status-amber)] border border-amber-500/35 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                  >
                    Clear Active Chat
                  </button>
                </div>

                {/* Irreversible Purge */}
                <div className="p-4 rounded-xl bg-[var(--nx-bg-error)] border border-[var(--nx-border-error)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-xs text-[var(--nx-text-error)]">
                      Delete All Workspace Data
                    </h4>
                    <p className="text-[11px] text-[var(--nx-text-error-muted)]">
                      Permanently drops all conversations and messages from PostgreSQL.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClearAllData}
                    className="flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors cursor-pointer shrink-0 self-start sm:self-center"
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
              <div className="w-44 sm:w-52 rounded-2xl overflow-hidden bg-[#0B1221] border border-[#38BDF8]/30 mx-auto shadow-[0_0_30px_rgba(56,189,248,0.24)]">
                <img
                  src="/brand/nexora-logo-full.png"
                  alt="Nexora AI Official Logo"
                  className="w-full h-auto block object-contain"
                />
              </div>

              <div>
                <h3 className="font-display font-bold text-lg text-[var(--nx-text-heading)]">Nexora AI</h3>
                <span className="text-xs font-mono text-[var(--nx-accent-text)]">v1.0 Production Release</span>
                <p className="text-xs text-[var(--nx-text-muted)] max-w-md mx-auto mt-2 leading-relaxed">
                  Built with React.js & Google Gemini API. Empowering seamless human-agent cognitive workflow with 20-message memory and continuous progressive summarization.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left text-xs">
                <div className="p-3 rounded-lg bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)]">
                  <span className="text-[10px] text-[var(--nx-text-subtle)] block">Frontend</span>
                  <span className="font-semibold text-[var(--nx-text-heading)]">React 19</span>
                </div>
                <div className="p-3 rounded-lg bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)]">
                  <span className="text-[10px] text-[var(--nx-text-subtle)] block">Backend</span>
                  <span className="font-semibold text-[var(--nx-text-heading)]">Express / Node</span>
                </div>
                <div className="p-3 rounded-lg bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)]">
                  <span className="text-[10px] text-[var(--nx-text-subtle)] block">Database</span>
                  <span className="font-semibold text-[var(--nx-text-heading)]">PostgreSQL</span>
                </div>
                <div className="p-3 rounded-lg bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)]">
                  <span className="text-[10px] text-[var(--nx-text-subtle)] block">AI Provider</span>
                  <span className="font-semibold text-[var(--nx-text-heading)]">Google Gemini</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-3.5 sm:px-6 py-3 sm:py-3.5 bg-[var(--nx-bg-modal-header)] border-t border-[var(--nx-border-subtle)] flex items-center justify-between gap-2 text-xs shrink-0">
          <span className="hidden sm:inline text-[var(--nx-text-subtle)]">
            Settings are persisted to PostgreSQL upon confirmation.
          </span>
          <button
            type="button"
            onClick={handleRevert}
            disabled={isSaving}
            className="sm:hidden px-3 py-2 min-h-[40px] rounded-lg bg-[var(--nx-bg-surface-alt)] hover:bg-[var(--nx-bg-surface-hover)] border border-[var(--nx-border-subtle)] text-[var(--nx-text-body)] transition-colors cursor-pointer disabled:opacity-50"
          >
            Revert
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 rounded-lg bg-[var(--nx-bg-surface-alt)] hover:bg-[var(--nx-bg-surface-hover)] border border-[var(--nx-border-subtle)] text-[var(--nx-text-body)] hover:text-[var(--nx-text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 rounded-xl bg-gradient-to-r from-[var(--nx-accent)] to-[var(--nx-accent-end)] hover:opacity-90 text-white font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
