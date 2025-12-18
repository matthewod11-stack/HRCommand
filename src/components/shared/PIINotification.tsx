/**
 * PIINotification Component
 *
 * Displays a brief notification when PII has been auto-redacted.
 * Slides in from top, amber color, auto-dismisses after 3 seconds.
 *
 * Design spec (from HR-Command-Center-Design-Architecture.md):
 * - Slide in from top (200ms)
 * - Warning color background (amber)
 * - Auto-dismiss after 3 seconds
 * - Example: "Redacted: 1 SSN, 2 credit cards"
 */

import { useEffect, useState, useCallback } from 'react';

interface PIINotificationProps {
  /** Summary text (e.g., "Redacted: 1 SSN, 2 credit cards") */
  summary: string | null;
  /** Callback when notification is dismissed */
  onDismiss: () => void;
  /** Duration before auto-dismiss in ms (default: 3000) */
  duration?: number;
}

export function PIINotification({
  summary,
  onDismiss,
  duration = 3000,
}: PIINotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    // Wait for animation to complete before calling onDismiss
    setTimeout(() => {
      setIsVisible(false);
      setIsLeaving(false);
      onDismiss();
    }, 200);
  }, [onDismiss]);

  useEffect(() => {
    if (summary) {
      // Show notification
      setIsVisible(true);
      setIsLeaving(false);

      // Set up auto-dismiss timer
      const timer = setTimeout(handleDismiss, duration);

      return () => clearTimeout(timer);
    }
  }, [summary, duration, handleDismiss]);

  // Don't render if not visible or no summary
  if (!isVisible || !summary) {
    return null;
  }

  return (
    <div
      className={`
        fixed top-4 left-1/2 z-50
        flex items-center gap-2
        px-4 py-2.5
        bg-amber-50
        border border-amber-200
        rounded-lg
        shadow-lg
        text-sm
        transition-all duration-200 ease-out
        ${isLeaving
          ? 'opacity-0 -translate-y-2 -translate-x-1/2'
          : 'opacity-100 translate-y-0 -translate-x-1/2'
        }
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Shield icon - indicates protection */}
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
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>

      {/* Summary text */}
      <span className="text-amber-800 font-medium">
        {summary}
      </span>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="
          ml-1 p-0.5
          text-amber-500 hover:text-amber-700
          hover:bg-amber-100
          rounded
          transition-colors duration-150
        "
        aria-label="Dismiss notification"
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export default PIINotification;
