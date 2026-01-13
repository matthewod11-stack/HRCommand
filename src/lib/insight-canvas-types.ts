// HR Command Center - Insight Canvas Types (V2.3.2g-l)
// TypeScript types matching Rust insight_canvas module

// =============================================================================
// Board Types
// =============================================================================

/** Full insight board record */
export interface InsightBoard {
  id: string;
  name: string;
  description?: string;
  layout: string; // JSON array of layout positions
  created_at: string;
  updated_at: string;
}

/** Lightweight board item for list views */
export interface InsightBoardListItem {
  id: string;
  name: string;
  description?: string;
  chart_count: number;
  updated_at: string;
}

/** Input for creating a new board */
export interface CreateBoardInput {
  name: string;
  description?: string;
}

/** Input for updating an existing board */
export interface UpdateBoardInput {
  name?: string;
  description?: string;
  layout?: string;
}

// =============================================================================
// Pinned Chart Types
// =============================================================================

/** Full pinned chart record */
export interface PinnedChart {
  id: string;
  board_id: string;
  chart_data: string; // JSON of ChartData
  analytics_request: string; // JSON of AnalyticsRequest
  title: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  conversation_id?: string;
  message_id?: string;
  pinned_at: string;
  updated_at: string;
}

/** Input for pinning a chart to a board */
export interface PinChartInput {
  board_id: string;
  chart_data: string;
  analytics_request: string;
  title: string;
  conversation_id?: string;
  message_id?: string;
}

/** Input for updating a pinned chart */
export interface UpdatePinnedChartInput {
  title?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}

// =============================================================================
// Annotation Types
// =============================================================================

/** Annotation type options */
export type AnnotationType = 'note' | 'callout' | 'question';

/** Chart annotation record */
export interface ChartAnnotation {
  id: string;
  chart_id: string;
  content: string;
  annotation_type: AnnotationType;
  position_x?: number;
  position_y?: number;
  created_at: string;
  updated_at: string;
}

/** Input for creating an annotation */
export interface CreateAnnotationInput {
  chart_id: string;
  content: string;
  annotation_type?: AnnotationType;
}

// =============================================================================
// Helper Functions
// =============================================================================

import type { ChartData, AnalyticsRequest } from './analytics-types';

/** Parse chart data from a pinned chart's JSON string */
export function parseChartData(pinnedChart: PinnedChart): ChartData | null {
  try {
    return JSON.parse(pinnedChart.chart_data) as ChartData;
  } catch {
    return null;
  }
}

/** Parse analytics request from a pinned chart's JSON string */
export function parseAnalyticsRequestFromChart(
  pinnedChart: PinnedChart
): AnalyticsRequest | null {
  try {
    return JSON.parse(pinnedChart.analytics_request) as AnalyticsRequest;
  } catch {
    return null;
  }
}

/** Create a PinChartInput from ChartData and AnalyticsRequest */
export function createPinChartInput(
  boardId: string,
  chartData: ChartData,
  analyticsRequest: AnalyticsRequest,
  conversationId?: string,
  messageId?: string
): PinChartInput {
  return {
    board_id: boardId,
    chart_data: JSON.stringify(chartData),
    analytics_request: JSON.stringify(analyticsRequest),
    title: chartData.title,
    conversation_id: conversationId,
    message_id: messageId,
  };
}
