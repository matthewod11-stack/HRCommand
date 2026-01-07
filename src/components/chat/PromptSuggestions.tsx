/**
 * PromptSuggestions Component
 *
 * Displays clickable prompt suggestions to help users get started.
 * Supports two visual variants:
 * - 'welcome': Larger pill buttons for empty state (default)
 * - 'inline': Compact links for contextual hints
 */

import { useMemo } from 'react';

export interface PromptSuggestion {
  /** The prompt text to display and send when clicked */
  text: string;
  /** Optional icon name or emoji to show before text */
  icon?: string;
  /** Optional category for grouping (used in welcome variant) */
  category?: 'getting-started' | 'analytics' | 'people' | 'general';
}

interface PromptSuggestionsProps {
  /** Array of suggestions to display */
  suggestions: PromptSuggestion[];
  /** Callback when a suggestion is selected */
  onSelect: (text: string) => void;
  /** Visual variant: 'welcome' for empty state, 'inline' for compact display */
  variant?: 'welcome' | 'inline';
  /** Optional className for container */
  className?: string;
  /** Maximum number of suggestions to show (default: all) */
  maxSuggestions?: number;
}

/**
 * Welcome variant: Pill buttons arranged in a flex wrap
 */
function WelcomeVariant({
  suggestions,
  onSelect,
  className = '',
}: {
  suggestions: PromptSuggestion[];
  onSelect: (text: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 justify-center ${className}`}>
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          onClick={() => onSelect(suggestion.text)}
          className="
            px-4 py-2
            bg-white
            border border-stone-200/80
            rounded-full
            text-sm text-stone-600
            hover:border-primary-300 hover:text-primary-600
            hover:shadow-sm
            transition-all duration-200
            flex items-center gap-2
          "
        >
          {suggestion.icon && (
            <span className="text-base">{suggestion.icon}</span>
          )}
          {suggestion.text}
        </button>
      ))}
    </div>
  );
}

/**
 * Inline variant: Compact horizontal list of clickable text links
 */
function InlineVariant({
  suggestions,
  onSelect,
  className = '',
}: {
  suggestions: PromptSuggestion[];
  onSelect: (text: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <span className="text-xs text-stone-500 uppercase tracking-wide">
        Try:
      </span>
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          onClick={() => onSelect(suggestion.text)}
          className="
            text-sm text-primary-600
            hover:text-primary-700 hover:underline
            transition-colors duration-150
          "
        >
          {suggestion.icon && (
            <span className="mr-1">{suggestion.icon}</span>
          )}
          {suggestion.text}
        </button>
      ))}
    </div>
  );
}

export function PromptSuggestions({
  suggestions,
  onSelect,
  variant = 'welcome',
  className = '',
  maxSuggestions,
}: PromptSuggestionsProps) {
  // Limit suggestions if maxSuggestions is set
  const displaySuggestions = useMemo(() => {
    if (maxSuggestions && maxSuggestions > 0) {
      return suggestions.slice(0, maxSuggestions);
    }
    return suggestions;
  }, [suggestions, maxSuggestions]);

  if (displaySuggestions.length === 0) {
    return null;
  }

  if (variant === 'inline') {
    return (
      <InlineVariant
        suggestions={displaySuggestions}
        onSelect={onSelect}
        className={className}
      />
    );
  }

  return (
    <WelcomeVariant
      suggestions={displaySuggestions}
      onSelect={onSelect}
      className={className}
    />
  );
}

export default PromptSuggestions;
