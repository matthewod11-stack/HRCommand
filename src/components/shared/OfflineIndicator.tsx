/**
 * OfflineIndicator Component
 *
 * Displays a subtle but noticeable indicator when the network is unavailable.
 * Only renders when offline to avoid UI clutter.
 */

interface OfflineIndicatorProps {
  /** Whether the network is currently offline */
  isOffline: boolean;
  /** Error message to display (optional) */
  errorMessage?: string | null;
  /** Callback to manually retry connection check */
  onRetry?: () => void;
  /** Whether a connection check is in progress */
  isChecking?: boolean;
}

export function OfflineIndicator({
  isOffline,
  errorMessage,
  onRetry,
  isChecking = false,
}: OfflineIndicatorProps) {
  // Don't render anything when online
  if (!isOffline) {
    return null;
  }

  return (
    <div
      className="
        flex items-center gap-2
        px-3 py-1.5
        bg-amber-50
        border border-amber-200/60
        rounded-lg
        text-sm
        animate-fade-in
      "
      role="alert"
      aria-live="polite"
    >
      {/* Offline icon */}
      <svg
        className="w-4 h-4 text-amber-600 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
        />
      </svg>

      {/* Status text */}
      <span className="text-amber-800 font-medium">
        Offline
      </span>

      {/* Error message tooltip or inline */}
      {errorMessage && (
        <span className="text-amber-600 text-xs hidden sm:inline">
          — {errorMessage}
        </span>
      )}

      {/* Retry button */}
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isChecking}
          className="
            ml-1 p-1
            text-amber-600 hover:text-amber-800
            hover:bg-amber-100
            rounded
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          aria-label="Retry connection"
        >
          <svg
            className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`}
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
        </button>
      )}
    </div>
  );
}

export default OfflineIndicator;
