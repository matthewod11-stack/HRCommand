/**
 * MessageList Component
 *
 * Displays a scrollable list of chat messages with smart spacing based on
 * speaker changes. Shows welcome content when no messages exist.
 */

import { useRef, useEffect } from 'react';
import { Message } from '../../lib/types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  /** Array of messages to display */
  messages: Message[];
  /** Shows typing indicator when true */
  isLoading?: boolean;
  /** Callback when a prompt suggestion is clicked */
  onPromptClick?: (prompt: string) => void;
}

/**
 * Returns appropriate spacing class based on speaker changes
 * Same speaker: 16px (mt-4), Different speaker: 24px (mt-6)
 */
function getMessageSpacing(
  current: Message,
  previous: Message | undefined
): string {
  if (!previous) return '';
  return current.role !== previous.role ? 'mt-6' : 'mt-4';
}

/**
 * Welcome content shown when no messages exist
 */
function WelcomeContent({
  onPromptClick,
}: {
  onPromptClick?: (prompt: string) => void;
}) {
  const suggestions = [
    'Who has an anniversary this month?',
    'Help with a performance review',
    'Draft a PTO policy update',
  ];

  return (
    <div className="flex-1 flex flex-col justify-center items-center text-center py-12">
      {/* Icon */}
      <div
        className="
          w-16 h-16 mb-6
          rounded-2xl
          bg-gradient-to-br from-primary-100 to-primary-50
          flex items-center justify-center
          shadow-sm
        "
      >
        <svg
          className="w-8 h-8 text-primary-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
      </div>

      {/* Heading */}
      <h2 className="font-display text-xl font-semibold text-stone-800 mb-2">
        What can I help with?
      </h2>

      {/* Description */}
      <p className="text-stone-500 max-w-sm mb-8">
        Ask me anything about your team—performance reviews, PTO policies,
        onboarding, or employee questions.
      </p>

      {/* Prompt suggestions */}
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {suggestions.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onPromptClick?.(prompt)}
            className="
              px-4 py-2
              bg-white
              border border-stone-200/80
              rounded-full
              text-sm text-stone-600
              hover:border-primary-300 hover:text-primary-600
              hover:shadow-sm
              transition-all duration-200
            "
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  isLoading = false,
  onPromptClick,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or loading starts
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  // Empty state - show welcome content
  if (messages.length === 0) {
    return <WelcomeContent onPromptClick={onPromptClick} />;
  }

  // Messages list
  return (
    <div
      className="flex-1 overflow-y-auto"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      <div className="py-4">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={getMessageSpacing(message, messages[index - 1])}
          >
            <MessageBubble
              content={message.content}
              role={message.role}
              timestamp={message.timestamp}
            />
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && <TypingIndicator className="mt-4" />}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default MessageList;
