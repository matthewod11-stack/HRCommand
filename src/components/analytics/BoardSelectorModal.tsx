/**
 * BoardSelectorModal Component (V2.3.2h)
 *
 * Modal for selecting or creating an insight board when pinning a chart.
 */

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../ui/Button';
import {
  listInsightBoards,
  createInsightBoard,
  type InsightBoardListItem,
} from '../../lib/tauri-commands';

interface BoardSelectorModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Called when a board is selected */
  onSelect: (boardId: string, boardName: string) => void;
  /** Chart title (used as hint for new board name) */
  chartTitle?: string;
}

export function BoardSelectorModal({
  isOpen,
  onClose,
  onSelect,
  chartTitle,
}: BoardSelectorModalProps) {
  const [boards, setBoards] = useState<InsightBoardListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New board creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch boards on mount
  useEffect(() => {
    if (!isOpen) return;

    const fetchBoards = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await listInsightBoards();
        setBoards(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load boards');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBoards();
  }, [isOpen]);

  // Handle board selection
  const handleSelect = useCallback(
    (board: InsightBoardListItem) => {
      onSelect(board.id, board.name);
      onClose();
    },
    [onSelect, onClose]
  );

  // Handle new board creation
  const handleCreate = useCallback(async () => {
    if (!newBoardName.trim()) {
      setCreateError('Board name is required');
      return;
    }

    setCreateError(null);
    try {
      const created = await createInsightBoard({ name: newBoardName.trim() });
      onSelect(created.id, created.name);
      onClose();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create board'
      );
    }
  }, [newBoardName, onSelect, onClose]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setIsCreating(false);
      setNewBoardName('');
      setCreateError(null);
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pin to Canvas" maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-8 text-stone-500">
            Loading boards...
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-8 text-red-600">{error}</div>
        )}

        {/* Board list */}
        {!isLoading && !error && (
          <>
            {boards.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-stone-600 mb-3">
                  Select a board or create a new one:
                </p>
                {boards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => handleSelect(board)}
                    className="
                      w-full p-3 text-left rounded-lg border border-stone-200
                      hover:bg-stone-50 hover:border-stone-300
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                      transition-colors duration-150
                    "
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-stone-800">
                        {board.name}
                      </span>
                      <span className="text-xs text-stone-500">
                        {board.chart_count} {board.chart_count === 1 ? 'chart' : 'charts'}
                      </span>
                    </div>
                    {board.description && (
                      <p className="text-sm text-stone-500 mt-1 line-clamp-1">
                        {board.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-stone-500">
                No boards yet. Create your first one below.
              </p>
            )}

            {/* Divider */}
            <div className="border-t border-stone-200 pt-4 mt-4">
              {isCreating ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">
                      Board Name
                    </span>
                    <input
                      type="text"
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      placeholder="e.g., Q1 Review, Leadership Dashboard"
                      className="
                        mt-1 w-full px-3 py-2 rounded-lg border border-stone-300
                        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                        text-sm
                      "
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreate();
                        if (e.key === 'Escape') setIsCreating(false);
                      }}
                    />
                  </label>
                  {createError && (
                    <p className="text-sm text-red-600">{createError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsCreating(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCreate}
                      disabled={!newBoardName.trim()}
                    >
                      Create Board
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setIsCreating(true);
                    // Pre-fill with chart-inspired name if no boards exist
                    if (boards.length === 0 && chartTitle) {
                      setNewBoardName('Analytics Dashboard');
                    }
                  }}
                  leftIcon={
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  }
                >
                  Create New Board
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default BoardSelectorModal;
