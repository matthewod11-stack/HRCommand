/**
 * MessageBubble Component
 *
 * Displays a single chat message with appropriate styling for user or assistant messages.
 * Follows the HR Command Center "Warm Editorial" design aesthetic.
 */

/**
 * Formats an ISO timestamp string to a user-friendly time display
 * @param isoString - ISO 8601 timestamp
 * @returns Formatted time string (e.g., "2:34 PM")
 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

interface MessageBubbleProps {
  /** The message content to display */
  content: string;
  /** Whether this is a user or assistant message */
  role: 'user' | 'assistant';
  /** ISO timestamp for the message */
  timestamp?: string;
  /** Whether to show the timestamp (defaults to true) */
  showTimestamp?: boolean;
}

export function MessageBubble({
  content,
  role,
  timestamp,
  showTimestamp = true,
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const formattedTime = timestamp ? formatTime(timestamp) : null;

  return (
    <div
      className={`
        flex flex-col
        ${isUser ? 'items-end' : 'items-start'}
      `}
      role="article"
      aria-label={`${isUser ? 'Your' : 'Assistant'} message`}
    >
      <div
        className={`
          px-4 py-3
          rounded-xl
          max-w-[80%]
          ${isUser
            ? 'bg-primary-500 text-white'
            : 'bg-stone-100 text-stone-900'
          }
        `}
      >
        <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
          {content || '\u00A0'}
        </p>

        {showTimestamp && formattedTime && (
          <span
            className={`
              block text-right text-xs mt-2
              ${isUser ? 'text-white/70' : 'text-stone-400'}
            `}
            aria-label={`Sent at ${formattedTime}`}
          >
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
