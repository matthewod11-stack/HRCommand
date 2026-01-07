/**
 * MondayDigest Component
 *
 * Displays a weekly digest card showing:
 * - Work anniversaries this week
 * - New team members (hired in last 90 days)
 *
 * Appears on first app launch of each week, dismissable until next week.
 */

import { useState, useCallback } from 'react';
import { DigestEmployee } from '../../lib/tauri-commands';

interface MondayDigestProps {
  /** Employees with anniversaries this week */
  anniversaries: DigestEmployee[];
  /** New hires (last 90 days) */
  newHires: DigestEmployee[];
  /** Callback when dismiss button is clicked */
  onDismiss: () => void;
}

/**
 * Format tenure for display
 */
function formatTenure(years: number): string {
  if (years === 1) return '1 year';
  return `${years} years`;
}

/**
 * Format days since start for display
 */
function formatDaysSinceStart(days: number): string {
  if (days === 0) return 'Started today';
  if (days === 1) return 'Started yesterday';
  if (days < 7) return `Started ${days} days ago`;
  if (days < 14) return 'Started last week';
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `Started ${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return 'Started 1 month ago';
  return `Started ${months} months ago`;
}

export function MondayDigest({
  anniversaries,
  newHires,
  onDismiss,
}: MondayDigestProps) {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    // Wait for animation before calling onDismiss
    setTimeout(() => {
      onDismiss();
    }, 200);
  }, [onDismiss]);

  // Don't render if no data
  if (anniversaries.length === 0 && newHires.length === 0) {
    return null;
  }

  return (
    <div
      className={`
        w-full max-w-lg mb-8
        bg-gradient-to-br from-primary-50 to-blue-50
        border border-primary-200
        rounded-xl
        shadow-sm
        overflow-hidden
        transition-all duration-200 ease-out
        ${isLeaving ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}
      `}
      role="region"
      aria-label="Weekly digest"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary-100/50 border-b border-primary-200">
        <div className="flex items-center gap-2">
          {/* Sparkles icon */}
          <svg
            className="w-5 h-5 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
            />
          </svg>
          <span className="font-semibold text-primary-800">Weekly Digest</span>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="
            p-1.5
            text-primary-500 hover:text-primary-700
            hover:bg-primary-200/50
            rounded-lg
            transition-colors duration-150
          "
          aria-label="Dismiss digest"
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

      {/* Content */}
      <div className="px-4 py-3 space-y-4">
        {/* Anniversaries Section */}
        {anniversaries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              {/* Cake icon */}
              <svg
                className="w-4 h-4 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m18-3.5H3M21 21v-7.5a1.5 1.5 0 00-1.5-1.5h-15A1.5 1.5 0 003 13.5V21"
                />
              </svg>
              <h3 className="text-sm font-medium text-stone-700">
                Work Anniversaries
              </h3>
            </div>
            <ul className="space-y-1.5">
              {anniversaries.map((emp) => (
                <li
                  key={emp.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-stone-800 font-medium">
                    {emp.full_name}
                  </span>
                  <span className="text-stone-500">
                    {emp.years_tenure ? formatTenure(emp.years_tenure) : ''}
                    {emp.department && (
                      <span className="text-stone-500 ml-1">
                        · {emp.department}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* New Hires Section */}
        {newHires.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              {/* Hand wave icon */}
              <svg
                className="w-4 h-4 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 013.15 0V15M6.9 7.575a1.575 1.575 0 10-3.15 0v8.175a6.75 6.75 0 006.75 6.75h2.018a5.25 5.25 0 003.712-1.538l1.732-1.732a5.25 5.25 0 001.538-3.712l.003-2.024a.668.668 0 01.198-.471 1.575 1.575 0 10-2.228-2.228 3.818 3.818 0 00-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0116.35 15m.002 0h-.002"
                />
              </svg>
              <h3 className="text-sm font-medium text-stone-700">
                New Team Members
              </h3>
            </div>
            <ul className="space-y-1.5">
              {newHires.map((emp) => (
                <li
                  key={emp.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-stone-800 font-medium">
                    {emp.full_name}
                  </span>
                  <span className="text-stone-500">
                    {emp.days_since_start !== undefined
                      ? formatDaysSinceStart(emp.days_since_start)
                      : ''}
                    {emp.department && (
                      <span className="text-stone-500 ml-1">
                        · {emp.department}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default MondayDigest;
