/**
 * usePromptSuggestions Hook
 *
 * Generates contextual prompt suggestions based on the current app state:
 * - No employees: Setup-focused suggestions
 * - Employee selected: Suggestions specific to that employee
 * - General: Analytics, anniversaries, team insights
 */

import { useMemo } from 'react';
import { useEmployees } from '../contexts/EmployeeContext';
import type { PromptSuggestion } from '../components/chat/PromptSuggestions';

interface UsePromptSuggestionsResult {
  /** Contextual suggestions based on current state */
  suggestions: PromptSuggestion[];
  /** Current context mode for UI hints */
  context: 'empty' | 'employee-selected' | 'general';
  /** The selected employee's name (if any) */
  selectedEmployeeName: string | null;
}

/**
 * Setup suggestions when no employees exist
 */
const SETUP_SUGGESTIONS: PromptSuggestion[] = [
  {
    text: 'Help me set up my employee database',
    icon: '📋',
    category: 'getting-started',
  },
  {
    text: 'What data should I import?',
    icon: '❓',
    category: 'getting-started',
  },
  {
    text: 'What can you help me with?',
    icon: '💡',
    category: 'getting-started',
  },
];

/**
 * General suggestions when employees exist but none selected
 */
const GENERAL_SUGGESTIONS: PromptSuggestion[] = [
  {
    text: 'Who has an anniversary this month?',
    icon: '🎂',
    category: 'people',
  },
  {
    text: "What's our team eNPS?",
    icon: '📊',
    category: 'analytics',
  },
  {
    text: 'Who are our top performers?',
    icon: '⭐',
    category: 'analytics',
  },
  {
    text: 'Help me draft a performance review',
    icon: '✍️',
    category: 'general',
  },
  {
    text: 'Who are our newest hires?',
    icon: '👋',
    category: 'people',
  },
  {
    text: 'Any employees needing attention?',
    icon: '🔔',
    category: 'people',
  },
];

/**
 * Extract first name from full name
 */
function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] || fullName;
}

/**
 * Get suggestions specific to a selected employee
 */
function getEmployeeSuggestions(
  fullName: string,
  hasRating: boolean
): PromptSuggestion[] {
  const firstName = getFirstName(fullName);

  const suggestions: PromptSuggestion[] = [
    {
      text: `Write a performance review for ${firstName}`,
      icon: '✍️',
      category: 'general',
    },
    {
      text: `What's ${firstName}'s tenure?`,
      icon: '📅',
      category: 'people',
    },
    {
      text: `Summarize ${firstName}'s performance history`,
      icon: '📈',
      category: 'analytics',
    },
  ];

  if (hasRating) {
    suggestions.push({
      text: `How does ${firstName} compare to the team?`,
      icon: '🔍',
      category: 'analytics',
    });
  }

  suggestions.push({
    text: `Draft feedback for ${firstName}`,
    icon: '💬',
    category: 'general',
  });

  return suggestions;
}

export function usePromptSuggestions(): UsePromptSuggestionsResult {
  const { employees, selectedEmployee, isLoading } = useEmployees();

  const result = useMemo((): UsePromptSuggestionsResult => {
    // Still loading — return empty
    if (isLoading) {
      return {
        suggestions: [],
        context: 'general',
        selectedEmployeeName: null,
      };
    }

    // No employees loaded — show setup suggestions
    if (employees.length === 0) {
      return {
        suggestions: SETUP_SUGGESTIONS,
        context: 'empty',
        selectedEmployeeName: null,
      };
    }

    // Employee selected — show employee-specific suggestions
    if (selectedEmployee) {
      const fullName = selectedEmployee.full_name;
      const hasRating = !!selectedEmployee.latestRating;

      return {
        suggestions: getEmployeeSuggestions(fullName, hasRating),
        context: 'employee-selected',
        selectedEmployeeName: fullName,
      };
    }

    // General state — employees exist, none selected
    return {
      suggestions: GENERAL_SUGGESTIONS,
      context: 'general',
      selectedEmployeeName: null,
    };
  }, [employees.length, selectedEmployee, isLoading]);

  return result;
}

export default usePromptSuggestions;
