/**
 * eNPS Detail Modal
 *
 * Modal showing full eNPS response details.
 */

import type { EnpsResponse } from '../../../../lib/types';
import { getEnpsCategory } from '../../../../lib/types';
import { Modal } from '../../../shared';
import { formatDate, getEnpsColor } from '../../../ui';

interface EnpsDetailModalProps {
  response: EnpsResponse | null;
  onClose: () => void;
}

export function EnpsDetailModal({ response, onClose }: EnpsDetailModalProps) {
  return (
    <Modal
      isOpen={!!response}
      onClose={onClose}
      title="eNPS Response"
    >
      {response && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Survey</span>
            <span className="font-medium">
              {response.survey_name || formatDate(response.survey_date)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Score</span>
            <span
              className={`px-3 py-1 rounded-lg text-lg font-semibold ${getEnpsColor(response.score)}`}
            >
              {response.score}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Category</span>
            <span className="font-medium capitalize">
              {getEnpsCategory(response.score)}
            </span>
          </div>
          {response.feedback_text && (
            <div className="pt-4 border-t border-stone-200">
              <p className="text-sm text-stone-500 mb-2">Feedback</p>
              <p className="text-stone-700 whitespace-pre-wrap">
                {response.feedback_text}
              </p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
