# Context Scaling Architecture

> **Status:** Planning
> **Priority:** High — This limits product scalability
> **Created:** 2025-12-17
> **Related:** `src-tauri/src/context.rs`

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

---

## Scale Analysis

### Data Size Per Employee

| Detail Level | Chars/Employee | Description |
|--------------|----------------|-------------|
| Full details | ~850 | Name, dept, title, hire date, status, 3 ratings, 3 eNPS |
| Summary | ~200 | Name, dept, status, latest rating, latest eNPS |
| Roster only | ~70 | Name, dept, status, hire date |

### Option A: Tiered Context (DOES NOT SCALE)

Always include full roster + detailed profiles for relevant employees.

| Org Size | Roster (70 chars each) | Detailed (5) | Aggregates | Total | Fits 16K? |
|----------|------------------------|--------------|------------|-------|-----------|
| 100 | 7K | 4K | 1K | 12K | ✓ |
| 200 | 14K | 4K | 1K | 19K | ❌ |
| 500 | 35K | 4K | 1K | 40K | ❌ |

**Breaks at ~200 employees.**

### Option B: Query-Adaptive Context (SCALES INFINITELY) ✓ RECOMMENDED

Include different context based on query intent.

| Query Type | Context Included | Size | Any Org Size? |
|------------|------------------|------|---------------|
| Aggregate ("What's our eNPS?") | Stats only | ~2K | ✓ |
| List ("Who's in Sales?") | Names + dept (paginated 30) | ~3K | ✓ |
| Individual ("Tell me about Sarah") | 1-3 full profiles | ~3K | ✓ |
| Comparison ("Top performers") | Stats + 5-8 detailed | ~8K | ✓ |
| Attrition ("What's our turnover?") | Stats + recent terms (10) | ~6K | ✓ |

**Scales to any org size.**

---

## Recommended Architecture: Query-Adaptive Context

### Always Include (~2K chars)

Every query gets org-level aggregates:

```
COMPANY CONTEXT:
• Name: Acme Corp
• HQ State: California

WORKFORCE OVERVIEW:
• Total employees: 100
• Active: 82 | Terminated: 12 | On Leave: 6

HEADCOUNT BY DEPARTMENT:
• Engineering: 28
• Sales: 18
• Marketing: 12
• Operations: 15
• Finance: 8
• HR: 5
• Executive: 4

PERFORMANCE SNAPSHOT:
• Org avg rating: 3.4 (Meets Expectations)
• Top performers (4.5+): 8 employees
• Needs improvement (<2.5): 3 employees

ENGAGEMENT:
• Current eNPS: +12
• Promoters: 34 | Passives: 28 | Detractors: 20
• Response rate: 82%

ATTRITION (YTD):
• Terminations: 12
• Voluntary: 8 (67%) | Involuntary: 4 (33%)
• Avg tenure at exit: 2.3 years
```

### Query-Dependent Context

**Aggregate Queries** ("What's our eNPS?", "How many engineers?")
- Just the always-included aggregates
- No individual employee data needed
- Claude can answer accurately from stats

**List Queries** ("Who's in Sales?", "Show me terminated employees")
- Paginated name list (max 30)
- Include: name, title, status, hire date
- Note: "Showing 18 of 18 Sales employees" or "Showing 30 of 82 active employees"

**Individual Queries** ("Tell me about Sarah Chen")
- Full profile for 1-3 specifically named employees
- All performance history (capped at 3 cycles)
- All eNPS responses (capped at 3 surveys)

**Comparison Queries** ("Who's underperforming?", "Top performers")
- Aggregates + detailed profiles for matches (5-8 max)
- Include ranking context ("3 of 82 employees rated below 2.5")

**Attrition Queries** ("What's our turnover?", "Recent departures")
- Attrition stats (already in aggregates)
- Recent terminations with details (10 max)
- Voluntary vs involuntary breakdown

---

## Implementation Plan

### Phase 1: Pre-computed Aggregates

Create new functions in `context.rs`:

```rust
// Always computed, always included
pub struct OrgAggregates {
    total_employees: i32,
    by_status: HashMap<String, i32>,      // active: 82, terminated: 12, leave: 6
    by_department: HashMap<String, i32>,  // Engineering: 28, Sales: 18, ...
    avg_rating: f32,
    avg_rating_by_dept: HashMap<String, f32>,
    top_performers_count: i32,            // rating >= 4.5
    needs_improvement_count: i32,         // rating < 2.5
    enps_score: i32,
    enps_breakdown: EnpsBreakdown,        // promoters, passives, detractors
    attrition_ytd: AttritionStats,
}

pub async fn build_org_aggregates(pool: &DbPool) -> Result<OrgAggregates, ContextError>
```

### Phase 2: Query Intent Classification

Enhance `extract_mentions()` to classify query type:

```rust
pub enum QueryType {
    Aggregate,      // "How many...", "What's our...", "Overall..."
    List,           // "Who's in...", "Show me...", "List..."
    Individual,     // Contains specific name(s)
    Comparison,     // "Top...", "Best...", "Underperforming..."
    Attrition,      // "Turnover", "left", "terminated", "attrition"
}

pub fn classify_query(message: &str) -> QueryType
```

### Phase 3: Adaptive Context Builder

Refactor `build_chat_context()`:

```rust
pub async fn build_chat_context(pool: &DbPool, message: &str) -> Result<ChatContext, ContextError> {
    // Always include
    let aggregates = build_org_aggregates(pool).await?;

    // Query-dependent
    let query_type = classify_query(message);
    let employee_context = match query_type {
        QueryType::Aggregate => String::new(), // Aggregates are enough
        QueryType::List => build_employee_list(pool, &mentions, 30).await?,
        QueryType::Individual => build_individual_profiles(pool, &mentions).await?,
        QueryType::Comparison => build_comparison_context(pool, &mentions, 8).await?,
        QueryType::Attrition => build_attrition_context(pool, 10).await?,
    };

    // Combine
    Ok(ChatContext {
        aggregates,
        employee_context,
        company,
        memories,
    })
}
```

### Phase 4: Format Functions

```rust
pub fn format_org_aggregates(agg: &OrgAggregates) -> String
pub fn format_employee_list(employees: &[EmployeeSummary], showing: usize, total: usize) -> String
pub fn format_employee_profiles(employees: &[EmployeeContext]) -> String
```

---

## Testing Checklist

After implementation, verify:

- [ ] "How many employees do we have?" → Returns exact count (100)
- [ ] "What's our eNPS?" → Calculates from ALL responses
- [ ] "Who's in Engineering?" → Lists all 28, not just 10
- [ ] "Tell me about Sarah Chen" → Full profile with perf history
- [ ] "Who's underperforming?" → Finds all <2.5 ratings
- [ ] "What's our attrition rate?" → Accurate YTD calculation
- [ ] Works with 500 simulated employees (load test)

---

## Open Questions

1. **Pagination UX:** When listing employees, should Claude say "Here are the first 30, ask for more if needed" or just list what fits?

2. **Caching:** Should aggregates be cached and refreshed periodically, or computed fresh each query?

3. **Memory integration:** Should memories reference the new aggregate format?

4. **Prompt suggestions:** Should contextual prompts reflect what queries are possible with current data?

---

## References

- Current implementation: `src-tauri/src/context.rs`
- Token budgets: `MAX_EMPLOYEE_CONTEXT_CHARS = 16,000`
- Performance cap: 3 cycles (already implemented)
- eNPS cap: 3 surveys (already implemented)

---

*Last updated: 2025-12-17*
