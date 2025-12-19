import type { ChatError } from '../../lib/types';

interface ErrorMessageProps {
  error: ChatError;
  timestamp?: string;
  onRetry?: () => void;
  onCopyMessage?: () => void;
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function ErrorMessage({
  error,
  timestamp,
  onRetry,
  onCopyMessage,
}: ErrorMessageProps) {
  const showRetry = error.retryable && onRetry;
  const showCopy = error.originalContent && onCopyMessage;

  return (
    <div className="flex items-start" role="alert" aria-live="polite">
      <div
        className="
          max-w-[80%]
          px-4 py-3
          bg-red-50
          border border-red-200
          rounded-xl
          shadow-sm
        "
      >
        {/* Header with error icon and title */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-shrink-0 text-red-500">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <span className="font-medium text-red-800">{error.message}</span>
        </div>

        {/* Error details */}
        <p className="text-sm text-red-700 mb-3">{error.details}</p>

        {/* Action buttons and timestamp */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {showRetry && (
              <button
                onClick={onRetry}
                className="
                  inline-flex items-center gap-1.5
                  px-3 py-1.5
                  text-sm font-medium
                  text-red-700
                  bg-red-100
                  hover:bg-red-200
                  rounded-lg
                  transition-colors
                "
                aria-label="Retry sending message"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Retry
              </button>
            )}
            {showCopy && (
              <button
                onClick={onCopyMessage}
                className="
                  inline-flex items-center gap-1.5
                  px-3 py-1.5
                  text-sm font-medium
                  text-stone-600
                  bg-stone-100
                  hover:bg-stone-200
                  rounded-lg
                  transition-colors
                "
                aria-label="Copy original message to clipboard"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy Message
              </button>
            )}
          </div>

          {timestamp && (
            <span className="text-xs text-red-400">{formatTime(timestamp)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
