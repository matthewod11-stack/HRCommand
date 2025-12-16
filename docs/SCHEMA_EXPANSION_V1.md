# HR Command Center — Schema Expansion (V1)

> **Purpose:** Define the expanded data model for Full HR Suite capabilities
> **Decision Date:** 2025-12-15
> **Status:** Approved for V1 implementation

---

## Summary of Changes

| Area | V1 Scope | V2 Deferred |
|------|----------|-------------|
| **Employee Data** | + Demographics (DOB, gender, ethnicity) | Compensation (salary, bonus, equity) |
| **Performance** | Ratings + Review narratives | - |
| **Engagement** | eNPS scores over time | - |
| **Ingestion** | CSV, Excel (.xlsx/.xls), TSV | PDF, DOCX, HRIS connectors |
| **Test Data** | 100 employees, realistic distribution | - |

---

## 1. Expanded Employee Table

### New Fields on `employees`

```sql
-- Add to existing employees table
ALTER TABLE employees ADD COLUMN date_of_birth TEXT;        -- For age calculations
ALTER TABLE employees ADD COLUMN gender TEXT;               -- M/F/Non-binary/Prefer not to say
ALTER TABLE employees ADD COLUMN ethnicity TEXT;            -- For DEI reporting
ALTER TABLE employees ADD COLUMN termination_date TEXT;     -- When status = 'terminated'
ALTER TABLE employees ADD COLUMN termination_reason TEXT;   -- voluntary/involuntary/retirement
```

### Full Employee Schema (V1)

```sql
CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT,
    job_title TEXT,
    manager_id TEXT REFERENCES employees(id),
    hire_date TEXT,
    work_state TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'terminated', 'leave')),

    -- Demographics (V1 expansion)
    date_of_birth TEXT,                    -- ISO date for age calculations
    gender TEXT,                           -- Free text, common values: M, F, Non-binary
    ethnicity TEXT,                        -- For DEI reporting

    -- Termination details
    termination_date TEXT,                 -- When status changed to 'terminated'
    termination_reason TEXT,               -- voluntary, involuntary, retirement, etc.

    -- Flexibility
    extra_fields TEXT,                     -- JSON for custom fields

    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 2. Review Cycles Table (NEW)

Organizes performance data by time period.

```sql
CREATE TABLE review_cycles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                    -- "2024 Annual Review", "Q3 2024 Check-in"
    cycle_type TEXT NOT NULL,              -- annual, semi-annual, quarterly
    start_date TEXT NOT NULL,              -- Period start
    end_date TEXT NOT NULL,                -- Period end
    status TEXT DEFAULT 'active',          -- active, closed
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_review_cycles_dates ON review_cycles(start_date, end_date);
```

### Example Data
| id | name | cycle_type | start_date | end_date | status |
|----|------|------------|------------|----------|--------|
| rc_2024_annual | 2024 Annual Review | annual | 2024-01-01 | 2024-12-31 | closed |
| rc_2023_annual | 2023 Annual Review | annual | 2023-01-01 | 2023-12-31 | closed |
| rc_2025_q1 | Q1 2025 Check-in | quarterly | 2025-01-01 | 2025-03-31 | active |

---

## 3. Performance Ratings Table (NEW)

Numeric ratings per employee per review cycle.

```sql
CREATE TABLE performance_ratings (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    review_cycle_id TEXT NOT NULL REFERENCES review_cycles(id),

    -- Rating data
    overall_rating REAL NOT NULL,          -- 1.0 to 5.0 scale
    goals_rating REAL,                     -- Optional sub-rating
    competencies_rating REAL,              -- Optional sub-rating

    -- Metadata
    reviewer_id TEXT REFERENCES employees(id),  -- Manager who gave rating
    rating_date TEXT,                      -- When rating was finalized

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(employee_id, review_cycle_id)   -- One rating per employee per cycle
);

CREATE INDEX idx_ratings_employee ON performance_ratings(employee_id);
CREATE INDEX idx_ratings_cycle ON performance_ratings(review_cycle_id);
CREATE INDEX idx_ratings_overall ON performance_ratings(overall_rating);
```

### Rating Scale Convention
| Score | Label | Description |
|-------|-------|-------------|
| 5.0 | Exceptional | Consistently exceeds expectations |
| 4.0 | Exceeds | Often exceeds expectations |
| 3.0 | Meets | Consistently meets expectations |
| 2.0 | Developing | Sometimes meets expectations |
| 1.0 | Unsatisfactory | Does not meet expectations |

---

## 4. Performance Reviews Table (NEW)

Text narratives from performance reviews.

```sql
CREATE TABLE performance_reviews (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),
    review_cycle_id TEXT NOT NULL REFERENCES review_cycles(id),

    -- Review content
    strengths TEXT,                        -- What they do well
    areas_for_improvement TEXT,            -- Development areas
    accomplishments TEXT,                  -- Key achievements this period
    goals_next_period TEXT,                -- Goals for next cycle
    manager_comments TEXT,                 -- Overall manager narrative
    self_assessment TEXT,                  -- Employee's self-review (if collected)

    -- Metadata
    reviewer_id TEXT REFERENCES employees(id),
    review_date TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(employee_id, review_cycle_id)
);

CREATE INDEX idx_reviews_employee ON performance_reviews(employee_id);
CREATE INDEX idx_reviews_cycle ON performance_reviews(review_cycle_id);

-- Full-text search for review content
CREATE VIRTUAL TABLE performance_reviews_fts USING fts5(
    strengths,
    areas_for_improvement,
    accomplishments,
    goals_next_period,
    manager_comments,
    self_assessment,
    content='performance_reviews',
    content_rowid='rowid'
);
```

---

## 5. eNPS Responses Table (NEW)

Employee Net Promoter Score tracking over time.

```sql
CREATE TABLE enps_responses (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES employees(id),

    -- eNPS data
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),  -- 0-10 scale
    survey_date TEXT NOT NULL,             -- When survey was taken
    survey_name TEXT,                      -- "Q4 2024 Pulse", "Annual 2024"

    -- Optional follow-up
    feedback_text TEXT,                    -- Open-ended response

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_enps_employee ON enps_responses(employee_id);
CREATE INDEX idx_enps_date ON enps_responses(survey_date);
CREATE INDEX idx_enps_score ON enps_responses(score);
```

### eNPS Scoring
| Score Range | Category | Description |
|-------------|----------|-------------|
| 9-10 | Promoter | Highly engaged, likely to recommend |
| 7-8 | Passive | Satisfied but not enthusiastic |
| 0-6 | Detractor | Unhappy, potential flight risk |

**eNPS Calculation:** `(% Promoters) - (% Detractors)`

---

## 6. Updated TypeScript Types

```typescript
// src/lib/types.ts additions

export interface Employee {
  id: string;
  email: string;
  full_name: string;
  department?: string;
  job_title?: string;
  manager_id?: string;
  hire_date?: string;
  work_state?: string;
  status: 'active' | 'terminated' | 'leave';

  // Demographics (V1 expansion)
  date_of_birth?: string;
  gender?: string;
  ethnicity?: string;

  // Termination details
  termination_date?: string;
  termination_reason?: 'voluntary' | 'involuntary' | 'retirement' | 'other';

  extra_fields?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReviewCycle {
  id: string;
  name: string;
  cycle_type: 'annual' | 'semi-annual' | 'quarterly';
  start_date: string;
  end_date: string;
  status: 'active' | 'closed';
  created_at: string;
}

export interface PerformanceRating {
  id: string;
  employee_id: string;
  review_cycle_id: string;
  overall_rating: number;        // 1.0 - 5.0
  goals_rating?: number;
  competencies_rating?: number;
  reviewer_id?: string;
  rating_date?: string;
  created_at: string;
  updated_at: string;
}

export interface PerformanceReview {
  id: string;
  employee_id: string;
  review_cycle_id: string;
  strengths?: string;
  areas_for_improvement?: string;
  accomplishments?: string;
  goals_next_period?: string;
  manager_comments?: string;
  self_assessment?: string;
  reviewer_id?: string;
  review_date?: string;
  created_at: string;
  updated_at: string;
}

export interface EnpsResponse {
  id: string;
  employee_id: string;
  score: number;                 // 0-10
  survey_date: string;
  survey_name?: string;
  feedback_text?: string;
  created_at: string;
}

// Computed types for analytics
export type EnpsCategory = 'promoter' | 'passive' | 'detractor';

export interface EmployeeWithPerformance extends Employee {
  latest_rating?: number;
  latest_enps?: number;
  enps_category?: EnpsCategory;
}
```

---

## 7. File Format Ingestion (V1)

### Supported Formats

| Format | Extension | Library | Notes |
|--------|-----------|---------|-------|
| CSV | .csv | Built-in Rust | Primary format |
| Excel | .xlsx, .xls | `calamine` crate | Most common HRIS export |
| TSV | .tsv | Built-in Rust | Tab-separated variant |

### Import File Types

| Data Type | Expected Columns | Notes |
|-----------|-----------------|-------|
| **Employees** | email, full_name, department, job_title, hire_date, work_state, status, date_of_birth, gender, ethnicity | Merge by email |
| **Performance Ratings** | employee_email, cycle_name, overall_rating, goals_rating, competencies_rating, rating_date | Match employee by email |
| **Performance Reviews** | employee_email, cycle_name, strengths, areas_for_improvement, accomplishments, manager_comments | Match employee by email |
| **eNPS** | employee_email, score, survey_date, survey_name, feedback_text | Match employee by email |

### V2 Deferred
- PDF parsing (requires OCR or structured extraction)
- DOCX parsing
- HRIS API connectors (Workday, BambooHR, etc.)

---

## 8. Test Data Specification

### Distribution (100 Employees)

| Category | Count | Notes |
|----------|-------|-------|
| Active | 82 | Currently employed |
| Terminated | 12 | Mix of voluntary (8) and involuntary (4) |
| On Leave | 6 | Parental, medical, sabbatical |

### Department Distribution

| Department | Count | Notes |
|------------|-------|-------|
| Engineering | 28 | Largest department |
| Sales | 18 | |
| Marketing | 12 | |
| Operations | 14 | |
| HR | 6 | Including the user persona |
| Finance | 8 | |
| Customer Success | 10 | |
| Executive | 4 | C-suite |

### Tenure Distribution

| Tenure | Count | Notes |
|--------|-------|-------|
| < 1 year | 15 | New hires |
| 1-2 years | 22 | |
| 2-5 years | 35 | Core employees |
| 5-10 years | 20 | Senior tenure |
| 10+ years | 8 | Long-term employees |

### Performance Distribution (per cycle)

| Rating | % of Employees | Notes |
|--------|----------------|-------|
| 5.0 (Exceptional) | 8% | Top performers |
| 4.0-4.9 (Exceeds) | 22% | Strong performers |
| 3.0-3.9 (Meets) | 55% | Solid performers |
| 2.0-2.9 (Developing) | 12% | Needs improvement |
| 1.0-1.9 (Unsatisfactory) | 3% | Performance issues |

### eNPS Distribution

| Category | % of Responses | Score Range |
|----------|----------------|-------------|
| Promoters | 35% | 9-10 |
| Passives | 40% | 7-8 |
| Detractors | 25% | 0-6 |

**Target eNPS:** +10 (35% - 25% = 10)

### Interesting Cases to Include

| Scenario | Employee Example | Purpose |
|----------|-----------------|---------|
| Flight risk | High performer with declining eNPS | "Who might leave?" |
| PIP candidate | Multiple low ratings | "Who's underperforming?" |
| Promotion ready | Consistently exceeds, long tenure | "Who's ready for promotion?" |
| New hire struggle | Recent hire, mixed reviews | Onboarding context |
| Work anniversary | Hire date = this week | Monday digest |
| Long tenure | 12+ years, steady performer | "Who's been here longest?" |
| Recent termination | Left last month | "What happened with X?" |
| Parental leave | Currently out | "When is X back?" |
| Manager with issues | Team has low eNPS | Manager effectiveness |
| Remote in different state | CA employee, NY company | State law questions |

### Review Cycles to Generate

| Cycle | Type | Date Range |
|-------|------|------------|
| 2023 Annual Review | annual | 2023-01-01 to 2023-12-31 |
| 2024 Annual Review | annual | 2024-01-01 to 2024-12-31 |
| Q1 2025 Check-in | quarterly | 2025-01-01 to 2025-03-31 |

### eNPS Surveys to Generate

| Survey | Date |
|--------|------|
| Q2 2024 Pulse | 2024-06-15 |
| Q4 2024 Pulse | 2024-12-15 |
| Q1 2025 Pulse | 2025-03-15 |

---

## 9. Sample Queries This Enables

With this schema, Claude can answer:

**Performance:**
- "Who's been rated below 3.0 in the last two cycles?"
- "Show me Sarah's performance history"
- "What did her manager say about her communication skills?"
- "Who's ready for promotion?"

**Engagement:**
- "What's our current eNPS?"
- "Who are our detractors?"
- "Has engagement improved since last quarter?"
- "Which department has the lowest eNPS?"

**Demographics/DEI:**
- "What's our gender breakdown by department?"
- "What's the average tenure in Engineering?"
- "How diverse is our leadership team?"

**Retention:**
- "Who left in the past 6 months?"
- "Why did people leave? Voluntary vs involuntary?"
- "Who might be a flight risk?" (low eNPS + high performer)

**Context:**
- "Tell me about Sarah Chen" (pulls all relevant data)
- "How's the Marketing team doing?" (aggregated performance + eNPS)

---

## 10. Migration Plan

### Phase 2 Task Updates

| Task | Description |
|------|-------------|
| 2.1.0 | Create migration 002_performance_enps.sql |
| 2.1.1 | Update employees.rs with new fields + CRUD |
| 2.1.2 | Create review_cycles.rs |
| 2.1.3 | Create performance_ratings.rs |
| 2.1.4 | Create performance_reviews.rs |
| 2.1.5 | Create enps.rs |
| 2.1.6 | Add Excel (.xlsx) parsing with calamine |
| 2.1.7 | Create multi-format FileDropzone |
| 2.1.8 | Generate 100-employee test dataset |

---

*Approved: 2025-12-15*
*Implementation: Phase 2.1*
