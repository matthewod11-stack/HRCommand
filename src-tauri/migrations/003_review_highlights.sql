-- Migration 003: Review Highlights and Employee Summaries
-- Extracted structured data from performance reviews using Claude API

-- Review Highlights: Extracted structured data from individual performance reviews
CREATE TABLE IF NOT EXISTS review_highlights (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL UNIQUE,
    employee_id TEXT NOT NULL,
    review_cycle_id TEXT NOT NULL,

    -- Extracted data (JSON arrays)
    strengths TEXT DEFAULT '[]',
    opportunities TEXT DEFAULT '[]',
    themes TEXT DEFAULT '[]',
    quotes TEXT DEFAULT '[]',

    -- Metadata
    overall_sentiment TEXT CHECK (overall_sentiment IN ('positive', 'neutral', 'mixed', 'negative')),
    extraction_model TEXT,
    extraction_version INTEGER DEFAULT 1,
    token_count INTEGER,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (review_id) REFERENCES performance_reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (review_cycle_id) REFERENCES review_cycles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_highlights_employee ON review_highlights(employee_id);
CREATE INDEX IF NOT EXISTS idx_highlights_cycle ON review_highlights(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_highlights_review ON review_highlights(review_id);

-- Employee Summaries: Aggregated career narrative per employee
CREATE TABLE IF NOT EXISTS employee_summaries (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL UNIQUE,

    career_narrative TEXT,
    key_strengths TEXT DEFAULT '[]',
    development_areas TEXT DEFAULT '[]',
    notable_accomplishments TEXT DEFAULT '[]',

    reviews_analyzed INTEGER DEFAULT 0,
    last_review_date TEXT,
    generation_model TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summaries_employee ON employee_summaries(employee_id);
