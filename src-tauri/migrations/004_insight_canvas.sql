-- Migration 004: Insight Canvas - Persistent Chart Storage
-- V2.3.2g-l: Stores boards, pinned charts, and annotations for analytics visualizations

-- ============================================================================
-- 1. INSIGHT BOARDS TABLE
-- ============================================================================
-- Named collections of charts ("Q3 Review", "Leadership Dashboard")

CREATE TABLE IF NOT EXISTS insight_boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    layout TEXT DEFAULT '[]',            -- JSON: array of chart positions/sizes
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_insight_boards_updated ON insight_boards(updated_at DESC);

-- ============================================================================
-- 2. PINNED CHARTS TABLE
-- ============================================================================
-- Individual charts pinned to boards

CREATE TABLE IF NOT EXISTS pinned_charts (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,

    -- Chart data (stored as JSON to preserve original request)
    chart_data TEXT NOT NULL,            -- JSON: full ChartData object
    analytics_request TEXT NOT NULL,     -- JSON: original AnalyticsRequest

    -- Display metadata
    title TEXT NOT NULL,                 -- Editable title (defaults from chart)
    position_x INTEGER DEFAULT 0,        -- Grid position
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 2,             -- Grid units (1-4)
    height INTEGER DEFAULT 1,            -- Grid units (1-2)

    -- Source tracking
    conversation_id TEXT,                -- Which conversation it came from
    message_id TEXT,                     -- Which message in that conversation

    -- Timestamps
    pinned_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (board_id) REFERENCES insight_boards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pinned_charts_board ON pinned_charts(board_id);
CREATE INDEX IF NOT EXISTS idx_pinned_charts_pinned ON pinned_charts(pinned_at DESC);

-- ============================================================================
-- 3. CHART ANNOTATIONS TABLE
-- ============================================================================
-- Text annotations attached to charts

CREATE TABLE IF NOT EXISTS chart_annotations (
    id TEXT PRIMARY KEY,
    chart_id TEXT NOT NULL,

    content TEXT NOT NULL,               -- Annotation text (markdown supported)
    annotation_type TEXT DEFAULT 'note'  -- 'note', 'callout', 'question'
        CHECK (annotation_type IN ('note', 'callout', 'question')),

    -- Optional positioning (for future inline annotations)
    position_x INTEGER,                  -- Percentage (0-100) from left
    position_y INTEGER,                  -- Percentage (0-100) from top

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (chart_id) REFERENCES pinned_charts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chart_annotations_chart ON chart_annotations(chart_id);
