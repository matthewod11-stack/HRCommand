import { useState, useCallback, useEffect } from 'react';
import { LayoutProvider } from './contexts/LayoutContext';
import { AppShell } from './components/layout/AppShell';
import { ChatInput, MessageList } from './components/chat';
import { ApiKeyInput } from './components/settings';
import { Message } from './lib/types';
import { hasApiKey } from './lib/tauri-commands';

function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  // Check for API key on mount
  useEffect(() => {
    hasApiKey()
      .then(setHasKey)
      .catch(() => setHasKey(false));
  }, []);

  const handleApiKeySaved = useCallback(() => {
    setHasKey(true);
  }, []);

  const handleSubmit = useCallback((content: string) => {
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // TODO: Wire to Claude API in task 1.4
    // For now, simulate an assistant response
    setIsLoading(true);
    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I received your message: "${content}"\n\nThis is a placeholder response. Claude API integration coming in Phase 1.4!`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  }, []);

  const handlePromptClick = useCallback(
    (prompt: string) => {
      handleSubmit(prompt);
    },
    [handleSubmit]
  );

  // Show nothing while checking for API key
  if (hasKey === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading...</div>
      </div>
    );
  }

  // Show API key setup if not configured
  if (!hasKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="font-display text-2xl text-stone-800 mb-2 text-center">
            Welcome to HR Command Center
          </h2>
          <p className="text-stone-600 text-center mb-6">
            Enter your Anthropic API key to get started.
          </p>
          <ApiKeyInput onSave={handleApiKeySaved} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        onPromptClick={handlePromptClick}
      />
      <ChatInput onSubmit={handleSubmit} disabled={isLoading} />
    </div>
  );
}

function App() {
  return (
    <LayoutProvider>
      <AppShell>
        <ChatArea />
      </AppShell>
    </LayoutProvider>
  );
}

export default App;
