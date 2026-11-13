import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message, MemoryStatus, AppSettings } from './types';
import { api, setUnauthorizedHandler } from './services/api';
import {
  type AuthUser,
  subscribeToAuthState,
  signInWithGoogle,
  signOutUser,
} from './lib/firebase';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessage } from './components/ChatMessage';
import { MessageComposer } from './components/MessageComposer';
import { NewChatHome } from './components/NewChatHome';
import { SettingsModal } from './components/SettingsModal';
import { MemoryModal } from './components/MemoryModal';
import { MobileNav } from './components/MobileNav';
import { LoginScreen } from './components/LoginScreen';
import { NexoraLogo } from './components/NexoraLogo';
import { formatModelDisplayName } from './utils/format';
import { AlertCircle, Check, Loader2, RotateCw } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  typographyScale: '14px',
  sendOnEnter: true,
  streamResponses: true,
  showSyntaxHighlighting: true,
  language: 'en-US',
  model: '',
};

function readLocalThemePreference(): 'dark' | 'light' | 'system' {
  try {
    const saved = localStorage.getItem('nexora_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Ignore storage restriction
  }
  return 'dark';
}

export default function App() {
  // Authentication state
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // App state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [lastFailedNewChat, setLastFailedNewChat] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Dynamic configured model fetched from backend
  const [backendModel, setBackendModel] = useState<string>('');

  // Modals & Drawers
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusSearchTrigger, setFocusSearchTrigger] = useState(0);
  const [mobileNavMode, setMobileNavMode] = useState<'chat' | 'search' | 'history'>('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // User Settings
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    theme: readLocalThemePreference(),
  }));

  const abortControllerRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevUidRef = useRef<string | null>(null);

  // Current active model to display everywhere
  const activeModel = backendModel || settings.model || 'gemini-3.1-flash-lite';

  const resetPrivateState = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isSubmittingRef.current = false;
    setIsLoading(false);
    setIsRegenerating(false);
    setStreamingMessage('');
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    setMemoryStatus(null);
    setErrorBanner(null);
    setLastFailedPrompt(null);
    setLastFailedNewChat(false);
    setInputMessage('');
    setIsSidebarOpen(false);
    setIsSettingsOpen(false);
    setIsMemoryModalOpen(false);
    setIsHelpOpen(false);
  }, []);

  // Apply theme to HTML root & sync system color scheme changes immediately
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    const applyTheme = () => {
      const isDark =
        settings.theme === 'dark' || (settings.theme === 'system' && mediaQuery.matches);

      if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light');
        themeColorMeta?.setAttribute('content', '#0B0F19');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
        themeColorMeta?.setAttribute('content', '#FFFFFF');
      }
    };

    applyTheme();
    try {
      localStorage.setItem('nexora_theme', settings.theme);
    } catch {
      // Ignore storage restriction
    }
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  // Subscribe to Firebase Auth persistence across reloads and account switches
  useEffect(() => {
    api.getHealth()
      .then((health) => {
        if (health?.model) setBackendModel(health.model);
      })
      .catch(() => {});

    const unsubscribe = subscribeToAuthState((nextUser) => {
      const prevUid = prevUidRef.current;
      const nextUid = nextUser?.uid || null;
      if (prevUid !== nextUid) {
        resetPrivateState();
        prevUidRef.current = nextUid;
      }
      setUser(nextUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [resetPrivateState]);

  // Register global 401 session-expired handler
  useEffect(() => {
    setUnauthorizedHandler(() => {
      resetPrivateState();
      setAuthError('Your session expired or was revoked. Please sign in with Google again.');
      signOutUser().catch(() => {});
    });
    return () => setUnauthorizedHandler(null);
  }, [resetPrivateState]);

  // Load initial settings and conversations ONLY after user is authenticated
  useEffect(() => {
    if (!authLoading && user) {
      loadSettings();
      loadConversations();
    }
  }, [authLoading, user?.uid]);

  // When active conversation changes, load messages & memory status
  useEffect(() => {
    if (user && activeConversationId) {
      loadConversationMessages(activeConversationId);
      loadMemoryStatus(activeConversationId);
    } else {
      setMessages([]);
      setMemoryStatus(null);
    }
  }, [user?.uid, activeConversationId]);

  // Automatic scrolling: immediate during streaming to avoid lag, smooth upon completion
  useEffect(() => {
    if (streamingMessage) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingMessage]);

  // Global keyboard shortcuts (⌘N for New Chat, Esc to cancel stream)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!user) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      }
      if (e.key === 'Escape') {
        if (isLoading) {
          handleStopStreaming();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, user]);

  const loadSettings = async () => {
    try {
      const [settingsData, healthData] = await Promise.allSettled([
        api.getSettings(),
        api.getHealth(),
      ]);

      if (settingsData.status === 'fulfilled') {
        setSettings(settingsData.value);
      }
      if (healthData.status === 'fulfilled' && healthData.value.model) {
        setBackendModel(healthData.value.model);
      } else if (settingsData.status === 'fulfilled' && settingsData.value.model) {
        setBackendModel(settingsData.value.model);
      }
    } catch (e) {
      console.warn('Failed to fetch settings from server, using defaults:', e);
    }
  };

  const loadConversations = async () => {
    try {
      const list = await api.getConversations();
      setConversations(list);
    } catch (e: any) {
      console.error('Failed to load conversations:', e);
    }
  };

  const loadConversationMessages = async (id: string) => {
    try {
      const data = await api.getConversation(id);
      setMessages(data.messages || []);
    } catch (e: any) {
      console.error('Failed to load messages for conversation:', e);
    }
  };

  const loadMemoryStatus = async (id: string) => {
    try {
      const status = await api.getMemoryStatus(id);
      setMemoryStatus(status);
    } catch (e: any) {
      console.warn('Failed to load memory status:', e);
    }
  };

  const handleNewChat = async () => {
    try {
      setErrorBanner(null);
      setLastFailedPrompt(null);
      setLastFailedNewChat(false);
      const newConv = await api.createConversation('New Chat');
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setInputMessage('');
    } catch (e: any) {
      setErrorBanner(e?.message || 'Failed to create new conversation');
      setLastFailedNewChat(true);
    }
  };

  const handleSelectConversation = (id: string) => {
    setErrorBanner(null);
    setLastFailedPrompt(null);
    setLastFailedNewChat(false);
    setActiveConversationId(id);
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      const updated = await api.updateConversation(id, { title: newTitle });
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (e: any) {
      setErrorBanner('Failed to rename conversation');
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (e: any) {
      setErrorBanner('Failed to delete conversation');
    }
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    try {
      const updated = await api.updateConversation(id, { pinned });
      setConversations((prev) =>
        prev
          .map((c) => (c.id === id ? updated : c))
          .sort((a, b) => b.pinned - a.pinned || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
    } catch (e: any) {
      setErrorBanner('Failed to pin conversation');
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputMessage).trim();

    // Prevent duplicate submissions and invalid requests
    if (!prompt || isLoading || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setErrorBanner(null);
    setLastFailedPrompt(null);
    setLastFailedNewChat(false);
    setInputMessage('');

    let convId = activeConversationId;

    // Create a new conversation if none is active
    if (!convId) {
      try {
        const newConv = await api.createConversation('New Chat');
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        convId = newConv.id;
      } catch (err: any) {
        isSubmittingRef.current = false;
        setInputMessage(prompt);
        setErrorBanner(err?.message || 'Failed to create conversation session. Please try again.');
        setLastFailedPrompt(prompt);
        return;
      }
    }

    // Optimistically append user message (retained across errors)
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: convId,
      role: 'user',
      content: prompt,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    setIsLoading(true);
    setStreamingMessage('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedText = '';

    if (settings.streamResponses) {
      api.sendChatMessageStream(
        convId,
        prompt,
        controller.signal,
        (chunk) => {
          accumulatedText += chunk;
          setStreamingMessage(accumulatedText);
        },
        (meta) => {
          setIsLoading(false);
          isSubmittingRef.current = false;
          setStreamingMessage('');
          abortControllerRef.current = null;

          if (accumulatedText.trim()) {
            const assistantMsg: Message = {
              id: meta.messageId || `msg-${Date.now()}`,
              conversation_id: convId!,
              role: 'assistant',
              content: accumulatedText,
              created_at: new Date().toISOString(),
              model: meta.model || activeModel,
              latencyMs: meta.latencyMs || 420,
              tokens: meta.tokens || Math.round(accumulatedText.length / 4),
            };
            setMessages((prev) => [...prev, assistantMsg]);
          }

          loadConversations();
          if (convId) loadMemoryStatus(convId);
        },
        (error) => {
          setIsLoading(false);
          isSubmittingRef.current = false;
          setStreamingMessage('');
          abortControllerRef.current = null;
          setErrorBanner(error);
          setLastFailedPrompt(prompt);
        }
      );
    } else {
      try {
        const res = await api.sendChatMessage(convId, prompt, controller.signal);
        setIsLoading(false);
        isSubmittingRef.current = false;
        abortControllerRef.current = null;

        setMessages((prev) => [
          ...prev,
          {
            ...res.assistantMessage,
            model: res.model || activeModel,
            latencyMs: res.latencyMs,
            tokens: res.tokens,
          },
        ]);
        loadConversations();
        if (convId) loadMemoryStatus(convId);
      } catch (err: any) {
        setIsLoading(false);
        isSubmittingRef.current = false;
        abortControllerRef.current = null;
        if (err?.name !== 'AbortError') {
          setErrorBanner(err?.message || 'Failed to generate response.');
          setLastFailedPrompt(prompt);
        }
      }
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    isSubmittingRef.current = false;
  };

  const handleRegenerate = async () => {
    if (!activeConversationId || isLoading || isRegenerating) return;
    try {
      setIsLoading(true);
      setIsRegenerating(true);
      setErrorBanner(null);
      setLastFailedPrompt(null);

      const result = await api.regenerate(activeConversationId);
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
          copy.pop();
        }
        return [...copy, result.assistantMessage];
      });
      loadMemoryStatus(activeConversationId);
    } catch (e: any) {
      setErrorBanner(e.message || 'Failed to regenerate response from Gemini API.');
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
      isSubmittingRef.current = false;
    }
  };

  const handleResetContext = async () => {
    if (!activeConversationId) return;
    try {
      await api.clearConversationContext(activeConversationId);
      setMessages([]);
      loadMemoryStatus(activeConversationId);
      setShareFeedback('Conversation context memory reset successfully.');
      setTimeout(() => setShareFeedback(null), 3000);
    } catch (e: any) {
      setErrorBanner('Failed to reset conversation context');
    }
  };

  const handleClearAllData = async () => {
    try {
      await api.clearAllData();
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
      setMemoryStatus(null);
      setIsSettingsOpen(false);
      setShareFeedback('All workspace data wiped successfully.');
      setTimeout(() => setShareFeedback(null), 3000);
    } catch (e: any) {
      setErrorBanner('Failed to clear workspace data');
    }
  };

  const handleSaveSettings = async (newSettings: Partial<AppSettings>): Promise<void> => {
    const persisted = await api.updateSettings(newSettings);
    setSettings((prev) => ({ ...prev, ...persisted }));
    setErrorBanner(null);
    setShareFeedback('Settings saved successfully.');
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const handleQuickToggleTheme = async () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    if (!user) {
      setSettings((prev) => ({ ...prev, theme: nextTheme }));
      return;
    }
    try {
      await handleSaveSettings({ theme: nextTheme });
    } catch (e: any) {
      setErrorBanner(e?.message || 'Failed to save theme setting.');
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    resetPrivateState();
    setAuthError(null);
    setSettings({ ...DEFAULT_SETTINGS, theme: readLocalThemePreference() });
    try {
      await signOutUser();
    } catch (e) {
      console.warn('Sign out encountered an issue:', e);
    }
  };

  const handleExportTranscripts = (format: 'json' | 'markdown') => {
    if (messages.length === 0) {
      setErrorBanner('No messages to export in active conversation.');
      return;
    }

    let fileContent = '';
    const fileName = `nexora-transcript-${Date.now()}.${format === 'json' ? 'json' : 'md'}`;
    const mimeType = format === 'json' ? 'application/json' : 'text/markdown';

    if (format === 'json') {
      fileContent = JSON.stringify({ conversation: activeConversationId, messages }, null, 2);
    } else {
      fileContent =
        `# Nexora AI Transcript\n\nExported: ${new Date().toLocaleString()}\n\n` +
        messages
          .map((m) => `### ${m.role === 'user' ? 'User' : 'Nexora AI'} (${m.created_at})\n\n${m.content}\n\n---`)
          .join('\n\n');
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    if (messages.length === 0) {
      setShareFeedback('Start a conversation to share transcripts.');
    } else {
      const summaryText = messages
        .map((m) => `${m.role === 'user' ? 'You' : 'Nexora AI'}: ${m.content}`)
        .join('\n\n');
      navigator.clipboard.writeText(summaryText);
      setShareFeedback('Transcript copied to clipboard!');
    }
    setTimeout(() => setShareFeedback(null), 3000);
  };

  // Dynamic suggested prompts for active chat
  const suggestedFollowUps = [
    'Explain how this concept applies in real-world software architecture.',
    'Can you provide a simple code example demonstrating this?',
    'What are the key trade-offs and potential edge-case pitfalls?',
  ];

  const typographyClass =
    settings.typographyScale === '12px'
      ? 'text-xs'
      : settings.typographyScale === '16px'
      ? 'text-base'
      : 'text-sm';

  const activeMobileView: 'chat' | 'search' | 'history' | 'settings' = isSettingsOpen
    ? 'settings'
    : isSidebarOpen
    ? mobileNavMode === 'search'
      ? 'search'
      : 'history'
    : 'chat';

  if (authLoading) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-4 px-4 select-none">
        <NexoraLogo variant="full" size="md" showBadge={false} />
        <div className="flex items-center gap-2 text-xs text-[var(--nx-text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--nx-accent)]" />
          <span>Verifying your session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onGoogleSignIn={handleGoogleSignIn}
        theme={settings.theme}
        onToggleTheme={handleQuickToggleTheme}
        activeModelName={activeModel}
        externalError={authError}
      />
    );
  }

  return (
    <div className={`flex h-[100dvh] w-full overflow-hidden ${typographyClass}`}>
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onTogglePin={handleTogglePin}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        user={user}
        onSignOut={handleSignOut}
        isOpen={isSidebarOpen}
        onClose={() => {
          setIsSidebarOpen(false);
          setMobileNavMode('chat');
        }}
        focusSearchTrigger={focusSearchTrigger}
      />

      {/* Main Conversation Canvas */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-transparent relative min-w-0 pb-[calc(3.5625rem+env(safe-area-inset-bottom))] sm:pb-0">
        {/* Chat Header */}
        <ChatHeader
          onToggleSidebar={() => {
            setMobileNavMode('history');
            setIsSidebarOpen(!isSidebarOpen);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenMemoryModal={() => setIsMemoryModalOpen(true)}
          onResetContext={handleResetContext}
          onClearContext={handleResetContext}
          onShare={handleShare}
          activeModelName={activeModel}
          theme={settings.theme}
          onToggleTheme={handleQuickToggleTheme}
          memoryStatus={memoryStatus}
          user={user}
          onSignOut={handleSignOut}
        />

        {/* Floating Notification Feedback */}
        {shareFeedback && (
          <div className="absolute top-16 sm:top-18 right-3 sm:right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--nx-bg-toast)] border border-[var(--nx-accent-border)] text-xs text-[var(--nx-text-heading)] shadow-xl animate-in fade-in slide-in-from-top-2">
            <Check className="w-4 h-4 text-[var(--nx-status-emerald)] shrink-0" />
            <span>{shareFeedback}</span>
          </div>
        )}

        {/* Error Notification Banner with Retry */}
        {errorBanner && (
          <div className="mx-2.5 sm:mx-4 mt-2.5 sm:mt-3 flex items-center justify-between p-3 rounded-xl bg-[var(--nx-bg-error)] border border-[var(--nx-border-error)] text-xs text-[var(--nx-text-error)] shadow-lg gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="leading-relaxed break-words">{errorBanner}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              {(lastFailedPrompt || lastFailedNewChat) && (
                <button
                  type="button"
                  onClick={() => {
                    if (lastFailedPrompt) {
                      const p = lastFailedPrompt;
                      setLastFailedPrompt(null);
                      setLastFailedNewChat(false);
                      setErrorBanner(null);
                      setMessages((prev) => {
                        if (
                          prev.length > 0 &&
                          prev[prev.length - 1].role === 'user' &&
                          prev[prev.length - 1].content === p
                        ) {
                          return prev.slice(0, -1);
                        }
                        return prev;
                      });
                      handleSendMessage(p);
                    } else if (lastFailedNewChat) {
                      handleNewChat();
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium cursor-pointer transition-colors shadow-xs"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  setLastFailedPrompt(null);
                  setLastFailedNewChat(false);
                }}
                className="text-[var(--nx-text-error-muted)] hover:text-[var(--nx-text-error)] px-2 py-1 rounded cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Chat Message Stream / New Chat Home */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 py-3 sm:py-6 flex flex-col min-w-0"
        >
          {messages.length === 0 && !streamingMessage ? (
            <NewChatHome
              onSelectPrompt={(prompt) => handleSendMessage(prompt)}
              activeModelName={activeModel}
            />
          ) : (
            <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full min-w-0 pb-2">
              {messages.map((msg, idx) => {
                const isLast = idx === messages.length - 1;
                return (
                  <ChatMessage
                    key={msg.id || idx}
                    message={msg}
                    onRegenerate={isLast && msg.role === 'assistant' ? handleRegenerate : undefined}
                    isRegenerating={isRegenerating}
                    onSuggestedPrompt={(p) => handleSendMessage(p)}
                    suggestedPrompts={isLast && msg.role === 'assistant' ? suggestedFollowUps : []}
                    activeModelName={activeModel}
                    showSyntaxHighlighting={settings.showSyntaxHighlighting}
                  />
                );
              })}

              {/* In-progress streaming chunk */}
              {isLoading && streamingMessage && (
                <ChatMessage
                  message={{
                    id: 'streaming-temp',
                    conversation_id: activeConversationId || '',
                    role: 'assistant',
                    content: streamingMessage,
                    created_at: new Date().toISOString(),
                    model: activeModel,
                  }}
                  isStreaming={true}
                  onStopStreaming={handleStopStreaming}
                  activeModelName={activeModel}
                  showSyntaxHighlighting={settings.showSyntaxHighlighting}
                />
              )}

              {/* Loading spinner if waiting for first token (Logo 2 Assistant Avatar) */}
              {isLoading && !streamingMessage && (
                <div className="flex items-center gap-3 p-4 text-xs text-[var(--nx-text-muted)]">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[#0B1221] ring-2 ring-[#38BDF8]/50 shadow-[0_0_16px_rgba(56,189,248,0.3)] animate-pulse shrink-0">
                    <img
                      src="/brand/nexora-assistant-avatar.png"
                      alt="Nexora AI is thinking"
                      className="w-full h-full object-cover block"
                    />
                  </div>
                  <span>Nexora AI is thinking with {formatModelDisplayName(activeModel)}...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Composer */}
        <MessageComposer
          input={inputMessage}
          setInput={setInputMessage}
          onSend={() => handleSendMessage()}
          isLoading={isLoading}
          sendOnEnter={settings.sendOnEnter}
        />

        {/* Mobile Navigation bar */}
        <MobileNav
          activeView={activeMobileView}
          onSelectChat={() => {
            setIsSettingsOpen(false);
            setIsSidebarOpen(false);
            setMobileNavMode('chat');
          }}
          onOpenSearch={() => {
            setIsSettingsOpen(false);
            setMobileNavMode('search');
            setIsSidebarOpen(true);
            setFocusSearchTrigger((n) => n + 1);
          }}
          onOpenHistory={() => {
            setIsSettingsOpen(false);
            setMobileNavMode('history');
            setIsSidebarOpen(true);
          }}
          onOpenSettings={() => {
            setIsSidebarOpen(false);
            setIsSettingsOpen(true);
          }}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        memoryStatus={memoryStatus}
        onClearCurrentChat={handleResetContext}
        onClearAllData={handleClearAllData}
        onExportTranscripts={handleExportTranscripts}
        activeModelName={activeModel}
        user={user}
        onSignOut={handleSignOut}
      />

      {/* Conversation Memory Inspector Modal */}
      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        memoryStatus={memoryStatus}
        onResetContext={handleResetContext}
      />

      {/* Help & Feedback Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-[var(--nx-bg-overlay)] backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--nx-bg-modal-alt)] border border-[var(--nx-border-subtle)] rounded-2xl p-5 sm:p-6 shadow-2xl text-sm">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-[#0B1221] overflow-hidden border border-[#38BDF8]/30 shrink-0">
                <img
                  src="/brand/nexora-logo-icon.png"
                  alt="Nexora AI"
                  className="w-full h-full object-cover block"
                />
              </div>
              <h3 className="font-display font-semibold text-lg text-[var(--nx-text-heading)]">Help & Feedback</h3>
            </div>
            <p className="text-xs text-[var(--nx-text-muted)] mb-4 leading-relaxed">
              Nexora AI is designed with persistent conversation memory, progressive running summaries, and state-of-the-art Google Gemini intelligence.
            </p>
            <div className="space-y-2 text-xs text-[var(--nx-text-body)] bg-[var(--nx-bg-surface)] p-3 rounded-xl border border-[var(--nx-border-subtle)] mb-4">
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-[var(--nx-text-subtle)]">Context Strategy</span>
                <span className="font-mono text-[var(--nx-accent-text)]">Last 20 msgs + Running Summary</span>
              </div>
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-[var(--nx-text-subtle)]">Configured AI Model</span>
                <span className="font-mono text-[var(--nx-text-heading)]">{formatModelDisplayName(activeModel)}</span>
              </div>
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-[var(--nx-text-subtle)]">Persistent DB</span>
                <span className="font-mono text-[var(--nx-status-emerald)]">PostgreSQL</span>
              </div>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[var(--nx-accent)] to-[var(--nx-accent-end)] hover:opacity-90 text-white text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nx-accent)] cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
