/**
 * InsightBoardView Component (V2.3.2i)
 *
 * Modal view for displaying and managing a single insight board.
 * Shows pinned charts in a responsive grid with unpin/edit capabilities.
 */

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../ui/Button';
import { AnalyticsChart } from '../analytics/AnalyticsChart';
import {
  getInsightBoard,
  getChartsForBoard,
  updateInsightBoard,
  unpinChart,
  type InsightBoard,
  type PinnedChart,
} from '../../lib/tauri-commands';
import { parseChartData, parseAnalyticsRequestFromChart } from '../../lib/insight-canvas-types';

interface InsightBoardViewProps {
  /** Board ID to display */
  boardId: string | null;
  /** Called when modal should close */
  onClose: () => void;
}

export function InsightBoardView({ boardId, onClose }: InsightBoardViewProps) {
  const [board, setBoard] = useState<InsightBoard | null>(null);
  const [charts, setCharts] = useState<PinnedChart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode for board name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  // Load board and charts
  const loadBoard = useCallback(async () => {
    if (!boardId) return;

    setIsLoading(true);
    setError(null);
    try {
      const [boardData, chartsData] = await Promise.all([
        getInsightBoard(boardId),
        getChartsForBoard(boardId),
      ]);
      setBoard(boardData);
      setCharts(chartsData);
      setEditName(boardData.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      setIsLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (boardId) {
      loadBoard();
    }
  }, [boardId, loadBoard]);

  // Update board name
  const handleSaveName = useCallback(async () => {
    if (!board || !editName.trim() || editName === board.name) {
      setIsEditingName(false);
      return;
    }

    try {
      const updated = await updateInsightBoard(board.id, { name: editName.trim() });
      setBoard(updated);
      setIsEditingName(false);
    } catch (err) {
      console.error('[InsightBoardView] Rename failed:', err);
    }
  }, [board, editName]);

  // Unpin a chart
  const handleUnpin = useCallback(
    async (chartId: string) => {
      if (!confirm('Remove this chart from the board?')) return;

      try {
        await unpinChart(chartId);
        setCharts((prev) => prev.filter((c) => c.id !== chartId));
      } catch (err) {
        console.error('[InsightBoardView] Unpin failed:', err);
      }
    },
    []
  );

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!boardId) return null;

  return (
    <Modal isOpen={!!boardId} onClose={onClose} maxWidth="max-w-5xl">
      {isLoading ? (
        <div className="py-12 text-center text-stone-500">Loading board...</div>
      ) : error ? (
        <div className="py-12 text-center text-red-600">{error}</div>
      ) : board ? (
        <div className="space-y-6">
          {/* Board header */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-4">
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="
                      text-xl font-semibold text-stone-900
                      px-2 py-1 -ml-2 rounded-md border border-stone-300
                      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                    "
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') {
                        setEditName(board.name);
                        setIsEditingName(false);
                      }
                    }}
                    onBlur={handleSaveName}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="
                    text-xl font-semibold text-stone-900
                    hover:text-primary-600 transition-colors
                    flex items-center gap-2 group
                  "
                >
                  {board.name}
                  <svg
                    className="w-4 h-4 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                    />
                  </svg>
                </button>
              )}
              <p className="text-sm text-stone-500 mt-1">
                {charts.length} {charts.length === 1 ? 'chart' : 'charts'} · Updated{' '}
                {formatDate(board.updated_at)}
              </p>
            </div>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>

          {/* Charts grid */}
          {charts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-stone-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-stone-400"
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
              <p className="text-stone-600 font-medium mb-1">No charts pinned</p>
              <p className="text-sm text-stone-500">
                Ask analytics questions in chat and click "Pin" to save charts here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {charts.map((pinnedChart) => {
                const chartData = parseChartData(pinnedChart);
                const analyticsRequest = parseAnalyticsRequestFromChart(pinnedChart);

                if (!chartData) return null;

                return (
                  <div key={pinnedChart.id} className="relative group">
                    {/* Unpin button */}
                    <button
                      onClick={() => handleUnpin(pinnedChart.id)}
                      className="
                        absolute top-2 right-2 z-10
                        p-1.5 rounded-md
                        bg-white/80 backdrop-blur-sm
                        text-stone-400 hover:text-red-600 hover:bg-red-50
                        opacity-0 group-hover:opacity-100
                        transition-all duration-150
                        shadow-sm
                      "
                      aria-label="Unpin chart"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {/* Chart - render without pin button (we're already in the board view) */}
                    <div className="bg-white rounded-xl border border-stone-200/60 shadow-sm overflow-hidden">
                      <AnalyticsChart
                        data={chartData}
                        analyticsRequest={analyticsRequest ?? undefined}
                      />
                      <div className="px-4 pb-3 text-xs text-stone-400">
                        Pinned {formatDate(pinnedChart.pinned_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

export default InsightBoardView;
