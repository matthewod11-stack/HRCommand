/**
 * PersonaSelector Component
 *
 * Displays persona cards with preview samples, allowing users to
 * select their preferred HR assistant style. Selection is persisted
 * to settings and takes effect immediately on the next message.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getPersonas,
  getSetting,
  setSetting,
  type Persona,
} from '../../lib/tauri-commands';

interface PersonaSelectorProps {
  /** Compact mode for settings panel (less padding) */
  compact?: boolean;
}

export function PersonaSelector({ compact = false }: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<string>('alex');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load personas and current selection on mount
  useEffect(() => {
    Promise.all([getPersonas(), getSetting('persona')])
      .then(([personaList, currentPersona]) => {
        setPersonas(personaList);
        setSelectedId(currentPersona || 'alex');
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleSelect = useCallback(
    async (id: string) => {
      const previousId = selectedId;
      setSelectedId(id);
      try {
        await setSetting('persona', id);
      } catch {
        // Revert on error
        setSelectedId(previousId);
      }
    },
    [selectedId]
  );

  const handleTogglePreview = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setExpandedId(expandedId === id ? null : id);
    },
    [expandedId]
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-stone-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {personas.map((persona) => (
        <div key={persona.id}>
          {/* Persona Card */}
          <button
            type="button"
            onClick={() => handleSelect(persona.id)}
            className={`
              w-full text-left p-3 rounded-xl border-2 transition-all
              ${
                selectedId === persona.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-stone-200 hover:border-stone-300 bg-stone-50'
              }
            `}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-stone-800">
                    {persona.name}
                  </span>
                  {selectedId === persona.id && (
                    <span className="text-primary-600">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-600 mt-0.5">{persona.style}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  Best for: {persona.best_for}
                </p>
              </div>

              {/* Preview toggle */}
              <button
                type="button"
                onClick={(e) => handleTogglePreview(e, persona.id)}
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-200 rounded-lg transition-colors flex-shrink-0"
                aria-label="Preview response style"
                title="Preview response style"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${
                    expandedId === persona.id ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </button>

          {/* Sample Response Preview */}
          {expandedId === persona.id && (
            <div className="mt-2 p-3 bg-white border border-stone-200 rounded-lg">
              <p className="text-xs text-stone-500 mb-1.5">
                Sample response style:
              </p>
              <p className="text-sm text-stone-700 italic">
                &ldquo;{persona.sample_response}&rdquo;
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default PersonaSelector;
