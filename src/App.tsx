import { useState, useCallback, useEffect } from 'react';
import { LayoutProvider } from './contexts/LayoutContext';
import { AppShell } from './components/layout/AppShell';
import { ChatInput, MessageList } from './components/chat';
import { ApiKeyInput } from './components/settings';
import { Message } from './lib/types';
import { hasApiKey, sendChatMessage, ChatMessage } from './lib/tauri-commands';

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

  const handleSubmit = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Build message history for API (convert to ChatMessage format)
      const apiMessages: ChatMessage[] = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // System prompt for HR context (will be enhanced in Phase 2)
      const systemPrompt = `You are an AI assistant for HR Command Center, helping HR professionals manage employee information and answer HR-related questions. Be helpful, professional, and concise.`;

      // Call Claude API
      const response = await sendChatMessage(apiMessages, systemPrompt);

      // Add assistant response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Handle error by adding an error message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : String(error)}\n\nPlease check your API key and try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

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
