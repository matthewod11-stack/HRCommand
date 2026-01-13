/**
 * InsightBoardPanel Component (V2.3.2i)
 *
 * Sidebar panel for managing insight boards.
 * Lists all boards with chart counts and provides create/delete actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import {
  listInsightBoards,
  createInsightBoard,
  deleteInsightBoard,
  type InsightBoardListItem,
} from '../../lib/tauri-commands';

interface InsightBoardPanelProps {
  /** Called when a board is selected for viewing */
  onBoardSelect: (boardId: string) => void;
}

export function InsightBoardPanel({ onBoardSelect }: InsightBoardPanelProps) {
  const [boards, setBoards] = useState<InsightBoardListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New board creation
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  // Load boards
  const loadBoards = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  // Create new board
  const handleCreate = useCallback(async () => {
    if (!newBoardName.trim()) return;

    try {
      const created = await createInsightBoard({ name: newBoardName.trim() });
      setNewBoardName('');
      setIsCreating(false);
      // Open the new board immediately
      onBoardSelect(created.id);
      // Refresh list
      loadBoards();
    } catch (err) {
      console.error('[InsightBoardPanel] Create failed:', err);
    }
  }, [newBoardName, onBoardSelect, loadBoards]);

  // Delete board (with confirmation)
  const handleDelete = useCallback(
    async (e: React.MouseEvent, boardId: string, boardName: string) => {
      e.stopPropagation();
      if (!confirm(`Delete "${boardName}" and all its pinned charts?`)) return;

      try {
        await deleteInsightBoard(boardId);
        loadBoards();
      } catch (err) {
        console.error('[InsightBoardPanel] Delete failed:', err);
      }
    },
    [loadBoards]
  );

  // Format relative time
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-stone-200/60">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wider">
            Insight Boards
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreating(true)}
            leftIcon={
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            New
          </Button>
        </div>

        {/* New board input */}
        {isCreating && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Board name..."
              className="
                flex-1 px-2 py-1.5 text-sm rounded-md
                border border-stone-300 focus:border-primary-500
                focus:outline-none focus:ring-1 focus:ring-primary-500
              "
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewBoardName('');
                }
              }}
            />
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!newBoardName.trim()}>
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Board list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-stone-500 text-sm">Loading...</div>
        ) : error ? (
          <div className="p-4 text-center text-red-600 text-sm">{error}</div>
        ) : boards.length === 0 ? (
          <div className="p-4 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary-50 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-primary-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605"
                />
              </svg>
            </div>
            <p className="text-sm text-stone-600 font-medium mb-1">No boards yet</p>
            <p className="text-xs text-stone-500">
              Pin charts from analytics queries to create your first board.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => onBoardSelect(board.id)}
                className="
                  w-full p-3 text-left rounded-lg
                  hover:bg-white hover:shadow-sm
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                  transition-all duration-150
                  group
                "
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800 truncate">{board.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {board.chart_count} {board.chart_count === 1 ? 'chart' : 'charts'} ·{' '}
                      {formatDate(board.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, board.id, board.name)}
                    className="
                      p-1.5 rounded-md
                      text-stone-400 hover:text-red-600 hover:bg-red-50
                      opacity-0 group-hover:opacity-100
                      transition-all duration-150
                    "
                    aria-label={`Delete ${board.name}`}
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
                {board.description && (
                  <p className="text-xs text-stone-500 mt-1 line-clamp-1">{board.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InsightBoardPanel;
