import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatInputProps {
  /** Callback when user submits a message (called with trimmed text) */
  onSubmit: (message: string) => void;
  /** Disables input and submit button */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

const MAX_HEIGHT = 200;

export function ChatInput({
  onSubmit,
  disabled = false,
  placeholder = 'Ask a question...',
  autoFocus = true,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSubmitDisabled = disabled || !message.trim();

  // Auto-resize textarea based on content
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Adjust height when message changes
  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
      setMessage('');
    }
  }, [message, disabled, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift = submit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter allows newline (default behavior)
  };

  return (
    <div className="py-4">
      <div
        className={`
          flex items-end gap-3
          px-4 py-3
          bg-white
          border border-stone-200
          rounded-xl
          shadow-sm
          focus-within:border-primary-300
          focus-within:ring-2 focus-within:ring-primary-100
          transition-all duration-200
          ${disabled ? 'opacity-60' : ''}
        `}
      >
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label="Message input"
          className={`
            flex-1
            bg-transparent
            text-stone-700
            placeholder:text-stone-400
            focus:outline-none
            resize-none
            min-h-[24px]
            max-h-[200px]
            leading-6
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
          aria-label="Send message"
          className={`
            w-9 h-9
            flex-shrink-0
            flex items-center justify-center
            rounded-lg
            transition-all duration-200
            ${
              isSubmitDisabled
                ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                : 'bg-primary-500 hover:bg-primary-600 text-white hover:scale-105 active:scale-95'
            }
          `}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatInput;
