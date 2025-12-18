import { useEffect, useState } from 'react';
import { useEmployees } from '../../contexts/EmployeeContext';
import type { PerformanceRating, PerformanceReview, EnpsResponse } from '../../lib/types';
import { RATING_LABELS, getEnpsCategory } from '../../lib/types';
import {
  getRatingsForEmployee,
  getReviewsForEmployee,
  getEnpsForEmployee,
} from '../../lib/tauri-commands';
import { Modal } from '../shared';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function calculateTenure(hireDate?: string): string {
  if (!hireDate) return '—';
  try {
    const hire = new Date(hireDate);
    const now = new Date();
    const years = Math.floor((now.getTime() - hire.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor(((now.getTime() - hire.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));

    if (years > 0) {
      return `${years}y ${months}m`;
    }
    return `${months}m`;
  } catch {
    return '—';
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'text-emerald-600 bg-emerald-50';
  if (rating >= 3.5) return 'text-blue-600 bg-blue-50';
  if (rating >= 2.5) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function getEnpsBadgeStyle(score: number): string {
  const category = getEnpsCategory(score);
  switch (category) {
    case 'promoter':
      return 'text-emerald-600 bg-emerald-50';
    case 'passive':
      return 'text-amber-600 bg-amber-50';
    case 'detractor':
      return 'text-red-600 bg-red-50';
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return { label: 'Active', className: 'bg-emerald-100 text-emerald-700' };
    case 'terminated':
      return { label: 'Terminated', className: 'bg-stone-100 text-stone-600' };
    case 'leave':
      return { label: 'On Leave', className: 'bg-amber-100 text-amber-700' };
    default:
      return { label: status, className: 'bg-stone-100 text-stone-600' };
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2 py-1.5">
      <span className="text-stone-500 text-sm flex-shrink-0">{label}</span>
      <span
        className="text-stone-700 text-sm font-medium min-w-0 truncate text-right"
        title={value || undefined}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h4 className="text-xs font-medium text-stone-400 uppercase tracking-wider">{title}</h4>
      {count !== undefined && (
        <span className="text-xs text-stone-400">({count})</span>
      )}
    </div>
  );
}

function RatingCard({
  rating,
  onClick,
}: {
  rating: PerformanceRating;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 bg-white/60 rounded-lg border border-stone-200/40 hover:bg-white/80 hover:border-stone-300/60 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-stone-600">{formatDate(rating.rating_date)}</span>
        <span className={`px-2 py-0.5 rounded text-sm font-medium ${getRatingColor(rating.overall_rating)}`}>
          {rating.overall_rating.toFixed(1)}
        </span>
      </div>
      <p className="text-xs text-stone-400">
        {RATING_LABELS[Math.round(rating.overall_rating)] ?? 'Rating'}
      </p>
    </button>
  );
}

function EnpsCard({
  response,
  onClick,
}: {
  response: EnpsResponse;
  onClick?: () => void;
}) {
  const category = getEnpsCategory(response.score);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 bg-white/60 rounded-lg border border-stone-200/40 hover:bg-white/80 hover:border-stone-300/60 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-stone-600">{response.survey_name || formatDate(response.survey_date)}</span>
        <span className={`px-2 py-0.5 rounded text-sm font-medium ${getEnpsBadgeStyle(response.score)}`}>
          {response.score}
        </span>
      </div>
      <p className="text-xs text-stone-400 capitalize">{category}</p>
      {response.feedback_text && (
        <p className="text-xs text-stone-500 mt-2 line-clamp-2">{response.feedback_text}</p>
      )}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
      <svg
        className="w-16 h-16 text-stone-200 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      <p className="text-stone-500 text-sm">Select an employee</p>
      <p className="text-stone-400 text-xs mt-1">to view their details</p>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function EmployeeDetail() {
  const { selectedEmployee, selectedEmployeeId, openEditModal, employees } = useEmployees();

  // Performance data state
  const [ratings, setRatings] = useState<PerformanceRating[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [enpsResponses, setEnpsResponses] = useState<EnpsResponse[]>([]);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);

  // Modal state for expandable tiles
  const [selectedRating, setSelectedRating] = useState<PerformanceRating | null>(null);
  const [selectedEnps, setSelectedEnps] = useState<EnpsResponse | null>(null);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);

  // Derived review from index
  const selectedReview = selectedReviewIndex !== null ? reviews[selectedReviewIndex] : null;

  // Fetch performance data when employee changes
  useEffect(() => {
    if (!selectedEmployeeId) {
      setRatings([]);
      setReviews([]);
      setEnpsResponses([]);
      return;
    }

    const fetchPerformanceData = async () => {
      setIsLoadingPerformance(true);
      try {
        const [ratingsData, reviewsData, enpsData] = await Promise.all([
          getRatingsForEmployee(selectedEmployeeId),
          getReviewsForEmployee(selectedEmployeeId),
          getEnpsForEmployee(selectedEmployeeId),
        ]);
        setRatings(ratingsData);
        setReviews(reviewsData);
        setEnpsResponses(enpsData);
      } catch (error) {
        console.error('Failed to load performance data:', error);
      } finally {
        setIsLoadingPerformance(false);
      }
    };

    fetchPerformanceData();
  }, [selectedEmployeeId]);

  // No employee selected
  if (!selectedEmployee) {
    return <EmptyState />;
  }

  const statusBadge = getStatusBadge(selectedEmployee.status);
  const latestRating = ratings[0];
  const latestEnps = enpsResponses[0];

  // Look up manager name from employees list
  const manager = selectedEmployee.manager_id
    ? employees.find((e) => e.id === selectedEmployee.manager_id)
    : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-stone-200/60">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-lg flex-shrink-0">
            {getInitials(selectedEmployee.full_name)}
          </div>

          {/* Name & title */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-stone-800 text-lg truncate">
              {selectedEmployee.full_name}
            </h3>
            {selectedEmployee.job_title && (
              <p className="text-sm text-stone-500 truncate">{selectedEmployee.job_title}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
              {selectedEmployee.department && (
                <span className="text-xs text-stone-400">{selectedEmployee.department}</span>
              )}
            </div>
          </div>

          {/* Edit button */}
          {openEditModal && (
            <button
              onClick={openEditModal}
              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              aria-label="Edit employee"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex gap-4 mt-4">
          {latestRating && (
            <div className="text-center">
              <div className={`text-lg font-semibold ${getRatingColor(latestRating.overall_rating).split(' ')[0]}`}>
                {latestRating.overall_rating.toFixed(1)}
              </div>
              <div className="text-xs text-stone-400">Rating</div>
            </div>
          )}
          {latestEnps && (
            <div className="text-center">
              <div className={`text-lg font-semibold ${getEnpsBadgeStyle(latestEnps.score).split(' ')[0]}`}>
                {latestEnps.score}
              </div>
              <div className="text-xs text-stone-400">eNPS</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-lg font-semibold text-stone-700">
              {calculateTenure(selectedEmployee.hire_date)}
            </div>
            <div className="text-xs text-stone-400">Tenure</div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <section>
          <SectionHeader title="Details" />
          <div className="bg-white/40 rounded-lg p-3 border border-stone-200/40">
            <InfoRow label="Email" value={selectedEmployee.email} />
            <InfoRow label="Hire Date" value={formatDate(selectedEmployee.hire_date)} />
            <InfoRow label="Location" value={selectedEmployee.work_state} />
            {selectedEmployee.manager_id && (
              <InfoRow
                label="Manager"
                value={manager?.full_name || `ID: ${selectedEmployee.manager_id}`}
              />
            )}
          </div>
        </section>

        {/* Demographics (if available) */}
        {(selectedEmployee.date_of_birth || selectedEmployee.gender || selectedEmployee.ethnicity) && (
          <section>
            <SectionHeader title="Demographics" />
            <div className="bg-white/40 rounded-lg p-3 border border-stone-200/40">
              {selectedEmployee.date_of_birth && (
                <InfoRow label="Date of Birth" value={formatDate(selectedEmployee.date_of_birth)} />
              )}
              {selectedEmployee.gender && (
                <InfoRow label="Gender" value={selectedEmployee.gender} />
              )}
              {selectedEmployee.ethnicity && (
                <InfoRow label="Ethnicity" value={selectedEmployee.ethnicity} />
              )}
            </div>
          </section>
        )}

        {/* Termination details (if terminated) */}
        {selectedEmployee.status === 'terminated' && selectedEmployee.termination_date && (
          <section>
            <SectionHeader title="Termination" />
            <div className="bg-white/40 rounded-lg p-3 border border-stone-200/40">
              <InfoRow label="Date" value={formatDate(selectedEmployee.termination_date)} />
              {selectedEmployee.termination_reason && (
                <InfoRow label="Reason" value={selectedEmployee.termination_reason} />
              )}
            </div>
          </section>
        )}

        {/* Performance Ratings */}
        {isLoadingPerformance ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-stone-200/60 rounded w-24" />
            <div className="h-16 bg-stone-200/40 rounded-lg" />
          </div>
        ) : ratings.length > 0 ? (
          <section>
            <SectionHeader title="Performance Ratings" count={ratings.length} />
            <div className="space-y-2">
              {ratings.slice(0, 3).map((rating) => (
                <RatingCard
                  key={rating.id}
                  rating={rating}
                  onClick={() => setSelectedRating(rating)}
                />
              ))}
              {ratings.length > 3 && (
                <button className="w-full text-xs text-primary-600 hover:text-primary-700 py-2">
                  View all {ratings.length} ratings
                </button>
              )}
            </div>
          </section>
        ) : null}

        {/* eNPS History */}
        {!isLoadingPerformance && enpsResponses.length > 0 && (
          <section>
            <SectionHeader title="eNPS Responses" count={enpsResponses.length} />
            <div className="space-y-2">
              {enpsResponses.slice(0, 3).map((response) => (
                <EnpsCard
                  key={response.id}
                  response={response}
                  onClick={() => setSelectedEnps(response)}
                />
              ))}
              {enpsResponses.length > 3 && (
                <button className="w-full text-xs text-primary-600 hover:text-primary-700 py-2">
                  View all {enpsResponses.length} responses
                </button>
              )}
            </div>
          </section>
        )}

        {/* Performance Reviews Summary */}
        {!isLoadingPerformance && reviews.length > 0 && (
          <section>
            <SectionHeader title="Performance Reviews" count={reviews.length} />
            <button
              type="button"
              onClick={() => setSelectedReviewIndex(0)}
              className="w-full text-left bg-white/40 rounded-lg p-3 border border-stone-200/40 hover:bg-white/80 hover:border-stone-300/60 transition-colors cursor-pointer"
            >
              <p className="text-sm text-stone-600">
                {reviews.length} review{reviews.length !== 1 ? 's' : ''} on file
              </p>
              {reviews[0]?.strengths && (
                <p className="text-xs text-stone-500 mt-2 line-clamp-3">
                  <span className="font-medium">Latest strengths:</span> {reviews[0].strengths}
                </p>
              )}
            </button>
          </section>
        )}

        {/* Empty state for no performance data */}
        {!isLoadingPerformance && ratings.length === 0 && enpsResponses.length === 0 && reviews.length === 0 && (
          <div className="text-center py-6">
            <svg
              className="w-10 h-10 mx-auto text-stone-200 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
              />
            </svg>
            <p className="text-xs text-stone-400">No performance data</p>
          </div>
        )}
      </div>

      {/* Rating Detail Modal */}
      <Modal
        isOpen={!!selectedRating}
        onClose={() => setSelectedRating(null)}
        title="Performance Rating"
      >
        {selectedRating && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Date</span>
              <span className="font-medium">{formatDate(selectedRating.rating_date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Overall Rating</span>
              <span className={`px-3 py-1 rounded-lg text-lg font-semibold ${getRatingColor(selectedRating.overall_rating)}`}>
                {selectedRating.overall_rating.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Performance Level</span>
              <span className="font-medium">
                {RATING_LABELS[Math.round(selectedRating.overall_rating)] ?? 'Rating'}
              </span>
            </div>
            {selectedRating.goals_rating && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Goals Rating</span>
                <span className="font-medium">{selectedRating.goals_rating.toFixed(1)}</span>
              </div>
            )}
            {selectedRating.competencies_rating && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Competencies Rating</span>
                <span className="font-medium">{selectedRating.competencies_rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* eNPS Detail Modal */}
      <Modal
        isOpen={!!selectedEnps}
        onClose={() => setSelectedEnps(null)}
        title="eNPS Response"
      >
        {selectedEnps && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Survey</span>
              <span className="font-medium">
                {selectedEnps.survey_name || formatDate(selectedEnps.survey_date)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Score</span>
              <span className={`px-3 py-1 rounded-lg text-lg font-semibold ${getEnpsBadgeStyle(selectedEnps.score)}`}>
                {selectedEnps.score}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Category</span>
              <span className="font-medium capitalize">{getEnpsCategory(selectedEnps.score)}</span>
            </div>
            {selectedEnps.feedback_text && (
              <div className="pt-4 border-t border-stone-200">
                <p className="text-sm text-stone-500 mb-2">Feedback</p>
                <p className="text-stone-700 whitespace-pre-wrap">{selectedEnps.feedback_text}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Review Detail Modal */}
      <Modal
        isOpen={selectedReviewIndex !== null}
        onClose={() => setSelectedReviewIndex(null)}
        title="Performance Review"
        maxWidth="max-w-2xl"
      >
        {selectedReview && selectedReviewIndex !== null && (
          <div className="space-y-5">
            {/* Navigation header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedReviewIndex(Math.max(0, selectedReviewIndex - 1))}
                disabled={selectedReviewIndex === 0}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous review"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="text-sm text-stone-500">
                {selectedReviewIndex + 1} of {reviews.length}
              </span>
              <button
                onClick={() => setSelectedReviewIndex(Math.min(reviews.length - 1, selectedReviewIndex + 1))}
                disabled={selectedReviewIndex === reviews.length - 1}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next review"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">Review Date</span>
              <span className="font-medium">{formatDate(selectedReview.review_date)}</span>
            </div>

            {selectedReview.strengths && (
              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2">Strengths</h4>
                <p className="text-stone-600 text-sm whitespace-pre-wrap bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  {selectedReview.strengths}
                </p>
              </div>
            )}

            {selectedReview.areas_for_improvement && (
              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2">Areas for Improvement</h4>
                <p className="text-stone-600 text-sm whitespace-pre-wrap bg-amber-50 rounded-lg p-3 border border-amber-100">
                  {selectedReview.areas_for_improvement}
                </p>
              </div>
            )}

            {selectedReview.goals_next_period && (
              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2">Goals for Next Period</h4>
                <p className="text-stone-600 text-sm whitespace-pre-wrap bg-blue-50 rounded-lg p-3 border border-blue-100">
                  {selectedReview.goals_next_period}
                </p>
              </div>
            )}

            {selectedReview.manager_comments && (
              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2">Manager Comments</h4>
                <p className="text-stone-600 text-sm whitespace-pre-wrap bg-stone-50 rounded-lg p-3 border border-stone-200">
                  {selectedReview.manager_comments}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default EmployeeDetail;
