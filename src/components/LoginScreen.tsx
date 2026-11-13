import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Cpu,
  Sun,
  Moon,
  AlertCircle,
  Loader2,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { NexoraLogo } from './NexoraLogo';
import { formatModelDisplayName } from '../utils/format';

interface LoginScreenProps {
  onGoogleSignIn: () => Promise<void>;
  theme: 'dark' | 'light' | 'system';
  onToggleTheme: () => void;
  activeModelName: string;
  externalError?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onGoogleSignIn,
  theme,
  onToggleTheme,
  activeModelName,
  externalError,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayError = error || externalError;

  const handleSignInClick = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setError(null);
    try {
      await onGoogleSignIn();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to complete Google sign-in.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between px-4 py-5 sm:px-6 sm:py-8 overflow-y-auto relative">
      {/* Top Navbar */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-3">
        <NexoraLogo size="sm" showBadge={true} />

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] text-xs text-[var(--nx-text-body)] shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[var(--nx-accent-icon)]" />
            <span>{formatModelDisplayName(activeModelName)}</span>
          </span>

          <button
            type="button"
            onClick={onToggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] text-[var(--nx-text-muted)] hover:text-[var(--nx-text-heading)] hover:bg-[var(--nx-bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-colors cursor-pointer shadow-xs"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-[var(--nx-accent-text)]" />
            )}
          </button>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="w-full max-w-md mx-auto my-8">
        <div className="relative rounded-3xl bg-[var(--nx-bg-surface)] border border-[var(--nx-border-subtle)] shadow-[var(--nx-card-shadow)] p-6 sm:p-8 overflow-hidden">
          {/* Ambient glow matching Nexora cyan/blue/purple theme */}
          <div className="pointer-events-none absolute -top-20 -right-20 w-44 h-44 rounded-full bg-[#38BDF8]/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 w-44 h-44 rounded-full bg-[#7657F6]/12 blur-3xl" />

          <div className="relative flex flex-col items-center text-center">
            {/* Official Logo 1 Emblem */}
            <div className="mb-5">
              <NexoraLogo variant="full" size="md" showBadge={false} />
            </div>

            {/* Assistant Avatar Badge (Logo 2) */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--nx-bg-surface-alt)] border border-[var(--nx-accent-border)] text-[11px] font-medium text-[var(--nx-text-body)] mb-4">
              <img
                src="/brand/nexora-assistant-avatar.png"
                alt="Nexora AI Assistant"
                className="w-4 h-4 rounded-full object-cover bg-[#0B1221] shrink-0"
              />
              <span>Private AI Workspace</span>
            </div>

            <h1 className="font-display font-bold text-2xl text-[var(--nx-text-heading)] tracking-tight mb-2">
              Sign in to Nexora AI
            </h1>
            <p className="text-xs sm:text-sm text-[var(--nx-text-muted)] leading-relaxed mb-6">
              Access your private Google-authenticated workspace with isolated conversation history, 20-message memory, and running summaries.
            </p>

            {/* Error Alert */}
            {displayError && (
              <div className="w-full mb-5 p-3 rounded-xl bg-[var(--nx-bg-error)] border border-[var(--nx-border-error)] text-xs text-[var(--nx-text-error)] text-left flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed break-words">{displayError}</span>
              </div>
            )}

            {/* Google Sign-In CTA */}
            <button
              type="button"
              onClick={handleSignInClick}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--nx-bg-surface-alt)] hover:bg-[var(--nx-bg-surface-hover)] border border-[var(--nx-border-strong)] hover:border-[var(--nx-accent)] text-[var(--nx-text-heading)] font-semibold text-sm shadow-sm hover:shadow-[0_0_24px_rgba(118,87,246,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] group"
            >
              {isSigningIn ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--nx-accent)]" />
                  <span>Signing in with Google...</span>
                </>
              ) : (
                <>
                  {/* Authentic Google G Emblem */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                  <ArrowRight className="w-4 h-4 text-[var(--nx-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>

            {/* Security & Feature Guarantees */}
            <div className="w-full mt-6 pt-5 border-t border-[var(--nx-border-subtle)] space-y-2.5 text-left">
              <div className="flex items-start gap-2.5 text-xs text-[var(--nx-text-body)]">
                <ShieldCheck className="w-4 h-4 text-[var(--nx-status-emerald)] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[var(--nx-text-heading)] font-medium">Private Conversation Isolation:</strong> Your chats and preferences are strictly tied to your verified Google account.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[var(--nx-text-body)]">
                <Cpu className="w-4 h-4 text-[var(--nx-secondary-text)] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[var(--nx-text-heading)] font-medium">Persistent Context Memory:</strong> Remembers your last 20 turns with automatic progressive summarization.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[var(--nx-text-body)]">
                <Lock className="w-4 h-4 text-[var(--nx-accent-icon)] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[var(--nx-text-heading)] font-medium">Server-Verified Tokens:</strong> Every API call is cryptographically verified via Firebase Authentication.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto text-center text-[11px] text-[var(--nx-text-subtle)]">
        Nexora AI • Powered by Google {formatModelDisplayName(activeModelName)} & Firebase Auth
      </footer>
    </div>
  );
};
