// HR Command Center - Analytics Types (V2.3.2)
// TypeScript types matching Rust analytics module

// =============================================================================
// Intent & Grouping Enums
// =============================================================================

export type ChartIntent =
  | 'headcount_by'
  | 'rating_distribution'
  | 'enps_breakdown'
  | 'attrition_analysis'
  | 'tenure_distribution';

export type GroupBy =
  | 'department'
  | 'status'
  | 'gender'
  | 'ethnicity'
  | 'work_state'
  | 'tenure_bucket'
  | 'rating_bucket'
  | 'quarter';

export type ChartType = 'bar' | 'pie' | 'line' | 'horizontal_bar';

// =============================================================================
// Filter & Request Types
// =============================================================================

export interface ChartFilters {
  departments?: string[];
  statuses?: string[];
  date_from?: string;
  date_to?: string;
  gender?: string;
  ethnicity?: string;
}

export interface AnalyticsRequest {
  intent: ChartIntent;
  group_by: GroupBy;
  filters: ChartFilters;
  suggested_chart?: ChartType;
  description: string;
}

// =============================================================================
// Chart Data Types
// =============================================================================

export interface ChartDataPoint {
  label: string;
  value: number;
  percentage?: number;
}

export interface ChartData {
  chart_type: ChartType;
  data: ChartDataPoint[];
  title: string;
  filters_applied: string;
  total?: number;
  x_label?: string;
  y_label?: string;
}

// =============================================================================
// Result Types
// =============================================================================

export type ChartResult =
  | { type: 'success'; data: ChartData }
  | { type: 'fallback'; reason: string; text_response: string }
  | { type: 'not_chart_query' };

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parses an analytics request from Claude's response text.
 * Looks for <analytics_request>JSON</analytics_request> markers.
 */
export function parseAnalyticsRequest(response: string): AnalyticsRequest | null {
  const startMarker = '<analytics_request>';
  const endMarker = '</analytics_request>';

  const startIndex = response.indexOf(startMarker);
  const endIndex = response.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  const jsonStr = response.slice(startIndex + startMarker.length, endIndex).trim();

  try {
    return JSON.parse(jsonStr) as AnalyticsRequest;
  } catch {
    return null;
  }
}

/**
 * Strips the analytics request block from response text.
 */
export function stripAnalyticsBlock(response: string): string {
  const startMarker = '<analytics_request>';
  const endMarker = '</analytics_request>';

  const startIndex = response.indexOf(startMarker);
  const endIndex = response.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return response;
  }

  const before = response.slice(0, startIndex).trimEnd();
  const after = response.slice(endIndex + endMarker.length).trimStart();

  return `${before}${after}`;
}

/**
 * Checks if a chart result was successful.
 */
export function isChartSuccess(result: ChartResult): result is { type: 'success'; data: ChartData } {
  return result.type === 'success';
}

/**
 * Checks if a chart result is a fallback.
 */
export function isChartFallback(
  result: ChartResult
): result is { type: 'fallback'; reason: string; text_response: string } {
  return result.type === 'fallback';
}
