// HR Command Center - Context Builder Module
// Builds contextual system prompts for Claude with company and employee data
//
// Key responsibilities:
// 1. Extract employee mentions from user queries
// 2. Retrieve relevant employees with performance/eNPS data
// 3. Build system prompts with the "Alex" HR persona
// 4. Manage context size to stay within token limits

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use thiserror::Error;

use crate::db::DbPool;

// ============================================================================
// Constants
// ============================================================================

/// Maximum characters for employee context section (approximate token budget)
/// ~4 chars per token, targeting ~2000 tokens for employee context
const MAX_EMPLOYEE_CONTEXT_CHARS: usize = 8000;

/// Maximum number of employees to include in context
const MAX_EMPLOYEES_IN_CONTEXT: usize = 10;

// ============================================================================
// Error Types
// ============================================================================

#[derive(Error, Debug, Serialize)]
pub enum ContextError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Context building error: {0}")]
    BuildError(String),
}

impl From<sqlx::Error> for ContextError {
    fn from(err: sqlx::Error) -> Self {
        ContextError::Database(err.to_string())
    }
}

// ============================================================================
// Employee Context Types
// ============================================================================

/// Employee with performance and eNPS data for context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmployeeContext {
    pub id: String,
    pub full_name: String,
    pub email: String,
    pub department: Option<String>,
    pub job_title: Option<String>,
    pub hire_date: Option<String>,
    pub work_state: Option<String>,
    pub status: String,
    pub manager_name: Option<String>,

    // Performance data
    pub latest_rating: Option<f64>,
    pub latest_rating_cycle: Option<String>,
    pub rating_trend: Option<String>, // "improving", "stable", "declining"
    pub all_ratings: Vec<RatingInfo>,

    // eNPS data
    pub latest_enps: Option<i32>,
    pub latest_enps_date: Option<String>,
    pub enps_trend: Option<String>,
    pub all_enps: Vec<EnpsInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RatingInfo {
    pub cycle_name: String,
    pub overall_rating: f64,
    pub rating_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnpsInfo {
    pub score: i32,
    pub survey_name: Option<String>,
    pub survey_date: String,
    pub feedback: Option<String>,
}

/// Company context for system prompt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyContext {
    pub name: String,
    pub state: String,
    pub industry: Option<String>,
    pub employee_count: i64,
    pub department_count: i64,
}

/// Full context for building system prompt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatContext {
    pub company: Option<CompanyContext>,
    pub employees: Vec<EmployeeContext>,
    pub employee_ids_used: Vec<String>,
    pub memory_summaries: Vec<String>, // Placeholder for Phase 2.4
}

// ============================================================================
// Query Analysis
// ============================================================================

/// Direction for tenure-based queries
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TenureDirection {
    /// "who's been here longest", "most senior"
    Longest,
    /// "newest employees", "recent hires", "just started"
    Newest,
    /// "upcoming anniversaries", "work anniversary"
    Anniversary,
}

/// Extracted mentions from a user query
#[derive(Debug, Clone, Default)]
pub struct QueryMentions {
    /// Potential employee names found in query
    pub names: Vec<String>,
    /// Department names found in query
    pub departments: Vec<String>,
    /// Keywords suggesting aggregate queries (team, all, everyone, etc.)
    pub is_aggregate_query: bool,
    /// Keywords suggesting performance-related queries
    pub is_performance_query: bool,
    /// Keywords suggesting eNPS-related queries
    pub is_enps_query: bool,
    /// Keywords suggesting tenure-related queries
    pub is_tenure_query: bool,
    /// Keywords suggesting top performer queries
    pub is_top_performer_query: bool,
    /// Keywords suggesting underperformer queries
    pub is_underperformer_query: bool,
    /// Specific tenure direction (longest vs newest vs anniversary)
    pub tenure_direction: Option<TenureDirection>,
    /// Whether query wants aggregate stats rather than individual employees
    pub wants_aggregate: bool,
}

/// Extract potential employee names and departments from a query
/// Uses simple heuristics - looks for capitalized words that could be names
pub fn extract_mentions(query: &str) -> QueryMentions {
    let mut mentions = QueryMentions::default();

    // Common HR-related keywords that indicate aggregate queries
    let aggregate_keywords = [
        "team", "all", "everyone", "department", "org", "organization",
        "headcount", "turnover", "attrition", "company-wide", "across",
    ];

    let performance_keywords = [
        "performance", "rating", "review", "performer",
        "pip", "improvement plan", "developing", "exceeds", "exceptional",
    ];

    let enps_keywords = [
        "enps", "nps", "promoter", "engagement", "satisfaction", "survey",
        "detractor", "passive", "morale",
    ];

    // Tenure query keywords - phrases for direction detection
    let tenure_longest_keywords = [
        "been here longest", "longest tenure", "most senior", "longest serving",
        "been here the longest", "here longest", "oldest employee", "most tenured",
    ];
    let tenure_newest_keywords = [
        "newest", "recent hire", "recently hired", "just started", "new employee",
        "just joined", "newest hire", "most recent hire", "started recently",
    ];
    let tenure_anniversary_keywords = [
        "anniversary", "work anniversary", "tenure milestone", "years of service",
    ];
    let tenure_general_keywords = [
        "tenure", "how long", "been here", "started", "hire date", "joined",
    ];

    // Top performer keywords (distinct from general performance)
    let top_performer_keywords = [
        "top performer", "best performer", "high performer", "star employee",
        "exceptional performer", "highest rated", "best rated", "top rated",
        "strongest performer", "a-player", "highest performer",
    ];

    // Underperformer keywords (distinct from general performance)
    let underperformer_keywords = [
        "underperform", "low performer", "struggling", "needs improvement",
        "below expectations", "poor performer", "weakest", "lowest rated",
        "performance issue", "performance problem", "not performing",
    ];

    // Aggregate stat keywords (wants calculation, not individuals)
    let wants_aggregate_keywords = [
        "our enps", "company enps", "overall enps", "average enps",
        "how many", "total", "count", "percentage", "average rating",
        "overall rating", "company-wide", "across the company",
    ];

    let query_lower = query.to_lowercase();

    // Check for aggregate query indicators
    mentions.is_aggregate_query = aggregate_keywords
        .iter()
        .any(|kw| query_lower.contains(kw));

    mentions.is_performance_query = performance_keywords
        .iter()
        .any(|kw| query_lower.contains(kw));

    mentions.is_enps_query = enps_keywords
        .iter()
        .any(|kw| query_lower.contains(kw));

    // Check for tenure-related queries and direction
    if tenure_longest_keywords.iter().any(|kw| query_lower.contains(kw)) {
        mentions.is_tenure_query = true;
        mentions.tenure_direction = Some(TenureDirection::Longest);
    } else if tenure_newest_keywords.iter().any(|kw| query_lower.contains(kw)) {
        mentions.is_tenure_query = true;
        mentions.tenure_direction = Some(TenureDirection::Newest);
    } else if tenure_anniversary_keywords.iter().any(|kw| query_lower.contains(kw)) {
        mentions.is_tenure_query = true;
        mentions.tenure_direction = Some(TenureDirection::Anniversary);
    } else if tenure_general_keywords.iter().any(|kw| query_lower.contains(kw)) {
        mentions.is_tenure_query = true;
        // No specific direction - could be asking about a specific person's tenure
    }

    // Check for top performer queries
    mentions.is_top_performer_query = top_performer_keywords
        .iter()
        .any(|kw| query_lower.contains(kw));

    // Check for underperformer queries
    mentions.is_underperformer_query = underperformer_keywords
        .iter()
        .any(|kw| query_lower.contains(kw));

    // Check if query wants aggregate stats (not individual employees)
    mentions.wants_aggregate = wants_aggregate_keywords
        .iter()
        .any(|kw| query_lower.contains(kw));

    // Extract potential names (capitalized words, 2+ chars, not at sentence start)
    // This is a simple heuristic - more sophisticated NER could be added later
    let words: Vec<&str> = query.split_whitespace().collect();

    for (i, word) in words.iter().enumerate() {
        // Strip possessives before other cleaning (Sarah's → Sarah)
        let mut working_word = *word;
        if working_word.ends_with("'s") || working_word.ends_with("'s") {
            working_word = &working_word[..working_word.len() - 2];
        } else if working_word.ends_with("s'") {
            working_word = &working_word[..working_word.len() - 2];
        }
        // Now clean remaining punctuation
        let clean_word = working_word.trim_matches(|c: char| !c.is_alphanumeric());

        // Skip if too short or all lowercase
        if clean_word.len() < 2 {
            continue;
        }

        let first_char = clean_word.chars().next().unwrap_or(' ');
        if !first_char.is_uppercase() {
            continue;
        }

        // Skip common non-name capitalized words
        let skip_words = [
            "I", "The", "What", "Who", "How", "When", "Where", "Why",
            "Can", "Could", "Would", "Should", "Is", "Are", "Was", "Were",
            "HR", "HR's", "PIP", "Q1", "Q2", "Q3", "Q4", "FY", "YTD",
            "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ];

        if skip_words.contains(&clean_word) {
            continue;
        }

        // Check if this might be a name (followed by another capitalized word = full name)
        if i + 1 < words.len() {
            let next_word = words[i + 1].trim_matches(|c: char| !c.is_alphanumeric());
            let next_first = next_word.chars().next().unwrap_or(' ');

            if next_first.is_uppercase() && !skip_words.contains(&next_word) {
                // Likely a full name
                mentions.names.push(format!("{} {}", clean_word, next_word));
            }
        }

        // Also add single names for partial matching
        if clean_word.len() >= 3 && !skip_words.contains(&clean_word) {
            mentions.names.push(clean_word.to_string());
        }
    }

    // Deduplicate names
    mentions.names.sort();
    mentions.names.dedup();

    // Extract department mentions (common department names)
    let department_names = [
        "Engineering", "Marketing", "Sales", "Finance", "HR", "Human Resources",
        "Operations", "Product", "Design", "Legal", "Customer Support",
        "Customer Success", "IT", "Research", "Development", "R&D",
    ];

    for dept in department_names {
        if query.to_lowercase().contains(&dept.to_lowercase()) {
            mentions.departments.push(dept.to_string());
        }
    }

    mentions
}

// ============================================================================
// Context Retrieval
// ============================================================================

/// Internal struct for employee query result
#[derive(Debug, FromRow)]
struct EmployeeRow {
    id: String,
    email: String,
    full_name: String,
    department: Option<String>,
    job_title: Option<String>,
    hire_date: Option<String>,
    work_state: Option<String>,
    status: String,
    manager_id: Option<String>,
}

/// Internal struct for rating query result
#[derive(Debug, FromRow)]
struct RatingRow {
    overall_rating: f64,
    cycle_name: String,
    rating_date: Option<String>,
}

/// Internal struct for eNPS query result
#[derive(Debug, FromRow)]
struct EnpsRow {
    score: i32,
    survey_name: Option<String>,
    survey_date: String,
    feedback_text: Option<String>,
}

/// Find employees matching the extracted mentions
/// Routes to specialized retrieval functions based on query type (primary intent)
pub async fn find_relevant_employees(
    pool: &DbPool,
    mentions: &QueryMentions,
    limit: usize,
) -> Result<Vec<EmployeeContext>, ContextError> {
    // Priority 1: Underperformer queries (most specific)
    if mentions.is_underperformer_query {
        return find_underperformers(pool, limit).await;
    }

    // Priority 2: Top performer queries
    if mentions.is_top_performer_query {
        return find_top_performers(pool, limit).await;
    }

    // Priority 3: Tenure queries with direction
    if mentions.is_tenure_query {
        return match mentions.tenure_direction {
            Some(TenureDirection::Longest) => find_longest_tenure(pool, limit).await,
            Some(TenureDirection::Newest) => find_newest_employees(pool, limit).await,
            Some(TenureDirection::Anniversary) => find_upcoming_anniversaries(pool, limit).await,
            None => find_longest_tenure(pool, limit).await, // Default to longest if direction unclear
        };
    }

    // Priority 4: Name-based search (explicit employee mentions)
    let mut employee_ids: Vec<String> = Vec::new();

    for name in &mentions.names {
        let pattern = format!("%{}%", name);
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT id FROM employees WHERE full_name LIKE ? LIMIT 5"
        )
        .bind(&pattern)
        .fetch_all(pool)
        .await?;

        for (id,) in rows {
            if !employee_ids.contains(&id) {
                employee_ids.push(id);
            }
        }
    }

    // Priority 5: Department-based search
    for dept in &mentions.departments {
        let pattern = format!("%{}%", dept);
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT id FROM employees WHERE department LIKE ? AND status = 'active' LIMIT 10"
        )
        .bind(&pattern)
        .fetch_all(pool)
        .await?;

        for (id,) in rows {
            if !employee_ids.contains(&id) {
                employee_ids.push(id);
            }
        }
    }

    // Priority 6: Aggregate query fallback (random sample)
    if employee_ids.is_empty() && mentions.is_aggregate_query {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT id FROM employees WHERE status = 'active' ORDER BY RANDOM() LIMIT ?"
        )
        .bind(limit as i64)
        .fetch_all(pool)
        .await?;

        for (id,) in rows {
            employee_ids.push(id);
        }
    }

    // Limit results
    employee_ids.truncate(limit);

    // Fetch full employee context for each ID
    let mut employees = Vec::new();
    for id in employee_ids {
        if let Ok(emp) = get_employee_context(pool, &id).await {
            employees.push(emp);
        }
    }

    Ok(employees)
}

/// Get full context for a single employee including performance and eNPS
pub async fn get_employee_context(
    pool: &DbPool,
    employee_id: &str,
) -> Result<EmployeeContext, ContextError> {
    // Get employee basic info
    let emp: EmployeeRow = sqlx::query_as(
        "SELECT id, email, full_name, department, job_title, hire_date, work_state, status, manager_id FROM employees WHERE id = ?"
    )
    .bind(employee_id)
    .fetch_one(pool)
    .await?;

    // Get manager name if exists
    let manager_name: Option<String> = if let Some(ref manager_id) = emp.manager_id {
        sqlx::query("SELECT full_name FROM employees WHERE id = ?")
            .bind(manager_id)
            .fetch_optional(pool)
            .await?
            .map(|row| row.get("full_name"))
    } else {
        None
    };

    // Get performance ratings with cycle names
    let ratings: Vec<RatingRow> = sqlx::query_as(
        r#"
        SELECT pr.overall_rating, rc.name as cycle_name, pr.rating_date
        FROM performance_ratings pr
        JOIN review_cycles rc ON pr.review_cycle_id = rc.id
        WHERE pr.employee_id = ?
        ORDER BY rc.start_date DESC
        "#
    )
    .bind(employee_id)
    .fetch_all(pool)
    .await?;

    // Get eNPS responses
    let enps_responses: Vec<EnpsRow> = sqlx::query_as(
        "SELECT score, survey_name, survey_date, feedback_text FROM enps_responses WHERE employee_id = ? ORDER BY survey_date DESC"
    )
    .bind(employee_id)
    .fetch_all(pool)
    .await?;

    // Calculate rating trend
    let rating_trend = calculate_trend(&ratings.iter().map(|r| r.overall_rating).collect::<Vec<_>>());

    // Calculate eNPS trend
    let enps_trend = calculate_trend(
        &enps_responses.iter().map(|e| e.score as f64).collect::<Vec<_>>()
    );

    // Build rating info list
    let all_ratings: Vec<RatingInfo> = ratings
        .iter()
        .map(|r| RatingInfo {
            cycle_name: r.cycle_name.clone(),
            overall_rating: r.overall_rating,
            rating_date: r.rating_date.clone(),
        })
        .collect();

    // Build eNPS info list
    let all_enps: Vec<EnpsInfo> = enps_responses
        .iter()
        .map(|e| EnpsInfo {
            score: e.score,
            survey_name: e.survey_name.clone(),
            survey_date: e.survey_date.clone(),
            feedback: e.feedback_text.clone(),
        })
        .collect();

    Ok(EmployeeContext {
        id: emp.id,
        full_name: emp.full_name,
        email: emp.email,
        department: emp.department,
        job_title: emp.job_title,
        hire_date: emp.hire_date,
        work_state: emp.work_state,
        status: emp.status,
        manager_name,
        latest_rating: ratings.first().map(|r| r.overall_rating),
        latest_rating_cycle: ratings.first().map(|r| r.cycle_name.clone()),
        rating_trend,
        all_ratings,
        latest_enps: enps_responses.first().map(|e| e.score),
        latest_enps_date: enps_responses.first().map(|e| e.survey_date.clone()),
        enps_trend,
        all_enps,
    })
}

/// Calculate trend from a series of values (most recent first)
fn calculate_trend(values: &[f64]) -> Option<String> {
    if values.len() < 2 {
        return None;
    }

    let recent = values[0];
    let older = values[values.len() - 1];
    let diff = recent - older;

    // Use a small threshold to avoid noise
    if diff > 0.3 {
        Some("improving".to_string())
    } else if diff < -0.3 {
        Some("declining".to_string())
    } else {
        Some("stable".to_string())
    }
}

/// Get company context
pub async fn get_company_context(pool: &DbPool) -> Result<Option<CompanyContext>, ContextError> {
    let company: Option<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT name, state, industry FROM company WHERE id = 'default'"
    )
    .fetch_optional(pool)
    .await?;

    let Some((name, state, industry)) = company else {
        return Ok(None);
    };

    // Get employee and department counts
    let employee_count: i64 = sqlx::query("SELECT COUNT(*) as count FROM employees WHERE status = 'active'")
        .fetch_one(pool)
        .await?
        .get("count");

    let department_count: i64 = sqlx::query(
        "SELECT COUNT(DISTINCT department) as count FROM employees WHERE department IS NOT NULL AND status = 'active'"
    )
    .fetch_one(pool)
    .await?
    .get("count");

    Ok(Some(CompanyContext {
        name,
        state,
        industry,
        employee_count,
        department_count,
    }))
}

// ============================================================================
// Specialized Retrieval Functions
// ============================================================================

/// Aggregate eNPS calculation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnpsAggregate {
    /// eNPS score (-100 to +100)
    pub score: i32,
    /// Number of promoters (score >= 9)
    pub promoters: i64,
    /// Number of passives (score 7-8)
    pub passives: i64,
    /// Number of detractors (score <= 6)
    pub detractors: i64,
    /// Total survey responses
    pub total_responses: i64,
    /// Response rate vs active employees
    pub response_rate: f64,
}

/// Find employees with longest tenure (sorted by hire_date ASC)
pub async fn find_longest_tenure(
    pool: &DbPool,
    limit: usize,
) -> Result<Vec<EmployeeContext>, ContextError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM employees WHERE status = 'active' AND hire_date IS NOT NULL ORDER BY hire_date ASC LIMIT ?"
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;

    let mut employees = Vec::new();
    for (id,) in rows {
        if let Ok(emp) = get_employee_context(pool, &id).await {
            employees.push(emp);
        }
    }
    Ok(employees)
}

/// Find newest employees (sorted by hire_date DESC)
pub async fn find_newest_employees(
    pool: &DbPool,
    limit: usize,
) -> Result<Vec<EmployeeContext>, ContextError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM employees WHERE status = 'active' AND hire_date IS NOT NULL ORDER BY hire_date DESC LIMIT ?"
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;

    let mut employees = Vec::new();
    for (id,) in rows {
        if let Ok(emp) = get_employee_context(pool, &id).await {
            employees.push(emp);
        }
    }
    Ok(employees)
}

/// Find underperforming employees (rating < 2.5 in recent cycles)
pub async fn find_underperformers(
    pool: &DbPool,
    limit: usize,
) -> Result<Vec<EmployeeContext>, ContextError> {
    // Find employees with at least one rating below 2.5, prioritizing those with multiple low ratings
    let rows: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT e.id
        FROM employees e
        JOIN performance_ratings pr ON e.id = pr.employee_id
        WHERE e.status = 'active' AND pr.overall_rating < 2.5
        GROUP BY e.id
        ORDER BY COUNT(*) DESC, MIN(pr.overall_rating) ASC
        LIMIT ?
        "#
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;

    let mut employees = Vec::new();
    for (id,) in rows {
        if let Ok(emp) = get_employee_context(pool, &id).await {
            employees.push(emp);
        }
    }
    Ok(employees)
}

/// Find top performers (rating >= 4.5 in recent cycles)
pub async fn find_top_performers(
    pool: &DbPool,
    limit: usize,
) -> Result<Vec<EmployeeContext>, ContextError> {
    // Find employees with high ratings, prioritizing consistent excellence
    let rows: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT e.id
        FROM employees e
        JOIN performance_ratings pr ON e.id = pr.employee_id
        WHERE e.status = 'active' AND pr.overall_rating >= 4.5
        GROUP BY e.id
        ORDER BY COUNT(*) DESC, MAX(pr.overall_rating) DESC
        LIMIT ?
        "#
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;

    let mut employees = Vec::new();
    for (id,) in rows {
        if let Ok(emp) = get_employee_context(pool, &id).await {
            employees.push(emp);
        }
    }
    Ok(employees)
}

/// Find employees with upcoming work anniversaries (within next 30 days)
pub async fn find_upcoming_anniversaries(
    pool: &DbPool,
    limit: usize,
) -> Result<Vec<EmployeeContext>, ContextError> {
    // Find employees whose hire_date anniversary falls within next 30 days
    // Uses SQLite date functions to compare month/day
    let rows: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT id FROM employees
        WHERE status = 'active'
        AND hire_date IS NOT NULL
        AND (
            (strftime('%m-%d', hire_date) >= strftime('%m-%d', 'now')
             AND strftime('%m-%d', hire_date) <= strftime('%m-%d', 'now', '+30 days'))
            OR
            (strftime('%m-%d', 'now', '+30 days') < strftime('%m-%d', 'now')
             AND (strftime('%m-%d', hire_date) >= strftime('%m-%d', 'now')
                  OR strftime('%m-%d', hire_date) <= strftime('%m-%d', 'now', '+30 days')))
        )
        ORDER BY strftime('%m-%d', hire_date)
        LIMIT ?
        "#
    )
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;

    let mut employees = Vec::new();
    for (id,) in rows {
        if let Ok(emp) = get_employee_context(pool, &id).await {
            employees.push(emp);
        }
    }
    Ok(employees)
}

/// Calculate aggregate eNPS score for the organization
pub async fn calculate_aggregate_enps(pool: &DbPool) -> Result<EnpsAggregate, ContextError> {
    // Get the most recent survey response per employee to avoid double-counting
    let stats: (i64, i64, i64, i64) = sqlx::query_as(
        r#"
        WITH latest_responses AS (
            SELECT employee_id, score, survey_date,
                   ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY survey_date DESC) as rn
            FROM enps_responses
        )
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN score >= 9 THEN 1 ELSE 0 END) as promoters,
            SUM(CASE WHEN score >= 7 AND score <= 8 THEN 1 ELSE 0 END) as passives,
            SUM(CASE WHEN score <= 6 THEN 1 ELSE 0 END) as detractors
        FROM latest_responses
        WHERE rn = 1
        "#
    )
    .fetch_one(pool)
    .await?;

    let (total, promoters, passives, detractors) = stats;

    // Get active employee count for response rate
    let active_count: i64 = sqlx::query("SELECT COUNT(*) as count FROM employees WHERE status = 'active'")
        .fetch_one(pool)
        .await?
        .get("count");

    let score = if total > 0 {
        ((promoters - detractors) * 100 / total) as i32
    } else {
        0
    };

    let response_rate = if active_count > 0 {
        (total as f64 / active_count as f64) * 100.0
    } else {
        0.0
    };

    Ok(EnpsAggregate {
        score,
        promoters,
        passives,
        detractors,
        total_responses: total,
        response_rate,
    })
}

/// Format aggregate eNPS for inclusion in context
pub fn format_aggregate_enps(enps: &EnpsAggregate) -> String {
    format!(
        "Company eNPS: {} (Promoters: {}, Passives: {}, Detractors: {}) — {} responses ({:.0}% response rate)",
        enps.score, enps.promoters, enps.passives, enps.detractors,
        enps.total_responses, enps.response_rate
    )
}

// ============================================================================
// Context Formatting
// ============================================================================

/// Format employee context for inclusion in system prompt
pub fn format_employee_context(employees: &[EmployeeContext]) -> String {
    if employees.is_empty() {
        return "No specific employees mentioned or relevant to this query.".to_string();
    }

    let mut output = String::new();
    let mut total_chars = 0;

    for emp in employees {
        let emp_text = format_single_employee(emp);

        // Check if adding this employee would exceed the limit
        if total_chars + emp_text.len() > MAX_EMPLOYEE_CONTEXT_CHARS {
            output.push_str("\n[Additional employees omitted due to context limit]");
            break;
        }

        output.push_str(&emp_text);
        output.push_str("\n---\n");
        total_chars += emp_text.len() + 5;
    }

    output
}

/// Format a single employee's context
fn format_single_employee(emp: &EmployeeContext) -> String {
    let mut lines = Vec::new();

    // Basic info
    lines.push(format!("**{}** ({})", emp.full_name, emp.status));

    if let Some(ref title) = emp.job_title {
        if let Some(ref dept) = emp.department {
            lines.push(format!("  {} — {}", title, dept));
        } else {
            lines.push(format!("  {}", title));
        }
    }

    if let Some(ref manager) = emp.manager_name {
        lines.push(format!("  Reports to: {}", manager));
    }

    if let Some(ref state) = emp.work_state {
        lines.push(format!("  Work location: {}", state));
    }

    if let Some(ref hire_date) = emp.hire_date {
        lines.push(format!("  Hire date: {}", hire_date));
    }

    // Performance info
    if !emp.all_ratings.is_empty() {
        lines.push("  Performance:".to_string());
        for rating in emp.all_ratings.iter().take(3) {
            let label = rating_label(rating.overall_rating);
            lines.push(format!("    - {} {}: {:.1} ({})",
                rating.cycle_name,
                rating.rating_date.as_deref().unwrap_or(""),
                rating.overall_rating,
                label
            ));
        }
        if let Some(ref trend) = emp.rating_trend {
            lines.push(format!("    Trend: {}", trend));
        }
    }

    // eNPS info
    if !emp.all_enps.is_empty() {
        lines.push("  eNPS:".to_string());
        for enps in emp.all_enps.iter().take(3) {
            let category = enps_category(enps.score);
            let survey = enps.survey_name.as_deref().unwrap_or("Survey");
            lines.push(format!("    - {} ({}): {} ({})",
                survey,
                enps.survey_date,
                enps.score,
                category
            ));
            if let Some(ref feedback) = enps.feedback {
                // Truncate long feedback
                let truncated = if feedback.len() > 100 {
                    format!("{}...", &feedback[..100])
                } else {
                    feedback.clone()
                };
                lines.push(format!("      \"{}\"\n", truncated));
            }
        }
        if let Some(ref trend) = emp.enps_trend {
            lines.push(format!("    Trend: {}", trend));
        }
    }

    lines.join("\n")
}

/// Get human-readable rating label
fn rating_label(rating: f64) -> &'static str {
    if rating >= 4.5 {
        "Exceptional"
    } else if rating >= 3.5 {
        "Exceeds Expectations"
    } else if rating >= 2.5 {
        "Meets Expectations"
    } else if rating >= 1.5 {
        "Developing"
    } else {
        "Unsatisfactory"
    }
}

/// Get eNPS category
fn enps_category(score: i32) -> &'static str {
    if score >= 9 {
        "Promoter"
    } else if score >= 7 {
        "Passive"
    } else {
        "Detractor"
    }
}

// ============================================================================
// System Prompt Building
// ============================================================================

/// Build the complete system prompt for Claude
pub fn build_system_prompt(
    company: Option<&CompanyContext>,
    employee_context: &str,
    memory_summaries: &[String],
) -> String {
    let company_name = company.map(|c| c.name.as_str()).unwrap_or("your company");
    let company_state = company.map(|c| c.state.as_str()).unwrap_or("your state");

    let company_info = if let Some(c) = company {
        format!(
            "{} is based in {} with {} active employees across {} departments.",
            c.name, c.state, c.employee_count, c.department_count
        )
    } else {
        "Company profile not yet configured.".to_string()
    };

    let memories = if memory_summaries.is_empty() {
        "No relevant past conversations.".to_string()
    } else {
        memory_summaries.join("\n\n")
    };

    format!(
r#"You are Alex, an experienced VP of People Operations helping the HR team at {company_name}, a company based in {company_state}.

Your role is to be a trusted HR thought partner—someone who's seen these situations before and can offer practical, actionable guidance.

COMMUNICATION STYLE:
- Be warm but professional, like a trusted colleague
- Lead with practical answers, then explain the reasoning
- Acknowledge when situations are genuinely difficult
- Offer specific language or scripts when helpful
- Flag when legal review is needed, but don't over-hedge on routine matters

COMPANY CONTEXT:
{company_info}

CONTEXT AWARENESS:
- {company_name} is in {company_state}, so consider state-specific employment law
- When federal and state law differ, flag it clearly
- Reference specific employees by name when their data is relevant
- Build on previous conversations when you remember relevant context

BOUNDARIES:
- This is guidance, not legal advice—the user acknowledged this during setup
- For anything involving potential litigation, recommend legal counsel
- You don't have access to confidential investigation details
- Compensation data is not available (V1)

EMPLOYEE DATA AVAILABLE:
{employee_context}

RELEVANT PAST CONVERSATIONS:
{memories}

Answer questions as Alex would—practical, human, and grounded in real HR experience."#,
        company_name = company_name,
        company_state = company_state,
        company_info = company_info,
        employee_context = employee_context,
        memories = memories,
    )
}

// ============================================================================
// Main Context Building Function
// ============================================================================

/// Build complete context for a chat message
pub async fn build_chat_context(
    pool: &DbPool,
    user_message: &str,
) -> Result<ChatContext, ContextError> {
    // Extract mentions from user message
    let mentions = extract_mentions(user_message);

    // Get company context
    let company = get_company_context(pool).await?;

    // Find relevant employees
    let employees = find_relevant_employees(pool, &mentions, MAX_EMPLOYEES_IN_CONTEXT).await?;
    let employee_ids_used: Vec<String> = employees.iter().map(|e| e.id.clone()).collect();

    Ok(ChatContext {
        company,
        employees,
        employee_ids_used,
        memory_summaries: Vec::new(), // Placeholder for Phase 2.4
    })
}

/// Get the system prompt for a chat message
pub async fn get_system_prompt_for_message(
    pool: &DbPool,
    user_message: &str,
) -> Result<(String, Vec<String>), ContextError> {
    let context = build_chat_context(pool, user_message).await?;

    let employee_context = format_employee_context(&context.employees);
    let system_prompt = build_system_prompt(
        context.company.as_ref(),
        &employee_context,
        &context.memory_summaries,
    );

    Ok((system_prompt, context.employee_ids_used))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_mentions_names() {
        let query = "What's Sarah Chen's performance history?";
        let mentions = extract_mentions(query);
        assert!(mentions.names.iter().any(|n| n.contains("Sarah")));
    }

    #[test]
    fn test_extract_mentions_department() {
        let query = "How is the Engineering team doing?";
        let mentions = extract_mentions(query);
        assert!(mentions.departments.contains(&"Engineering".to_string()));
        assert!(mentions.is_aggregate_query);
    }

    #[test]
    fn test_extract_mentions_performance() {
        let query = "Who are our top performers?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_performance_query);
    }

    #[test]
    fn test_extract_mentions_enps() {
        let query = "What's our current eNPS score?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_enps_query);
    }

    #[test]
    fn test_rating_label() {
        assert_eq!(rating_label(4.8), "Exceptional");
        assert_eq!(rating_label(3.7), "Exceeds Expectations");
        assert_eq!(rating_label(3.0), "Meets Expectations");
        assert_eq!(rating_label(2.2), "Developing");
        assert_eq!(rating_label(1.2), "Unsatisfactory");
    }

    #[test]
    fn test_enps_category() {
        assert_eq!(enps_category(10), "Promoter");
        assert_eq!(enps_category(9), "Promoter");
        assert_eq!(enps_category(8), "Passive");
        assert_eq!(enps_category(7), "Passive");
        assert_eq!(enps_category(6), "Detractor");
        assert_eq!(enps_category(0), "Detractor");
    }

    #[test]
    fn test_calculate_trend() {
        // Improving (most recent is higher)
        assert_eq!(calculate_trend(&[4.0, 3.5, 3.0]), Some("improving".to_string()));
        // Declining (most recent is lower)
        assert_eq!(calculate_trend(&[3.0, 3.5, 4.0]), Some("declining".to_string()));
        // Stable
        assert_eq!(calculate_trend(&[3.5, 3.4, 3.5]), Some("stable".to_string()));
        // Not enough data
        assert_eq!(calculate_trend(&[3.5]), None);
    }

    // =========================================================================
    // New tests for Phase 2.3.2 — Enhanced query extraction
    // =========================================================================

    #[test]
    fn test_extract_tenure_longest() {
        let query = "Who's been here the longest?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_tenure_query);
        assert_eq!(mentions.tenure_direction, Some(TenureDirection::Longest));
    }

    #[test]
    fn test_extract_tenure_newest() {
        let query = "Who are our newest hires?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_tenure_query);
        assert_eq!(mentions.tenure_direction, Some(TenureDirection::Newest));
    }

    #[test]
    fn test_extract_tenure_anniversary() {
        let query = "Who has a work anniversary coming up?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_tenure_query);
        assert_eq!(mentions.tenure_direction, Some(TenureDirection::Anniversary));
    }

    #[test]
    fn test_extract_underperformer() {
        let query = "Who's underperforming on the team?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_underperformer_query);
    }

    #[test]
    fn test_extract_underperformer_struggling() {
        let query = "Which employees are struggling?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_underperformer_query);
    }

    #[test]
    fn test_extract_top_performer() {
        let query = "Who are our top performers?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_top_performer_query);
    }

    #[test]
    fn test_extract_top_performer_star() {
        let query = "Who are the star employees in Engineering?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_top_performer_query);
        assert!(mentions.departments.contains(&"Engineering".to_string()));
    }

    #[test]
    fn test_extract_aggregate_enps() {
        let query = "What's our company eNPS?";
        let mentions = extract_mentions(query);
        assert!(mentions.is_enps_query);
        assert!(mentions.wants_aggregate);
    }

    #[test]
    fn test_extract_possessive_name() {
        let query = "What's Sarah's performance history?";
        let mentions = extract_mentions(query);
        assert!(mentions.names.iter().any(|n| n == "Sarah"));
    }

    #[test]
    fn test_extract_possessive_full_name() {
        let query = "Tell me about Marcus Johnson's reviews";
        let mentions = extract_mentions(query);
        // Should find "Marcus" after stripping possessive from "Johnson's"
        assert!(mentions.names.iter().any(|n| n.contains("Marcus")));
    }

    #[test]
    fn test_extract_how_many() {
        let query = "How many employees do we have?";
        let mentions = extract_mentions(query);
        assert!(mentions.wants_aggregate);
    }
}
