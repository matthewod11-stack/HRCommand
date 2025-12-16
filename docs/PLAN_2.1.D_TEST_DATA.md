# Phase 2.1.D — Test Data Generator Plan

> **Purpose:** Standalone implementation plan for test data generation tasks 2.1.18-2.1.21
> **Sessions Required:** 2-3 (script creation, employee generation, performance/eNPS generation)
> **Dependencies:** Phase 2.1.A-C must be complete (schema + backend + UI)

---

## Overview

Generate a realistic "Acme Corp" dataset with 100 employees, 3 review cycles, performance ratings, narrative reviews, and eNPS survey data. This data enables testing of all HR queries Claude will need to answer.

---

## Data Relationships (Critical)

All data is **relational** — every record references real entities from other tables:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA DEPENDENCY GRAPH                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │  REVIEW_CYCLES   │ ◄─── Generated FIRST (no dependencies)                │
│  │  (3 cycles)      │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           │ referenced by                                                   │
│           ▼                                                                 │
│  ┌──────────────────┐      ┌──────────────────┐                             │
│  │    EMPLOYEES     │ ◄────│  manager_id      │ (self-referential)          │
│  │  (100 employees) │      │  references      │                             │
│  │                  │      │  another employee│                             │
│  └────────┬─────────┘      └──────────────────┘                             │
│           │                                                                 │
│           │ employee_id + review_cycle_id + reviewer_id                     │
│           ▼                                                                 │
│  ┌──────────────────┐      ┌──────────────────┐                             │
│  │ PERF_RATINGS     │      │ PERF_REVIEWS     │                             │
│  │ (~280 ratings)   │      │ (~280 reviews)   │                             │
│  │                  │      │                  │                             │
│  │ • employee_id ───┼──────┼─► same employee  │                             │
│  │ • cycle_id ──────┼──────┼─► same cycle     │                             │
│  │ • reviewer_id ───┼──────┼─► employee's mgr │                             │
│  └──────────────────┘      └──────────────────┘                             │
│                                                                             │
│           │ employee_id                                                     │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │ ENPS_RESPONSES   │                                                       │
│  │ (~246 responses) │ ◄─── Only for ACTIVE employees at survey time         │
│  │                  │                                                       │
│  │ • employee_id ───┼─► same 100 employees                                  │
│  └──────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Generation Order (Strict)

| Step | Entity | Dependencies | Notes |
|------|--------|--------------|-------|
| 1 | Review Cycles | None | 3 cycles with known IDs |
| 2 | Employees (Executives) | None | CEO + VPs/Directors first |
| 3 | Employees (Managers) | Executives exist | Reference executive as manager |
| 4 | Employees (Individual Contributors) | Managers exist | Reference manager as manager |
| 5 | Performance Ratings | Employees + Cycles | reviewer_id = employee's manager_id |
| 6 | Performance Reviews | Employees + Cycles | reviewer_id = employee's manager_id |
| 7 | eNPS Responses | Employees | Only employees active at survey date |

### Shared ID Registry

A central `EmployeeRegistry` maintains all generated employee IDs:

```typescript
interface EmployeeRegistry {
  // Maps email → generated UUID (stable across all tables)
  byEmail: Map<string, string>;

  // Maps name → employee for special case lookups
  byName: Map<string, GeneratedEmployee>;

  // Manager lookup (employee_id → manager_id)
  managerOf: Map<string, string>;

  // Department members (dept → employee_ids[])
  byDepartment: Map<string, string[]>;
}

// Special case employees have KNOWN emails for stable references
const SPECIAL_EMPLOYEES = {
  SARAH_CHEN: 'sarah.chen@acmecorp.com',
  MARCUS_JOHNSON: 'marcus.johnson@acmecorp.com',
  // ... etc
};
```

### Relationship Integrity Rules

| Rule | Enforcement |
|------|-------------|
| Every employee's `manager_id` references a real employee | Generate managers before reports |
| Every rating's `reviewer_id` = the employee's `manager_id` | Lookup from registry |
| Terminated employees have NO ratings/reviews after termination_date | Filter by date |
| On-leave employees have ratings up to leave start date | Filter by date |
| eNPS only for employees who were active on survey_date | Check status + dates |
| Review cycle must exist before any ratings reference it | Generate cycles first |

### Example: Sarah Chen's Complete Data

```typescript
// 1. Employee record
{
  id: "emp_sarah_001",           // Generated UUID, stored in registry
  email: "sarah.chen@acmecorp.com",
  full_name: "Sarah Chen",
  department: "Marketing",
  manager_id: "emp_dir_marketing", // Director of Marketing's ID
  hire_date: "2021-03-15",
  status: "active",
  // ...
}

// 2. Her ratings (references her ID + her manager as reviewer)
{
  employee_id: "emp_sarah_001",      // ← Same ID
  review_cycle_id: "rc_2024_annual", // ← Real cycle ID
  reviewer_id: "emp_dir_marketing",  // ← Her manager's ID
  overall_rating: 4.5,
  // ...
}

// 3. Her reviews (same references)
{
  employee_id: "emp_sarah_001",      // ← Same ID
  review_cycle_id: "rc_2024_annual", // ← Same cycle
  reviewer_id: "emp_dir_marketing",  // ← Same manager
  strengths: "Exceptional campaign performance...",
  // ...
}

// 4. Her eNPS (declining pattern: 9 → 7 → 6)
[
  { employee_id: "emp_sarah_001", survey_date: "2024-06-15", score: 9 },
  { employee_id: "emp_sarah_001", survey_date: "2024-12-15", score: 7 },
  { employee_id: "emp_sarah_001", survey_date: "2025-03-15", score: 6 },
]
```

---

## Task Breakdown

| Task | Description | Session | Est. LOC |
|------|-------------|---------|----------|
| 2.1.18 | Create test data generator script infrastructure | 1 | ~200 |
| 2.1.19 | Generate 100 Acme Corp employees | 1-2 | ~300 |
| 2.1.20 | Generate 3 review cycles with ratings + reviews | 2 | ~400 |
| 2.1.21 | Generate 3 eNPS surveys (3 responses per employee) | 2-3 | ~150 |

**Total estimated:** ~1,050 lines TypeScript

---

## Architecture Decision

### Approach: TypeScript CLI Script → SQL Import

```
scripts/generate-test-data.ts
    ↓
Generates JSON files with all data
    ↓
Uses Tauri invoke() to insert via existing CRUD
    ↓
Validates data integrity after insert
```

**Why this approach:**
1. Tests the actual import path we built
2. TypeScript gives us strong typing matching our interfaces
3. Can run from command line: `npx ts-node scripts/generate-test-data.ts`
4. Reusable for demo resets or dev environment setup

**Alternative considered:** Direct SQLite inserts via a Rust binary
- Rejected: Doesn't test our Tauri command layer

---

## File Structure

```
scripts/
├── generate-test-data.ts        # Main CLI entry point
├── generators/
│   ├── employees.ts             # Employee generation logic
│   ├── review-cycles.ts         # Review cycle generation
│   ├── performance.ts           # Ratings + reviews generation
│   ├── enps.ts                  # eNPS survey generation
│   └── names.ts                 # Name/email generation utilities
├── data/
│   ├── first-names.json         # ~200 diverse first names
│   ├── last-names.json          # ~200 diverse last names
│   ├── review-templates.json    # Performance review snippets
│   └── enps-feedback.json       # eNPS feedback templates
└── generated/                   # Output directory (gitignored)
    ├── employees.json
    ├── review-cycles.json
    ├── ratings.json
    ├── reviews.json
    └── enps.json
```

---

## Employee Generation (Task 2.1.19)

### Distribution Requirements (from SCHEMA_EXPANSION_V1.md)

#### Status Distribution (100 employees)
| Status | Count | Notes |
|--------|-------|-------|
| Active | 82 | Currently employed |
| Terminated | 12 | 8 voluntary, 4 involuntary |
| On Leave | 6 | Parental, medical, sabbatical |

#### Department Distribution
| Department | Count | Manager | Notes |
|------------|-------|---------|-------|
| Engineering | 28 | 1 VP + 3 managers | Largest dept |
| Sales | 18 | 1 VP + 2 managers | |
| Marketing | 12 | 1 Director | |
| Operations | 14 | 1 Director + 1 manager | |
| HR | 6 | 1 Director | User persona dept |
| Finance | 8 | 1 Director | |
| Customer Success | 10 | 1 Manager | |
| Executive | 4 | CEO reports to no one | C-suite |

#### Tenure Distribution
| Tenure | Count | Hire Date Range |
|--------|-------|-----------------|
| < 1 year | 15 | 2025-01-01 to 2025-12-16 |
| 1-2 years | 22 | 2023-01-01 to 2024-12-31 |
| 2-5 years | 35 | 2020-01-01 to 2022-12-31 |
| 5-10 years | 20 | 2015-01-01 to 2019-12-31 |
| 10+ years | 8 | Before 2015-01-01 |

#### Work State Distribution
| State | Count | Notes |
|-------|-------|-------|
| California | 45 | HQ state |
| New York | 15 | East coast hub |
| Texas | 12 | Remote workers |
| Colorado | 8 | |
| Washington | 8 | |
| Remote (various) | 12 | Mix of other states |

#### Demographics Distribution
| Gender | % |
|--------|---|
| Male | 48% |
| Female | 47% |
| Non-binary | 3% |
| Prefer not to say | 2% |

| Ethnicity | % |
|-----------|---|
| White | 45% |
| Asian | 25% |
| Hispanic/Latino | 15% |
| Black/African American | 10% |
| Two or more | 3% |
| Prefer not to say | 2% |

### Org Hierarchy

```
CEO (1)
├── VP Engineering (1)
│   ├── Engineering Manager 1 (1) → 8 engineers
│   ├── Engineering Manager 2 (1) → 8 engineers
│   └── Engineering Manager 3 (1) → 8 engineers
├── VP Sales (1)
│   ├── Sales Manager 1 (1) → 8 sales reps
│   └── Sales Manager 2 (1) → 7 sales reps
├── Director Marketing (1) → 11 marketers
├── Director Operations (1)
│   └── Operations Manager (1) → 12 ops staff
├── Director HR (1) → 5 HR staff (including "Alex" persona)
├── Director Finance (1) → 7 finance staff
└── CS Manager (1) → 9 CS reps
```

### Special Cases to Generate (10 specific employees)

| # | Name | Role | Special Attribute | Query It Answers |
|---|------|------|-------------------|------------------|
| 1 | Sarah Chen | Marketing Manager | High performer (4.5+), declining eNPS (9→6) | "Who might leave?" |
| 2 | Marcus Johnson | Sales Rep | Two cycles < 2.5 rating | "Who's underperforming?" |
| 3 | Elena Rodriguez | Senior Engineer | 4.5+ ratings, 6 years tenure | "Who's ready for promotion?" |
| 4 | James Park | Junior Engineer | Hired 3 months ago, 2.8 rating | New hire struggle |
| 5 | Lisa Thompson | Operations | Hire date = Dec 20, 2020 | Work anniversary query |
| 6 | Robert Kim | Finance | 12 years tenure, steady 3.5 | "Who's been here longest?" |
| 7 | Amanda Foster | Sales | Terminated last month, voluntary | "What happened with Amanda?" |
| 8 | David Nguyen | Engineering | On parental leave since Nov | "When is David back?" |
| 9 | Jennifer Walsh | Eng Manager | Team avg eNPS = 5.2 | Manager effectiveness |
| 10 | Michael Brown | Remote Eng | CA resident, company in NY | State law questions |

---

## Review Cycles (Task 2.1.20)

### Cycles to Generate

| ID | Name | Type | Start | End | Status |
|----|------|------|-------|-----|--------|
| `rc_2023_annual` | 2023 Annual Review | annual | 2023-01-01 | 2023-12-31 | closed |
| `rc_2024_annual` | 2024 Annual Review | annual | 2024-01-01 | 2024-12-31 | closed |
| `rc_2025_q1` | Q1 2025 Check-in | quarterly | 2025-01-01 | 2025-03-31 | active |

### Rating Distribution Per Cycle

| Rating Band | % | Count (per 100) |
|-------------|---|-----------------|
| 5.0 (Exceptional) | 8% | 8 |
| 4.0-4.9 (Exceeds) | 22% | 22 |
| 3.0-3.9 (Meets) | 55% | 55 |
| 2.0-2.9 (Developing) | 12% | 12 |
| 1.0-1.9 (Unsatisfactory) | 3% | 3 |

### Rating Consistency Rules

1. **High performers** (IDs 1, 3): 4.0+ all cycles
2. **Struggling performers** (ID 2): < 3.0 two cycles
3. **New hires** (ID 4): Only 2024 Annual + Q1 2025 ratings
4. **Terminated** (ID 7): Only 2023 + 2024 Annual (no Q1 2025)
5. **On leave** (ID 8): Has Q1 2025 rating from before leave
6. **General pattern**: ±0.5 variance between cycles for continuity

### Performance Review Narratives

Generate templated reviews with these fields:
- `strengths`: 2-3 sentences
- `areas_for_improvement`: 1-2 sentences
- `accomplishments`: 2-3 bullet points (as sentence)
- `manager_comments`: 1-2 sentences overall assessment

**Template approach:**

```typescript
const strengthTemplates = {
  high: [
    "Consistently delivers exceptional results. Technical skills are top-tier.",
    "A go-to person for complex problems. Excellent communication.",
    "Demonstrates strong leadership potential. Mentors junior team members.",
  ],
  mid: [
    "Meets expectations consistently. Good team collaborator.",
    "Reliable performer with solid technical foundation.",
    "Communicates effectively with stakeholders.",
  ],
  low: [
    "Shows potential but needs more focus on delivery.",
    "Technical skills are developing. Needs more experience.",
  ],
};
```

---

## eNPS Surveys (Task 2.1.21)

### Surveys to Generate

| Survey Name | Date | Notes |
|-------------|------|-------|
| Q2 2024 Pulse | 2024-06-15 | Baseline |
| Q4 2024 Pulse | 2024-12-15 | Recent |
| Q1 2025 Pulse | 2025-03-15 | Most recent |

### Score Distribution Per Survey

| Category | Score | % | Count |
|----------|-------|---|-------|
| Promoter | 9-10 | 35% | 35 |
| Passive | 7-8 | 40% | 40 |
| Detractor | 0-6 | 25% | 25 |

**Target eNPS:** +10 (35% - 25%)

### Score Patterns

1. **Flight risk** (Sarah Chen): 9 → 7 → 6 (declining)
2. **Happy employee**: 9 → 9 → 10 (stable high)
3. **Disengaged**: 5 → 4 → 5 (stable low)
4. **Improving**: 6 → 7 → 8 (trending up)
5. **Manager issue** (Jennifer's team): Average 5.2 across her reports

### Feedback Templates

```typescript
const feedbackByScore = {
  promoter: [
    "Love the team culture and growth opportunities!",
    "Best company I've worked for. Great leadership.",
    "Excellent work-life balance and interesting projects.",
  ],
  passive: [
    "Good place to work, but compensation could be better.",
    "Generally satisfied, though career paths could be clearer.",
    "Nice people, but sometimes communication gaps between teams.",
  ],
  detractor: [
    "Feeling burnt out. Workload is unsustainable.",
    "Leadership decisions feel disconnected from reality.",
    "Limited growth opportunities in my role.",
  ],
};
```

---

## Implementation Steps

### Session 1: Infrastructure + Employees (2.1.18 + 2.1.19)

**Goal:** Create the foundation that ALL other data depends on.

**Task 2.1.18: Script infrastructure**
```bash
# Files to create:
scripts/generate-test-data.ts              # CLI entry point
scripts/generators/registry.ts             # EmployeeRegistry (CRITICAL)
scripts/generators/employees.ts            # Employee generator
scripts/generators/names.ts                # Name utilities
scripts/data/first-names.json              # Name data
scripts/data/last-names.json               # Name data
```

**The EmployeeRegistry is the source of truth:**
```typescript
// registry.ts - Created FIRST, used by ALL generators
export class EmployeeRegistry {
  private employees: Map<string, GeneratedEmployee> = new Map();

  // Register an employee and get their stable ID
  register(employee: GeneratedEmployee): string;

  // Lookup methods for other generators
  getById(id: string): GeneratedEmployee;
  getByEmail(email: string): GeneratedEmployee;
  getManagerId(employeeId: string): string;
  getEmployeesByDepartment(dept: string): GeneratedEmployee[];
  getActiveOnDate(date: string): GeneratedEmployee[];

  // Serialize for downstream generators
  toJSON(): string;
  static fromJSON(json: string): EmployeeRegistry;
}
```

**Task 2.1.19: Employee generation (strict order)**

```
Step 1: Generate Review Cycles FIRST
        ↓ (no dependencies, but needed for date validation)
Step 2: Generate CEO (no manager_id)
        ↓
Step 3: Generate Executives (VP, Directors) - manager_id = CEO
        ↓
Step 4: Generate Managers - manager_id = their Executive
        ↓
Step 5: Generate ICs - manager_id = their Manager
        ↓
Step 6: Save EmployeeRegistry to disk (for Session 2)
```

**Output artifacts:**
```
scripts/generated/
├── registry.json           # ← EmployeeRegistry snapshot (REQUIRED for Session 2)
├── review-cycles.json      # 3 cycles
└── employees.json          # 100 employees with valid manager_ids
```

### Session 2: Performance Data (2.1.20)

**Prerequisite:** `registry.json` from Session 1 must exist.

**Task 2.1.20: Ratings + Reviews**
```bash
# Files to create:
scripts/generators/performance.ts          # Ratings + reviews generator
scripts/data/review-templates.json         # Review text templates
```

**Generation flow:**
```typescript
// 1. Load the registry from Session 1
const registry = EmployeeRegistry.fromJSON(
  fs.readFileSync('scripts/generated/registry.json')
);

// 2. For each employee, for each cycle they should have data for:
for (const employee of registry.getAllEmployees()) {
  for (const cycle of cycles) {
    // Skip if employee wasn't active during this cycle
    if (!wasActiveduringCycle(employee, cycle)) continue;

    // Get their manager from the registry
    const reviewerId = registry.getManagerId(employee.id);

    // Generate rating + review with proper foreign keys
    generateRating({
      employee_id: employee.id,        // ← From registry
      review_cycle_id: cycle.id,       // ← From cycles
      reviewer_id: reviewerId,         // ← From registry
      overall_rating: calculateRating(employee),
    });

    generateReview({
      employee_id: employee.id,
      review_cycle_id: cycle.id,
      reviewer_id: reviewerId,
      // ... templated narrative
    });
  }
}
```

**Special case handling:**
| Employee | Cycle Logic |
|----------|-------------|
| James Park (new hire) | Only 2024 Annual + Q1 2025 (hired Sept 2024) |
| Amanda Foster (terminated) | 2023 + 2024 only (terminated Nov 2024) |
| David Nguyen (on leave) | All 3 cycles (leave started after Q1 2025 review) |

**Output artifacts:**
```
scripts/generated/
├── registry.json           # (from Session 1)
├── review-cycles.json      # (from Session 1)
├── employees.json          # (from Session 1)
├── ratings.json            # NEW: ~280 ratings with valid FKs
└── reviews.json            # NEW: ~280 reviews with valid FKs
```

### Session 3: eNPS + Integration Test (2.1.21)

**Prerequisite:** `registry.json` from Session 1 must exist.

**Task 2.1.21: eNPS generation**
```bash
# Files to create:
scripts/generators/enps.ts                 # eNPS generator
scripts/data/enps-feedback.json            # Feedback templates
```

**Generation flow:**
```typescript
// 1. Load registry
const registry = EmployeeRegistry.fromJSON(...);

// 2. Define surveys with dates
const surveys = [
  { name: 'Q2 2024 Pulse', date: '2024-06-15' },
  { name: 'Q4 2024 Pulse', date: '2024-12-15' },
  { name: 'Q1 2025 Pulse', date: '2025-03-15' },
];

// 3. For each survey, generate responses for active employees
for (const survey of surveys) {
  const activeEmployees = registry.getActiveOnDate(survey.date);

  for (const employee of activeEmployees) {
    generateEnpsResponse({
      employee_id: employee.id,  // ← From registry
      survey_date: survey.date,
      survey_name: survey.name,
      score: calculateScore(employee, survey),
      feedback_text: getTemplateFeedback(score),
    });
  }
}
```

**Output artifacts:**
```
scripts/generated/
├── registry.json           # (from Session 1)
├── review-cycles.json      # (from Session 1)
├── employees.json          # (from Session 1)
├── ratings.json            # (from Session 2)
├── reviews.json            # (from Session 2)
└── enps.json               # NEW: ~246 responses with valid employee_ids
```

### Integration Verification Checklist

After all data is imported, verify these queries:

**Relational integrity:**
- [ ] Every `performance_ratings.employee_id` exists in `employees.id`
- [ ] Every `performance_ratings.reviewer_id` exists in `employees.id`
- [ ] Every `performance_ratings.review_cycle_id` exists in `review_cycles.id`
- [ ] Every `performance_reviews.employee_id` exists in `employees.id`
- [ ] Every `enps_responses.employee_id` exists in `employees.id`
- [ ] Every `employees.manager_id` (except CEO) exists in `employees.id`

**Business logic:**
- [ ] "Who's been here longest?" → Robert Kim (12 years)
- [ ] "Who's underperforming?" → Marcus Johnson (< 2.5 two cycles)
- [ ] "What's our eNPS?" → ~+10 (35% promoters - 25% detractors)
- [ ] "Tell me about Sarah Chen" → High performer + declining eNPS
- [ ] "Who might leave?" → Sarah Chen (high perf, declining engagement)
- [ ] Amanda Foster has NO Q1 2025 data (terminated Nov 2024)
- [ ] David Nguyen shows as "on leave" with all performance data

---

## Script Usage

```bash
# Generate all test data
npm run generate-test-data

# Or step by step
npx ts-node scripts/generate-test-data.ts --employees
npx ts-node scripts/generate-test-data.ts --cycles
npx ts-node scripts/generate-test-data.ts --ratings
npx ts-node scripts/generate-test-data.ts --enps
npx ts-node scripts/generate-test-data.ts --all

# Clear existing data (for re-runs)
npx ts-node scripts/generate-test-data.ts --clear
```

---

## Verification Queries

After data generation, verify these queries work:

| Query | Expected Result |
|-------|-----------------|
| `SELECT COUNT(*) FROM employees` | 100 |
| `SELECT COUNT(*) FROM employees WHERE status = 'active'` | 82 |
| `SELECT COUNT(*) FROM review_cycles` | 3 |
| `SELECT COUNT(*) FROM performance_ratings` | ~280 (some employees miss cycles) |
| `SELECT COUNT(*) FROM performance_reviews` | ~280 |
| `SELECT COUNT(*) FROM enps_responses` | ~246 (82 active × 3 surveys) |
| `SELECT AVG(score) FROM enps_responses` | ~7.0 |
| `SELECT full_name FROM employees ORDER BY hire_date LIMIT 1` | Robert Kim (longest tenure) |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Name generation creates duplicates | Use email as unique key, append numbers if needed |
| Rating distribution off | Verify counts after generation, adjust weights |
| Review text feels repetitive | Large template pool (20+ per category) |
| Manager hierarchy broken | Generate managers first, then assign reports |
| Terminated employees have future data | Filter by termination_date in generators |

---

## Package Dependencies

Add to `package.json` devDependencies:
```json
{
  "faker": "^6.6.6" // Or use custom pools for more control
}
```

Or use custom name pools for more predictable, diverse names without external dependency.

---

## Success Criteria

- [ ] 100 employees with correct distributions
- [ ] 10 special case employees identifiable by name
- [ ] 3 review cycles in database
- [ ] Ratings match distribution targets (±5%)
- [ ] Reviews have readable narrative text
- [ ] eNPS scores yield ~+10 company score
- [ ] All UI components render data correctly
- [ ] Script is re-runnable (clear + regenerate)

---

*Created: 2025-12-16*
*Status: Ready for implementation*
*Next: Session 1 - Infrastructure + Employees (2.1.18, 2.1.19)*
