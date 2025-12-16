# Phase 2.1.D — Test Data Generator Plan

> **Purpose:** Standalone implementation plan for test data generation tasks 2.1.18-2.1.21
> **Sessions Required:** 2-3 (script creation, employee generation, performance/eNPS generation)
> **Dependencies:** Phase 2.1.A-C must be complete (schema + backend + UI)

---

## Overview

Generate a realistic "Acme Corp" dataset with 100 employees, 3 review cycles, performance ratings, narrative reviews, and eNPS survey data. This data enables testing of all HR queries Claude will need to answer.

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

### Session 1: Infrastructure + Employees

**Task 2.1.18: Script infrastructure**
```bash
# Files to create:
scripts/generate-test-data.ts          # CLI entry point
scripts/generators/employees.ts        # Employee generator
scripts/generators/names.ts            # Name utilities
scripts/data/first-names.json          # Name data
scripts/data/last-names.json           # Name data
```

**Task 2.1.19: Employee generation**
1. Create name pools (diverse first/last names)
2. Implement department assignment with manager hierarchy
3. Implement tenure distribution
4. Create the 10 special case employees first (known IDs)
5. Generate remaining 90 employees with distributions
6. Output to `scripts/generated/employees.json`
7. Test import via existing `import_employees` endpoint

### Session 2: Performance Data

**Task 2.1.20: Review cycles + ratings + reviews**
```bash
# Files to create:
scripts/generators/review-cycles.ts    # Cycle generator
scripts/generators/performance.ts      # Ratings + reviews
scripts/data/review-templates.json     # Review text templates
```

1. Create 3 review cycles
2. Generate ratings for each employee per cycle (respecting rules)
3. Generate narrative reviews with templated text
4. Output to `scripts/generated/`
5. Test import via existing endpoints

### Session 3: eNPS + Integration Test

**Task 2.1.21: eNPS generation**
```bash
# Files to create:
scripts/generators/enps.ts             # eNPS generator
scripts/data/enps-feedback.json        # Feedback templates
```

1. Generate 3 surveys
2. Generate 3 responses per active employee
3. Apply score patterns for special cases
4. Output and import

**Integration verification:**
- [ ] "Who's been here longest?" → Robert Kim
- [ ] "Who's underperforming?" → Marcus Johnson
- [ ] "What's our eNPS?" → ~+10
- [ ] "Tell me about Sarah Chen" → Shows declining engagement
- [ ] Employee panel shows 100 employees with filters working

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
