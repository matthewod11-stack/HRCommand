/**
 * Rating Detail Modal
 *
 * Modal showing full performance rating details.
 */

import type { PerformanceRating } from '../../../../lib/types';
import { RATING_LABELS } from '../../../../lib/types';
import { Modal } from '../../../shared';
import { formatDate, getRatingColor } from '../../../ui';

interface RatingDetailModalProps {
  rating: PerformanceRating | null;
  onClose: () => void;
}

export function RatingDetailModal({ rating, onClose }: RatingDetailModalProps) {
  return (
    <Modal
      isOpen={!!rating}
      onClose={onClose}
      title="Performance Rating"
    >
      {rating && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Date</span>
            <span className="font-medium">{formatDate(rating.rating_date)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Overall Rating</span>
            <span
              className={`px-3 py-1 rounded-lg text-lg font-semibold ${getRatingColor(rating.overall_rating)}`}
            >
              {rating.overall_rating.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Performance Level</span>
            <span className="font-medium">
              {RATING_LABELS[Math.round(rating.overall_rating)] ?? 'Rating'}
            </span>
          </div>
          {rating.goals_rating && (
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Goals Rating</span>
              <span className="font-medium">
                {rating.goals_rating.toFixed(1)}
              </span>
            </div>
          )}
          {rating.competencies_rating && (
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Competencies Rating</span>
              <span className="font-medium">
                {rating.competencies_rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
