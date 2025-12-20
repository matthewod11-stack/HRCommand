/**
 * useMondayDigest Hook
 *
 * Manages the Monday Digest feature - shows work anniversaries and new hires
 * on the first app launch of each week. Dismissing hides until next week.
 */

import { useState, useEffect, useCallback } from 'react';
import { getDigestData, getSetting, setSetting, DigestEmployee } from '../lib/tauri-commands';

/**
 * Get ISO week string for a date (e.g., "2025-W51")
 * This handles year boundaries correctly (Dec 31 might be in W01 of next year)
 */
function getISOWeekString(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  // ISO weeks start on Monday. Get the Thursday of this week to determine the year.
  // Thursday is used because it's always in the same week year as the Monday.
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));

  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

const DIGEST_DISMISSED_KEY = 'monday_digest_dismissed_week';

export interface UseMondayDigestResult {
  /** Whether the digest should be visible */
  isVisible: boolean;
  /** Whether digest data is loading */
  isLoading: boolean;
  /** Employees with anniversaries this week */
  anniversaries: DigestEmployee[];
  /** New hires (last 90 days) */
  newHires: DigestEmployee[];
  /** Dismiss the digest until next week */
  dismiss: () => void;
}

export function useMondayDigest(): UseMondayDigestResult {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [anniversaries, setAnniversaries] = useState<DigestEmployee[]>([]);
  const [newHires, setNewHires] = useState<DigestEmployee[]>([]);

  useEffect(() => {
    let cancelled = false;

    const initializeDigest = async () => {
      try {
        const currentWeek = getISOWeekString(new Date());

        // Check if already dismissed this week
        const dismissedWeek = await getSetting(DIGEST_DISMISSED_KEY);

        if (dismissedWeek === currentWeek) {
          // Already dismissed this week - don't show
          setIsVisible(false);
          setIsLoading(false);
          return;
        }

        // Fetch digest data
        const data = await getDigestData();

        if (cancelled) return;

        setAnniversaries(data.anniversaries);
        setNewHires(data.new_hires);

        // Only show if there's data to display
        const hasData = data.anniversaries.length > 0 || data.new_hires.length > 0;
        setIsVisible(hasData);
      } catch (error) {
        console.error('Failed to load Monday Digest:', error);
        setIsVisible(false);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    initializeDigest();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(async () => {
    const currentWeek = getISOWeekString(new Date());

    try {
      await setSetting(DIGEST_DISMISSED_KEY, currentWeek);
    } catch (error) {
      console.error('Failed to save digest dismissal:', error);
    }

    setIsVisible(false);
  }, []);

  return {
    isVisible,
    isLoading,
    anniversaries,
    newHires,
    dismiss,
  };
}

export default useMondayDigest;
