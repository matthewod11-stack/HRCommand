import { useState, useCallback } from 'react';
import { LayoutProvider } from './contexts/LayoutContext';
import { AppShell } from './components/layout/AppShell';
import { ChatInput, MessageList } from './components/chat';
import { Message } from './lib/types';

function ChatArea() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
