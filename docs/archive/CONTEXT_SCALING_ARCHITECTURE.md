# Context Scaling Architecture

> **Status:** Planning
> **Priority:** High — This limits product scalability
> **Created:** 2025-12-17
> **Related:** `src-tauri/src/context.rs`
> **Approach:** Option B — Query-Adaptive Context

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture](#current-architecture)
3. [Scale Analysis](#scale-analysis)
4. [Query-Adaptive Architecture](#query-adaptive-architecture)
5. [Data Structures](#data-structures)
6. [Query Classification](#query-classification)
7. [SQL Queries](#sql-queries)
8. [Implementation Phases](#implementation-phases)
9. [Edge Cases](#edge-cases)
10. [Migration Path](#migration-path)
11. [Testing](#testing)
12. [Design Decisions](#design-decisions)
13. [References](#references)

---

## Problem Statement

The current context builder has a hard limit of 10 employees (`MAX_EMPLOYEES_IN_CONTEXT`), which:
- Prevents accurate aggregate queries ("How many people in Engineering?")
- Misses employees in list queries ("Who's in Sales?" may miss people)
- Can't calculate true org-wide metrics (eNPS, attrition)
- Doesn't scale beyond small teams

**All employees matter** — not just active ones. Attrition queries need terminated employees, leave queries need people on leave. The context must account for the full workforce.

---

## Current Architecture

```
Query → Extract Intent → Find ~10 Relevant Employees → Include Full Details → Send to Claude
                                    ↑
                           16K char budget (~4K tokens)
                           ~800-1000 chars per employee with full perf data
```

**Current limits in `context.rs`:**
- `MAX_EMPLOYEES_IN_CONTEXT = 10`
- `MAX_EMPLOYEE_CONTEXT_CHARS = 16,000`
- Performance data: already capped at 3 most recent cycles ✓
- eNPS data: already capped at 3 most recent surveys ✓

**What exists that we can reuse:**
- `QueryMentions` struct with keyword detection flags
- `EnpsAggregate` struct and `calculate_aggregate_enps()`
- `find_relevant_employees()` with priority routing
- Specialized retrieval: `find_top_performers()`, `find_underperformers()`, etc.

---

## Scale Analysis

### Data Size Per Employee

| Detail Level | Chars/Employee | Description |
|--------------|----------------|-------------|
| Full details | ~850 | Name, dept, title, hire date, status, 3 ratings, 3 eNPS |
| Summary | ~200 | Name, dept, status, latest rating, latest eNPS |
| Roster only | ~70 | Name, dept, status, hire date |

### Why Option B (Query-Adaptive) Wins

| Query Type | Context Included | Size | Any Org Size? |
|------------|------------------|------|---------------|
| Aggregate ("What's our eNPS?") | Stats only | ~2K | ✓ |
| List ("Who's in Sales?") | Names + dept (paginated 30) | ~3K | ✓ |
| Individual ("Tell me about Sarah") | 1-3 full profiles | ~3K | ✓ |
| Comparison ("Top performers") | Stats + 5-8 detailed | ~8K | ✓ |
| Attrition ("What's our turnover?") | Stats + recent terms (10) | ~6K | ✓ |

**Scales to any org size** because we never include more than what the query needs.

---

## Query-Adaptive Architecture

### Always Include: Org Aggregates (~2K chars)

Every query gets org-level aggregates computed from the **full workforce**:

```
COMPANY CONTEXT:
• Name: Acme Corp
• HQ State: California

WORKFORCE OVERVIEW:
• Total employees: 100
• Active: 82 | Terminated: 12 | On Leave: 6

HEADCOUNT BY DEPARTMENT:
• Engineering: 28 (34%)
• Sales: 18 (22%)
• Marketing: 12 (15%)
• Operations: 15 (18%)
• Finance: 8 (10%)
• HR: 5 (6%)
• Executive: 4 (5%)

PERFORMANCE SNAPSHOT (active employees with ratings):
• Org avg rating: 3.4 (Meets Expectations)
• Rating distribution: 4.5+: 8 | 3.5-4.4: 32 | 2.5-3.4: 38 | <2.5: 4
• Employees with no rating: 12

ENGAGEMENT (most recent survey per employee):
• Current eNPS: +12
• Promoters (9-10): 34 | Passives (7-8): 28 | Detractors (0-6): 20
• Response rate: 82% (67 of 82 active)

ATTRITION (YTD 2025):
• Terminations: 12
• Voluntary: 8 (67%) | Involuntary: 4 (33%)
• Avg tenure at exit: 2.3 years
• Turnover rate: 14.6% annualized
```

### Query-Dependent Context

**Based on classified `QueryType`, append additional context:**

| QueryType | What to Add | Max Size |
|-----------|-------------|----------|
| `Aggregate` | Nothing — aggregates are sufficient | 0 |
| `List` | Paginated roster (30 max) with brief info | ~2K |
| `Individual` | Full profiles for 1-3 named employees | ~3K |
| `Comparison` | Top/bottom N with detailed profiles | ~6K |
| `Attrition` | Recent terminations with exit details | ~4K |
| `General` | Fallback: sample of relevant employees | ~4K |

---

## Data Structures

### New Types to Add

```rust
/// Query classification result
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueryType {
    /// Stats questions: "How many...", "What's our...", "Overall..."
    Aggregate,
    /// Roster questions: "Who's in...", "Show me...", "List all..."
    List,
    /// Named employee questions: "Tell me about Sarah", "What's John's rating?"
    Individual,
    /// Ranking questions: "Top performers", "Who's struggling", "Best in Sales"
    Comparison,
    /// Turnover questions: "Who left", "Attrition rate", "Recent departures"
    Attrition,
    /// Can't determine — use fallback behavior
    General,
}

/// Organization-wide aggregate statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgAggregates {
    // Headcount
    pub total_employees: i64,
    pub active_count: i64,
    pub terminated_count: i64,
    pub on_leave_count: i64,

    // By department (sorted by count descending)
    pub by_department: Vec<DepartmentCount>,

    // Performance (active employees only)
    pub avg_rating: Option<f64>,
    pub rating_distribution: RatingDistribution,
    pub employees_with_no_rating: i64,

    // Engagement
    pub enps: EnpsAggregate, // Already exists

    // Attrition
    pub attrition_ytd: AttritionStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepartmentCount {
    pub name: String,
    pub count: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatingDistribution {
    pub exceptional: i64,      // >= 4.5
    pub exceeds: i64,          // 3.5 - 4.49
    pub meets: i64,            // 2.5 - 3.49
    pub needs_improvement: i64, // < 2.5
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttritionStats {
    pub terminations_ytd: i64,
    pub voluntary: i64,
    pub involuntary: i64,
    pub avg_tenure_months: Option<f64>,
    pub turnover_rate_annualized: Option<f64>,
}

/// Lightweight employee summary for list queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmployeeSummary {
    pub id: String,
    pub full_name: String,
    pub department: Option<String>,
    pub job_title: Option<String>,
    pub status: String,
    pub hire_date: Option<String>,
}

/// Updated ChatContext with aggregates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatContext {
    pub company: Option<CompanyContext>,
    pub aggregates: OrgAggregates,           // NEW: always included
    pub query_type: QueryType,               // NEW: for debugging/logging
    pub employees: Vec<EmployeeContext>,     // Detailed profiles (when needed)
    pub employee_summaries: Vec<EmployeeSummary>, // Brief roster (for List queries)
    pub employee_ids_used: Vec<String>,
    pub memory_summaries: Vec<String>,
}
```

---

## Query Classification

### Classification Logic

The classifier examines the query and returns the **primary intent**. Priority order handles ambiguous queries:

```rust
pub fn classify_query(message: &str, mentions: &QueryMentions) -> QueryType {
    let lower = message.to_lowercase();

    // Priority 1: Individual (explicit names always win)
    if !mentions.names.is_empty() && !mentions.is_aggregate_query {
        return QueryType::Individual;
    }

    // Priority 2: Comparison (ranking/filtering)
    if mentions.is_top_performer_query || mentions.is_underperformer_query {
        return QueryType::Comparison;
    }

    // Priority 3: Attrition (turnover-specific)
    if is_attrition_query(&lower) {
        return QueryType::Attrition;
    }

    // Priority 4: List (roster requests)
    if is_list_query(&lower, mentions) {
        return QueryType::List;
    }

    // Priority 5: Aggregate (stats/counts or status checks)
    // "How's X doing?" = status check = aggregate
    if mentions.wants_aggregate || is_aggregate_query(&lower) || is_status_check(&lower) {
        return QueryType::Aggregate;
    }

    // Fallback
    QueryType::General
}
```

### Keyword Patterns by QueryType

**Aggregate** — wants a number or stat, not names:

```text
"how many", "what's our", "what is our", "total", "count", "average",
"overall", "company-wide", "org-wide", "percentage", "rate",
"our enps", "our rating", "headcount",
"how's ... doing", "how is ... doing"  // status check = aggregate
```

**List** — wants to see multiple people:

```text
"who's in", "who is in", "show me", "list", "all employees",
"everyone in", "people in", "members of", "the team"
```

Plus: department mentioned without aggregate keywords

**Individual** — asks about specific person(s):

```text
Names detected via QueryMentions.names (capitalized words)
"tell me about", "what about", "how is [Name] doing"
Possessives: "Sarah's", "John's"
```

**Comparison** — wants ranking/filtering:

```text
"top performer", "best", "highest rated", "star employee",
"underperforming", "struggling", "needs improvement", "lowest",
"compare", "rank", "who's doing well", "who's doing poorly"
```

**Attrition** — turnover focus:

```text
"attrition", "turnover", "who left", "departed", "terminated",
"resignation", "quit", "recent departures", "exit", "offboarding"
```

### Example Classifications

| Query | Type | Reason |
|-------|------|--------|
| "How many employees do we have?" | Aggregate | "how many" + no names |
| "What's our eNPS?" | Aggregate | "what's our" + eNPS keyword |
| "Who's in Engineering?" | List | "who's in" + department |
| "Tell me about Sarah Chen" | Individual | Detected name |
| "Who are our top performers?" | Comparison | "top performer" keyword |
| "What's our turnover rate?" | Aggregate | "rate" trumps attrition |
| "Who left this year?" | Attrition | "who left" |
| "Is Sarah struggling?" | Individual | Name + question about person |
| "How's the Sales team doing?" | Aggregate | "doing" = status check |

---

## SQL Queries

### Aggregate: Headcount by Status

```sql
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated,
    SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as on_leave
FROM employees
```

### Aggregate: Headcount by Department

```sql
SELECT
    COALESCE(department, 'Unassigned') as department,
    COUNT(*) as count
FROM employees
WHERE status = 'active'
GROUP BY department
ORDER BY count DESC
```

### Aggregate: Performance Distribution

```sql
-- Get most recent rating per active employee
WITH latest_ratings AS (
    SELECT
        pr.employee_id,
        pr.overall_rating,
        ROW_NUMBER() OVER (PARTITION BY pr.employee_id ORDER BY rc.end_date DESC) as rn
    FROM performance_ratings pr
    JOIN review_cycles rc ON pr.review_cycle_id = rc.id
    JOIN employees e ON pr.employee_id = e.id
    WHERE e.status = 'active'
)
SELECT
    AVG(overall_rating) as avg_rating,
    SUM(CASE WHEN overall_rating >= 4.5 THEN 1 ELSE 0 END) as exceptional,
    SUM(CASE WHEN overall_rating >= 3.5 AND overall_rating < 4.5 THEN 1 ELSE 0 END) as exceeds,
    SUM(CASE WHEN overall_rating >= 2.5 AND overall_rating < 3.5 THEN 1 ELSE 0 END) as meets,
    SUM(CASE WHEN overall_rating < 2.5 THEN 1 ELSE 0 END) as needs_improvement
FROM latest_ratings
WHERE rn = 1
```

### Aggregate: Attrition YTD

```sql
SELECT
    COUNT(*) as terminations,
    SUM(CASE WHEN termination_type = 'voluntary' THEN 1 ELSE 0 END) as voluntary,
    SUM(CASE WHEN termination_type = 'involuntary' THEN 1 ELSE 0 END) as involuntary,
    AVG(
        CAST((julianday(termination_date) - julianday(hire_date)) / 30 AS REAL)
    ) as avg_tenure_months
FROM employees
WHERE status = 'terminated'
  AND termination_date >= date('now', 'start of year')
```

### Aggregate: Turnover Rate

```sql
-- Annualized turnover = (terminations / avg headcount) * 12 / months elapsed
WITH period AS (
    SELECT
        (julianday('now') - julianday(date('now', 'start of year'))) / 30.0 as months_elapsed
),
terminations AS (
    SELECT COUNT(*) as count
    FROM employees
    WHERE status = 'terminated'
      AND termination_date >= date('now', 'start of year')
),
avg_headcount AS (
    -- Approximation: current active + half of terminations
    SELECT
        (SELECT COUNT(*) FROM employees WHERE status = 'active') +
        (SELECT count / 2.0 FROM terminations)
        as value
)
SELECT
    CASE
        WHEN (SELECT value FROM avg_headcount) > 0 AND (SELECT months_elapsed FROM period) > 0
        THEN ((SELECT count FROM terminations) / (SELECT value FROM avg_headcount)) * 12.0 / (SELECT months_elapsed FROM period) * 100
        ELSE NULL
    END as turnover_rate_annualized
```

### List Query: Department Roster

```sql
SELECT id, full_name, department, job_title, status, hire_date
FROM employees
WHERE department LIKE ?
  AND status = 'active'
ORDER BY full_name
LIMIT 30
```

### Attrition Query: Recent Terminations

```sql
SELECT
    e.id, e.full_name, e.department, e.job_title,
    e.hire_date, e.termination_date, e.termination_type, e.termination_reason
FROM employees e
WHERE e.status = 'terminated'
ORDER BY e.termination_date DESC
LIMIT 10
```

---

## Implementation Phases

### Phase 1: Data Structures & Aggregates (~2 hours)

**Files:** `src-tauri/src/context.rs`

1. Add new types: `QueryType`, `OrgAggregates`, `DepartmentCount`, etc.
2. Implement `build_org_aggregates(pool)` with SQL queries above
3. Implement `format_org_aggregates(agg)` to render the stats block
4. Add unit tests for aggregate calculations

**Tests:**
```rust
#[tokio::test]
async fn test_build_org_aggregates_empty_db()
#[tokio::test]
async fn test_build_org_aggregates_with_data()
#[test]
fn test_format_org_aggregates()
```

### Phase 2: Query Classification (~1.5 hours)

**Files:** `src-tauri/src/context.rs`

1. Implement `classify_query(message, mentions)` with priority logic
2. Add keyword pattern functions: `is_attrition_query()`, `is_list_query()`, etc.
3. Update `QueryMentions` if needed for new flags
4. Add unit tests for classification edge cases

**Tests:**
```rust
#[test]
fn test_classify_aggregate_queries()
#[test]
fn test_classify_list_queries()
#[test]
fn test_classify_individual_queries()
#[test]
fn test_classify_comparison_queries()
#[test]
fn test_classify_attrition_queries()
#[test]
fn test_classify_ambiguous_queries()
```

### Phase 3: Context Builder Refactor (~2 hours)

**Files:** `src-tauri/src/context.rs`

1. Update `ChatContext` struct with new fields
2. Refactor `build_chat_context()` to:
   - Always compute aggregates
   - Classify query type
   - Call appropriate retrieval function
3. Implement list-specific retrieval: `build_employee_list()`
4. Update `build_system_prompt()` to include aggregates section

**Key change:**
```rust
pub async fn build_chat_context(pool: &DbPool, message: &str) -> Result<ChatContext, ContextError> {
    let mentions = extract_mentions(message);
    let query_type = classify_query(message, &mentions);

    // Always compute aggregates (cheap SQL queries)
    let aggregates = build_org_aggregates(pool).await?;

    // Query-dependent employee retrieval
    let (employees, summaries) = match query_type {
        QueryType::Aggregate => (vec![], vec![]),
        QueryType::List => (vec![], build_employee_list(pool, &mentions, 30).await?),
        QueryType::Individual => (find_named_employees(pool, &mentions, 3).await?, vec![]),
        QueryType::Comparison => (find_comparison_employees(pool, &mentions, 8).await?, vec![]),
        QueryType::Attrition => (find_recent_terminations(pool, 10).await?, vec![]),
        QueryType::General => (find_relevant_employees(pool, &mentions, 5).await?, vec![]),
    };

    // ... rest of function
}
```

### Phase 4: Format & System Prompt (~1 hour)

**Files:** `src-tauri/src/context.rs`

1. Update `format_employee_context()` to handle summaries vs full profiles
2. Create `format_employee_list()` for roster output
3. Update `build_system_prompt()` to include aggregates block
4. Ensure total context stays under 16K chars

**Output structure:**
```
[Alex persona intro]

ORGANIZATION DATA:
[Aggregates block - always included]

[RELEVANT EMPLOYEES: - if QueryType requires]
[Employee details or roster]

[MEMORIES: - if relevant]
```

### Phase 5: Testing & Validation (~1.5 hours)

1. Run existing tests (should all pass)
2. Add integration tests with test data
3. Manual testing with various query types
4. Verify context size stays within budget

---

## Edge Cases

### Ambiguous Queries

| Query | Challenge | Resolution |
|-------|-----------|------------|
| "How's Sarah doing?" | Individual or performance? | Individual (name present) |
| "Engineering top performers" | List or Comparison? | Comparison ("top" keyword) |
| "Who are our detractors?" | eNPS category, not roster | Comparison (filtering by eNPS) |
| "Team morale" | Vague aggregate | Aggregate (show eNPS stats) |

### Multi-Intent Queries

"Tell me about the Engineering team and Sarah Chen's performance"

**Strategy:** Primary intent wins, but be generous with context:
- Classified as: `Individual` (Sarah mentioned)
- Include: Sarah's full profile + Engineering department aggregate stats

### Empty Results

| Scenario | Behavior |
|----------|----------|
| No employees in database | Return empty aggregates with zeros |
| No ratings data | Show "No performance data available" |
| No terminations YTD | Show "0 terminations" (not an error) |
| No match for named employee | Note "No employee found matching 'X'" |

### Department Name Variations

"DevOps" vs "Engineering" vs "Development" vs "R&D"

**Strategy:**
- Normalize during import (recommend standard names)
- Use LIKE matching for retrieval
- Show department names exactly as stored

---

## Migration Path

### Backward Compatibility

The new system should not break existing behavior:

1. **Existing `build_chat_context()` callers** continue to work
2. **`ChatContext` struct** has new fields but old fields remain
3. **System prompt format** adds aggregates section, doesn't remove anything

### Incremental Rollout

1. **Ship aggregates first** — add to every query, measure impact
2. **Ship classification** — log QueryType for analysis, don't change behavior
3. **Ship adaptive retrieval** — enable new logic behind feature flag
4. **Remove flag** — once confident in classification accuracy

### Feature Flag (Optional)

```rust
const USE_ADAPTIVE_CONTEXT: bool = true;

// In build_chat_context():
if USE_ADAPTIVE_CONTEXT {
    // New query-adaptive logic
} else {
    // Legacy behavior
}
```

---

## Testing

### Unit Tests

| Test | Validates |
|------|-----------|
| `test_classify_*` | Query classification accuracy |
| `test_build_org_aggregates_*` | SQL queries return correct counts |
| `test_format_org_aggregates` | Output format is parseable |
| `test_format_employee_list` | Roster pagination works |

### Integration Tests

| Test | Query | Expected Behavior |
|------|-------|-------------------|
| Headcount | "How many employees?" | Returns exact count from aggregates |
| Department list | "Who's in Engineering?" | Lists all Engineering employees (up to 30) |
| Individual | "Tell me about Sarah Chen" | Full profile with ratings/eNPS |
| eNPS aggregate | "What's our eNPS?" | Score calculated from all responses |
| Comparison | "Top performers" | Top 8 by rating with profiles |
| Attrition | "Who left this year?" | Recent 10 terminations with details |

### Manual Testing Matrix

```
[ ] Aggregate: "How many employees do we have?" → Exact count
[ ] Aggregate: "What's our eNPS?" → Score with breakdown
[ ] Aggregate: "Average performance rating?" → Org avg with distribution
[ ] List: "Who's in Sales?" → Full Sales roster
[ ] List: "Show me terminated employees" → Term list with dates
[ ] Individual: "Tell me about [name]" → Full profile
[ ] Comparison: "Who's underperforming?" → All <2.5 ratings
[ ] Comparison: "Top performers in Engineering" → Filtered list
[ ] Attrition: "Recent departures?" → 10 most recent terms
[ ] Mixed: "How's [name] doing compared to the team?" → Individual + context
```

### Load Testing

Generate 500 test employees and verify:
- [ ] Aggregate queries return in <100ms
- [ ] List queries return in <200ms (with 30 employee limit)
- [ ] Context size never exceeds 16K chars
- [ ] Memory usage stays reasonable

---

## Design Decisions

### D1: Pagination UX

**Decision:** Include count context, not explicit pagination.

**Why:** Claude is conversational. "Showing 30 of 82 active employees" lets Claude naturally say "There are 82 total — want me to focus on a specific group?"

**Format:**
```
EMPLOYEES (showing 30 of 82 active):
• Alice Adams — Engineering, Senior Engineer
• Bob Baker — Sales, Account Executive
...
```

### D2: Caching Strategy

**Decision:** Compute fresh each query (no caching for V1).

**Why:**
- Aggregates are cheap SQL queries (~5-10ms each)
- Data can change between queries (imports, edits)
- Caching adds complexity without clear benefit
- Can revisit if performance becomes an issue at scale

### D3: Memory Integration

**Decision:** Keep memory summaries as-is.

**Why:**
- Memories are already compact summaries
- They reference employee names, not aggregate stats
- No change needed to memory format

### D4: Contextual Prompts

**Decision:** Future enhancement (not in this scope).

**Why:**
- Useful but separate concern
- Can be added after core context scaling ships
- Depends on knowing what data exists (empty states)

### D5: Terminated Employee Inclusion

**Decision:** Include terminated employees in aggregate counts and attrition queries.

**Why:**
- "Total employees" means everyone ever recorded
- Attrition rate needs historical data
- Status breakdown shows active/terminated/leave split
- Individual terminated profiles available via name lookup

---

## References

| Resource | Location |
|----------|----------|
| Current implementation | `src-tauri/src/context.rs` |
| Token budgets | `MAX_EMPLOYEE_CONTEXT_CHARS = 16,000` |
| Performance cap | 3 cycles (already implemented) |
| eNPS cap | 3 surveys (already implemented) |
| Test data generator | `scripts/generate-test-data.ts` |
| Alex persona | `docs/HR_PERSONA.md` |

---

## Appendix: Sample Output

### Aggregate Query: "What's our eNPS?"

**Context sent to Claude:**
```
ORGANIZATION DATA:

COMPANY: Acme Corp (California)

WORKFORCE: 100 employees
• Active: 82 | Terminated: 12 | On Leave: 6

DEPARTMENTS:
• Engineering: 28 (34%) • Sales: 18 (22%) • Marketing: 12 (15%)
• Operations: 15 (18%) • Finance: 8 (10%) • HR: 5 (6%)

PERFORMANCE (82 active employees):
• Avg rating: 3.4 (Meets Expectations)
• Distribution: Exceptional: 8 | Exceeds: 32 | Meets: 38 | Needs Improvement: 4

ENGAGEMENT:
• eNPS: +12 (Promoters: 34, Passives: 28, Detractors: 20)
• Response rate: 82%

ATTRITION (YTD):
• Terminations: 12 (Voluntary: 8, Involuntary: 4)
• Turnover rate: 14.6% annualized
```

**Claude can now accurately say:** "Your current eNPS is +12, which is in the healthy range. You have 34 promoters, 28 passives, and 20 detractors out of 82 active employees who responded."

### List Query: "Who's in Engineering?"

**Context sent to Claude:**
```
[Aggregates block as above]

ENGINEERING TEAM (28 of 28 employees):
• Alice Adams — Senior Engineer (active, hired 2022-03-15)
• Bob Baker — Staff Engineer (active, hired 2020-08-01)
• Carol Chen — Engineering Manager (active, hired 2019-11-20)
... [25 more]
```

**Claude can now list all 28 engineers** without missing anyone.

---

*Last updated: 2025-12-17*
