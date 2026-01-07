/**
 * Performance Section Components
 *
 * Components for displaying performance ratings, eNPS scores, and reviews.
 */

import type {
  PerformanceRating,
  PerformanceReview,
  EnpsResponse,
} from '../../../lib/types';
import { RATING_LABELS, getEnpsCategory } from '../../../lib/types';
import { formatDate, getRatingColor, getEnpsColor } from '../../ui';
import { SectionHeader } from './InfoSection';

// =============================================================================
// Card Components
// =============================================================================

interface RatingCardProps {
  rating: PerformanceRating;
  onClick?: () => void;
}

/**
 * Performance rating card with score badge.
 */
export function RatingCard({ rating, onClick }: RatingCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 bg-white/60 rounded-lg border border-stone-200/40 hover:bg-white/80 hover:border-stone-300/60 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-stone-600">
          {formatDate(rating.rating_date)}
        </span>
        <span
          className={`px-2 py-0.5 rounded text-sm font-medium ${getRatingColor(rating.overall_rating)}`}
        >
          {rating.overall_rating.toFixed(1)}
        </span>
      </div>
      <p className="text-xs text-stone-500">
        {RATING_LABELS[Math.round(rating.overall_rating)] ?? 'Rating'}
      </p>
    </button>
  );
}

interface EnpsCardProps {
  response: EnpsResponse;
  onClick?: () => void;
}

/**
 * eNPS response card with score and feedback preview.
 */
export function EnpsCard({ response, onClick }: EnpsCardProps) {
  const category = getEnpsCategory(response.score);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 bg-white/60 rounded-lg border border-stone-200/40 hover:bg-white/80 hover:border-stone-300/60 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-stone-600">
          {response.survey_name || formatDate(response.survey_date)}
        </span>
        <span
          className={`px-2 py-0.5 rounded text-sm font-medium ${getEnpsColor(response.score)}`}
        >
          {response.score}
        </span>
      </div>
      <p className="text-xs text-stone-500 capitalize">{category}</p>
      {response.feedback_text && (
        <p className="text-xs text-stone-500 mt-2 line-clamp-2">
          {response.feedback_text}
        </p>
      )}
    </button>
  );
}

// =============================================================================
// Section Components
// =============================================================================

interface RatingsSectionProps {
  ratings: PerformanceRating[];
  onSelectRating: (rating: PerformanceRating) => void;
}

/**
 * Performance ratings section with clickable cards.
 */
export function RatingsSection({
  ratings,
  onSelectRating,
}: RatingsSectionProps) {
  if (ratings.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Performance Ratings" count={ratings.length} />
      <div className="space-y-2">
        {ratings.slice(0, 3).map((rating) => (
          <RatingCard
            key={rating.id}
            rating={rating}
            onClick={() => onSelectRating(rating)}
          />
        ))}
        {ratings.length > 3 && (
          <button className="w-full text-xs text-primary-600 hover:text-primary-700 py-2">
            View all {ratings.length} ratings
          </button>
        )}
      </div>
    </section>
  );
}

interface EnpsSectionProps {
  responses: EnpsResponse[];
  onSelectResponse: (response: EnpsResponse) => void;
}

/**
 * eNPS responses section with clickable cards.
 */
export function EnpsSection({
  responses,
  onSelectResponse,
}: EnpsSectionProps) {
  if (responses.length === 0) return null;

  return (
    <section>
      <SectionHeader title="eNPS Responses" count={responses.length} />
      <div className="space-y-2">
        {responses.slice(0, 3).map((response) => (
          <EnpsCard
            key={response.id}
            response={response}
            onClick={() => onSelectResponse(response)}
          />
        ))}
        {responses.length > 3 && (
          <button className="w-full text-xs text-primary-600 hover:text-primary-700 py-2">
            View all {responses.length} responses
          </button>
        )}
      </div>
    </section>
  );
}

interface ReviewsSectionProps {
  reviews: PerformanceReview[];
  onSelectReview: (index: number) => void;
}

/**
 * Performance reviews summary section.
 */
export function ReviewsSection({
  reviews,
  onSelectReview,
}: ReviewsSectionProps) {
  if (reviews.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Performance Reviews" count={reviews.length} />
      <button
        type="button"
        onClick={() => onSelectReview(0)}
        className="w-full text-left bg-white/40 rounded-lg p-3 border border-stone-200/40 hover:bg-white/80 hover:border-stone-300/60 transition-colors cursor-pointer"
      >
        <p className="text-sm text-stone-600">
          {reviews.length} review{reviews.length !== 1 ? 's' : ''} on file
        </p>
        {reviews[0]?.strengths && (
          <p className="text-xs text-stone-500 mt-2 line-clamp-3">
            <span className="font-medium">Latest strengths:</span>{' '}
            {reviews[0].strengths}
          </p>
        )}
      </button>
    </section>
  );
}

// =============================================================================
// Loading & Empty States
// =============================================================================

/**
 * Loading skeleton for performance sections.
 */
export function PerformanceLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-stone-200/60 rounded w-24" />
      <div className="h-16 bg-stone-200/40 rounded-lg" />
    </div>
  );
}

/**
 * Empty state when no performance data exists.
 */
export function NoPerformanceData() {
  return (
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
      <p className="text-xs text-stone-500">No performance data</p>
    </div>
  );
}
