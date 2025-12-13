/**
 * TypingIndicator Component
 *
 * Displays an animated "typing" indicator that matches the assistant message
 * bubble styling. Shows three bouncing dots to indicate the assistant is
 * composing a response.
 */

interface TypingIndicatorProps {
  /** Additional CSS classes to apply to the container */
  className?: string;
}

export function TypingIndicator({ className = '' }: TypingIndicatorProps) {
  return (
    <div
      className={`flex items-start ${className}`}
      role="status"
      aria-label="Assistant is typing"
    >
      <div className="bg-stone-100 rounded-xl px-4 py-3">
        <div className="flex gap-1.5 items-center h-5">
          <span
            className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
            style={{ animationDuration: '0.6s' }}
          />
          <span
            className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
            style={{ animationDuration: '0.6s', animationDelay: '0.15s' }}
          />
          <span
            className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
            style={{ animationDuration: '0.6s', animationDelay: '0.3s' }}
          />
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;
