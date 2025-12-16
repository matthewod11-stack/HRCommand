-- HR Command Center - Performance & eNPS Schema Expansion
-- Migration 002: Adds performance ratings, reviews, eNPS tracking, and employee demographics
-- Reference: docs/SCHEMA_EXPANSION_V1.md

-- ============================================================================
-- 1. EMPLOYEE TABLE EXPANSION
-- ============================================================================

-- Demographics fields
ALTER TABLE employees ADD COLUMN date_of_birth TEXT;
ALTER TABLE employees ADD COLUMN gender TEXT;
ALTER TABLE employees ADD COLUMN ethnicity TEXT;

-- Termination tracking
ALTER TABLE employees ADD COLUMN termination_date TEXT;
ALTER TABLE employees ADD COLUMN termination_reason TEXT;

-- Index for termination queries
CREATE INDEX IF NOT EXISTS idx_employees_termination_date ON employees(termination_date);

-- ============================================================================
-- 2. REVIEW CYCLES TABLE
-- ============================================================================
-- Organizes performance data by time periods (annual, quarterly, etc.)

CREATE TABLE IF NOT EXISTS review_cycles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                    -- "2024 Annual Review", "Q3 2024 Check-in"
    cycle_type TEXT NOT NULL CHECK (cycle_type IN ('annual', 'semi-annual', 'quarterly')),
    start_date TEXT NOT NULL,              -- Period start (ISO date)
    end_date TEXT NOT NULL,                -- Period end (ISO date)
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_review_cycles_dates ON review_cycles(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_review_cycles_status ON review_cycles(status);

-- ============================================================================
-- 3. PERFORMANCE RATINGS TABLE
-- ============================================================================
-- Numeric ratings per employee per review cycle (1.0 - 5.0 scale)

CREATE TABLE IF NOT EXISTS performance_ratings (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    review_cycle_id TEXT NOT NULL,

    -- Rating data (1.0 to 5.0 scale)
    overall_rating REAL NOT NULL CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
    goals_rating REAL CHECK (goals_rating IS NULL OR (goals_rating >= 1.0 AND goals_rating <= 5.0)),
    competencies_rating REAL CHECK (competencies_rating IS NULL OR (competencies_rating >= 1.0 AND competencies_rating <= 5.0)),

    -- Metadata
    reviewer_id TEXT,                      -- Manager who gave rating
    rating_date TEXT,                      -- When rating was finalized

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    -- Constraints
    UNIQUE(employee_id, review_cycle_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (review_cycle_id) REFERENCES review_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ratings_employee ON performance_ratings(employee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_cycle ON performance_ratings(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_ratings_overall ON performance_ratings(overall_rating);
CREATE INDEX IF NOT EXISTS idx_ratings_reviewer ON performance_ratings(reviewer_id);

-- ============================================================================
-- 4. PERFORMANCE REVIEWS TABLE
-- ============================================================================
-- Text narratives from performance reviews (searchable via FTS)

CREATE TABLE IF NOT EXISTS performance_reviews (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    review_cycle_id TEXT NOT NULL,

    -- Review content
    strengths TEXT,                        -- What they do well
    areas_for_improvement TEXT,            -- Development areas
    accomplishments TEXT,                  -- Key achievements this period
    goals_next_period TEXT,                -- Goals for next cycle
    manager_comments TEXT,                 -- Overall manager narrative
    self_assessment TEXT,                  -- Employee's self-review (if collected)

    -- Metadata
    reviewer_id TEXT,                      -- Manager who wrote review
    review_date TEXT,                      -- When review was completed

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    -- Constraints
    UNIQUE(employee_id, review_cycle_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (review_cycle_id) REFERENCES review_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_cycle ON performance_reviews(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON performance_reviews(reviewer_id);

-- Full-text search for review content
CREATE VIRTUAL TABLE IF NOT EXISTS performance_reviews_fts USING fts5(
    strengths,
    areas_for_improvement,
    accomplishments,
    goals_next_period,
    manager_comments,
    self_assessment,
    content='performance_reviews',
    content_rowid='rowid'
);

-- Triggers to keep FTS in sync with performance_reviews
CREATE TRIGGER IF NOT EXISTS performance_reviews_ai AFTER INSERT ON performance_reviews BEGIN
    INSERT INTO performance_reviews_fts(rowid, strengths, areas_for_improvement, accomplishments, goals_next_period, manager_comments, self_assessment)
    VALUES (NEW.rowid, NEW.strengths, NEW.areas_for_improvement, NEW.accomplishments, NEW.goals_next_period, NEW.manager_comments, NEW.self_assessment);
END;

CREATE TRIGGER IF NOT EXISTS performance_reviews_ad AFTER DELETE ON performance_reviews BEGIN
    INSERT INTO performance_reviews_fts(performance_reviews_fts, rowid, strengths, areas_for_improvement, accomplishments, goals_next_period, manager_comments, self_assessment)
    VALUES ('delete', OLD.rowid, OLD.strengths, OLD.areas_for_improvement, OLD.accomplishments, OLD.goals_next_period, OLD.manager_comments, OLD.self_assessment);
END;

CREATE TRIGGER IF NOT EXISTS performance_reviews_au AFTER UPDATE ON performance_reviews BEGIN
    INSERT INTO performance_reviews_fts(performance_reviews_fts, rowid, strengths, areas_for_improvement, accomplishments, goals_next_period, manager_comments, self_assessment)
    VALUES ('delete', OLD.rowid, OLD.strengths, OLD.areas_for_improvement, OLD.accomplishments, OLD.goals_next_period, OLD.manager_comments, OLD.self_assessment);
    INSERT INTO performance_reviews_fts(rowid, strengths, areas_for_improvement, accomplishments, goals_next_period, manager_comments, self_assessment)
    VALUES (NEW.rowid, NEW.strengths, NEW.areas_for_improvement, NEW.accomplishments, NEW.goals_next_period, NEW.manager_comments, NEW.self_assessment);
END;

-- ============================================================================
-- 5. eNPS RESPONSES TABLE
-- ============================================================================
-- Employee Net Promoter Score tracking over time (0-10 scale)

CREATE TABLE IF NOT EXISTS enps_responses (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,

    -- eNPS data
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
    survey_date TEXT NOT NULL,             -- When survey was taken (ISO date)
    survey_name TEXT,                      -- "Q4 2024 Pulse", "Annual 2024"

    -- Optional follow-up
    feedback_text TEXT,                    -- Open-ended response

    created_at TEXT DEFAULT (datetime('now')),

    -- Constraints
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enps_employee ON enps_responses(employee_id);
CREATE INDEX IF NOT EXISTS idx_enps_date ON enps_responses(survey_date);
CREATE INDEX IF NOT EXISTS idx_enps_score ON enps_responses(score);
CREATE INDEX IF NOT EXISTS idx_enps_survey ON enps_responses(survey_name);
