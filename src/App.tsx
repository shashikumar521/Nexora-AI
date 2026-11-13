import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message, MemoryStatus, AppSettings } from './types';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatMessage } from './components/ChatMessage';
import { MessageComposer } from './components/MessageComposer';
import { NewChatHome } from './components/NewChatHome';
import { SettingsModal } from './components/SettingsModal';
import { MemoryModal } from './components/MemoryModal';
import { MobileNav } from './components/MobileNav';
import { formatModelDisplayName } from './utils/format';
import { AlertCircle, Check, RotateCw } from 'lucide-react';

export default function App() {
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
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    typographyScale: '14px',
    sendOnEnter: true,
    streamResponses: true,
    showSyntaxHighlighting: true,
    language: 'en-US',
    model: '',
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Current active model to display everywhere
  const activeModel = backendModel || settings.model || 'gemini-3.1-flash-lite';

  // Apply theme to HTML root
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const isDark =
      settings.theme === 'dark' ||
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      body.style.backgroundColor = '#0B0F19';
      body.style.color = '#F8FAFC';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      body.style.backgroundColor = '#F8FAFF';
      body.style.color = '#172033';
    }
  }, [settings.theme]);

  // Load initial settings and conversations
  useEffect(() => {
    loadSettings();
    loadConversations();
  }, []);

  // When active conversation changes, load messages & memory status
  useEffect(() => {
    if (activeConversationId) {
      loadConversationMessages(activeConversationId);
      loadMemoryStatus(activeConversationId);
    } else {
      setMessages([]);
      setMemoryStatus(null);
    }
  }, [activeConversationId]);

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
  }, [isLoading]);

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
      const newConv = await api.createConversation('New Chat');
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setInputMessage('');
    } catch (e: any) {
      setErrorBanner(e?.message || 'Failed to create new conversation');
    }
  };

  const handleSelectConversation = (id: string) => {
    setErrorBanner(null);
    setLastFailedPrompt(null);
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
    try {
      await handleSaveSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
    } catch (e: any) {
      setErrorBanner(e?.message || 'Failed to save theme setting.');
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
        />

        {/* Floating Notification Feedback */}
        {shareFeedback && (
          <div className="absolute top-16 sm:top-18 right-3 sm:right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E293B] border border-[#6366F1]/40 text-xs text-white shadow-xl animate-in fade-in slide-in-from-top-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{shareFeedback}</span>
          </div>
        )}

        {/* Error Notification Banner with Retry */}
        {errorBanner && (
          <div className="mx-2.5 sm:mx-4 mt-2.5 sm:mt-3 flex items-center justify-between p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-xs text-red-200 shadow-lg gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="leading-relaxed break-words">{errorBanner}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              {lastFailedPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    const p = lastFailedPrompt;
                    setLastFailedPrompt(null);
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
                }}
                className="text-red-300 hover:text-white px-2 py-1 rounded cursor-pointer"
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

              {/* Loading spinner if waiting for first token */}
              {isLoading && !streamingMessage && (
                <div className="flex items-center gap-3 p-4 text-xs text-[#94A3B8]">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center animate-pulse shrink-0">
                    <span className="w-2 h-2 rounded-full bg-white" />
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#0F172A] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl text-sm">
            <h3 className="font-display font-semibold text-lg text-white mb-2">Help & Feedback</h3>
            <p className="text-xs text-[#94A3B8] mb-4 leading-relaxed">
              Nexora AI is designed with persistent conversation memory, progressive running summaries, and state-of-the-art Google Gemini intelligence.
            </p>
            <div className="space-y-2 text-xs text-[#CBD5E1] bg-[#111827] p-3 rounded-xl border border-white/5 mb-4">
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-[#64748B]">Context Strategy</span>
                <span className="font-mono text-[#818CF8]">Last 20 msgs + Running Summary</span>
              </div>
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-[#64748B]">Configured AI Model</span>
                <span className="font-mono text-white">{formatModelDisplayName(activeModel)}</span>
              </div>
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-[#64748B]">Persistent DB</span>
                <span className="font-mono text-emerald-400">PostgreSQL</span>
              </div>
            </div>
            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white text-xs font-medium cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
