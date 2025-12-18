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
use crate::memory;

// ============================================================================
// Token Budget Constants
// ============================================================================
// Claude Sonnet 4 has 200K context window. We allocate conservatively:
// - System prompt (persona + company + employees): 20K tokens
// - Conversation history: 150K tokens
// - Output reserved: 4K tokens
// - Safety buffer: 26K tokens

/// Approximate characters per token (conservative estimate for English text)
const CHARS_PER_TOKEN: usize = 4;

/// Maximum tokens for the entire system prompt (persona + company + employees + memory)
const MAX_SYSTEM_PROMPT_TOKENS: usize = 20_000;

/// Maximum tokens for conversation history
const MAX_CONVERSATION_TOKENS: usize = 150_000;

/// Tokens reserved for Claude's response output
#[allow(dead_code)]
const OUTPUT_TOKENS_RESERVED: usize = 4_096;

/// Maximum tokens for employee context section (part of system prompt budget)
const MAX_EMPLOYEE_CONTEXT_TOKENS: usize = 4_000;

/// Maximum characters for employee context (derived from token budget)
const MAX_EMPLOYEE_CONTEXT_CHARS: usize = MAX_EMPLOYEE_CONTEXT_TOKENS * CHARS_PER_TOKEN;

/// Maximum number of employees to include in context
const MAX_EMPLOYEES_IN_CONTEXT: usize = 10;

// ============================================================================
// Query Classification Types (Phase 2.7)
// ============================================================================

/// Query classification result for adaptive context retrieval
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

// ============================================================================
// Organization Aggregate Types (Phase 2.7)
// ============================================================================

/// Organization-wide aggregate statistics
/// Computed from full database for every query (~2K chars when formatted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgAggregates {
    // Headcount
    pub total_employees: i64,
    pub active_count: i64,
    pub terminated_count: i64,
    pub on_leave_count: i64,

    // By department (sorted by count descending)
    pub by_department: Vec<DepartmentCount>,

    // Performance (active employees only, most recent rating per employee)
    pub avg_rating: Option<f64>,
    pub rating_distribution: RatingDistribution,
    pub employees_with_no_rating: i64,

    // Engagement (reuses existing EnpsAggregate)
    pub enps: EnpsAggregate,

    // Attrition (YTD)
    pub attrition: AttritionStats,
}

/// Department headcount with percentage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepartmentCount {
    pub name: String,
    pub count: i64,
    pub percentage: f64,
}

/// Performance rating distribution buckets
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RatingDistribution {
    /// Rating >= 4.5
    pub exceptional: i64,
    /// Rating 3.5 - 4.49
    pub exceeds: i64,
    /// Rating 2.5 - 3.49
    pub meets: i64,
    /// Rating < 2.5
    pub needs_improvement: i64,
}

/// Year-to-date attrition statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AttritionStats {
    pub terminations_ytd: i64,
    pub voluntary: i64,
    pub involuntary: i64,
    pub avg_tenure_months: Option<f64>,
    pub turnover_rate_annualized: Option<f64>,
}

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
            // Common question/sentence starters
            "I", "The", "What", "Who", "How", "When", "Where", "Why",
            "Can", "Could", "Would", "Should", "Is", "Are", "Was", "Were",
            "Tell", "Show", "List", "Give", "Help", "Please", "Hello",
            // HR acronyms and terms
            "HR", "HR's", "PIP", "Q1", "Q2", "Q3", "Q4", "FY", "YTD",
            // Days and months
            "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
            // Department names (should not be treated as person names)
            "Engineering", "Marketing", "Sales", "Finance", "Operations",
            "Product", "Design", "Legal", "IT", "Research", "Development",
            "Executive", "Support", "Success",
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
// Query Classification (Phase 2.7)
// ============================================================================

/// Classify a query to determine the appropriate context retrieval strategy.
/// Uses priority-based logic to handle ambiguous queries.
///
/// Priority order:
/// 1. Individual - explicit names always win
/// 2. Comparison - ranking/filtering queries
/// 3. Attrition - turnover-specific queries
/// 4. List - roster requests
/// 5. Aggregate - stats/counts/status checks
/// 6. General - fallback
pub fn classify_query(message: &str, mentions: &QueryMentions) -> QueryType {
    let lower = message.to_lowercase();

    // Priority 1: Individual (explicit names always win, unless aggregate query)
    if !mentions.names.is_empty() && !mentions.wants_aggregate {
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
    if mentions.wants_aggregate || is_aggregate_query(&lower) || is_status_check(&lower) {
        return QueryType::Aggregate;
    }

    // Fallback
    QueryType::General
}

/// Check if query is attrition/turnover focused
fn is_attrition_query(lower: &str) -> bool {
    let attrition_keywords = [
        "attrition",
        "turnover",
        "who left",
        "who's left",
        "departed",
        "terminated",
        "resignation",
        "quit",
        "recent departures",
        "offboarding",
        "left the company",
        "left this year",
        "voluntary departure",
        "involuntary termination",
    ];

    attrition_keywords.iter().any(|kw| lower.contains(kw))
}

/// Check if query is a list/roster request
fn is_list_query(lower: &str, mentions: &QueryMentions) -> bool {
    let list_keywords = [
        "who's in",
        "who is in",
        "show me",
        "list all",
        "list the",
        "all employees",
        "everyone in",
        "people in",
        "members of",
        "the team in",
        "employees in",
    ];

    // Direct list keyword match
    if list_keywords.iter().any(|kw| lower.contains(kw)) {
        return true;
    }

    // Department mentioned without aggregate keywords = likely wants roster
    if !mentions.departments.is_empty()
        && !mentions.wants_aggregate
        && !mentions.is_top_performer_query
        && !mentions.is_underperformer_query
    {
        // Check for roster-style phrasing
        let roster_patterns = ["who", "show", "list", "tell me about the"];
        if roster_patterns.iter().any(|p| lower.contains(p)) {
            return true;
        }
    }

    false
}

/// Check if query wants aggregate stats (broader than wants_aggregate flag)
fn is_aggregate_query(lower: &str) -> bool {
    let aggregate_keywords = [
        "how many",
        "what's our",
        "what is our",
        "total number",
        "count of",
        "average",
        "overall",
        "company-wide",
        "org-wide",
        "percentage",
        "rate",
        "headcount",
        "breakdown",
        "distribution",
        "summary",
        "statistics",
        "metrics",
    ];

    aggregate_keywords.iter().any(|kw| lower.contains(kw))
}

/// Check if query is a status check (e.g., "How's X doing?")
/// These are aggregate-style questions even without explicit aggregate keywords
fn is_status_check(lower: &str) -> bool {
    let status_patterns = [
        "how's the",
        "how is the",
        "how are the",
        "how's our",
        "how is our",
        "doing overall",
        "team doing",
        "department doing",
    ];

    status_patterns.iter().any(|p| lower.contains(p))
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
/// If selected_employee_id is provided, that employee is always included first
pub async fn find_relevant_employees(
    pool: &DbPool,
    mentions: &QueryMentions,
    limit: usize,
    selected_employee_id: Option<&str>,
) -> Result<Vec<EmployeeContext>, ContextError> {
    // If a specific employee is selected, always include them first
    let (selected_employee, remaining_limit) = if let Some(id) = selected_employee_id {
        match get_employee_context(pool, id).await {
            Ok(emp) => (Some(emp), limit.saturating_sub(1)),
            Err(_) => (None, limit), // ID not found, continue without
        }
    } else {
        (None, limit)
    };
    // Helper to prepend selected employee and filter duplicates
    let finalize_results = |mut employees: Vec<EmployeeContext>| {
        if let Some(ref selected) = selected_employee {
            // Remove selected employee if already in list (avoid duplicates)
            employees.retain(|e| e.id != selected.id);
            // Prepend selected employee
            let mut result = vec![selected.clone()];
            result.extend(employees);
            result
        } else {
            employees
        }
    };

    // Priority 1: Underperformer queries (most specific)
    if mentions.is_underperformer_query {
        let employees = find_underperformers(pool, remaining_limit).await?;
        return Ok(finalize_results(employees));
    }

    // Priority 2: Top performer queries
    if mentions.is_top_performer_query {
        let employees = find_top_performers(pool, remaining_limit).await?;
        return Ok(finalize_results(employees));
    }

    // Priority 3: Tenure queries with direction
    if mentions.is_tenure_query {
        let employees = match mentions.tenure_direction {
            Some(TenureDirection::Longest) => find_longest_tenure(pool, remaining_limit).await?,
            Some(TenureDirection::Newest) => find_newest_employees(pool, remaining_limit).await?,
            Some(TenureDirection::Anniversary) => find_upcoming_anniversaries(pool, remaining_limit).await?,
            None => find_longest_tenure(pool, remaining_limit).await?, // Default to longest if direction unclear
        };
        return Ok(finalize_results(employees));
    }

    // Priority 4: Name-based search (explicit employee mentions)
    let mut employee_ids: Vec<String> = Vec::new();

    // Exclude selected employee from search (will be prepended later)
    let selected_id = selected_employee.as_ref().map(|e| e.id.as_str());

    for name in &mentions.names {
        let pattern = format!("%{}%", name);
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT id FROM employees WHERE full_name LIKE ? LIMIT 5"
        )
        .bind(&pattern)
        .fetch_all(pool)
        .await?;

        for (id,) in rows {
            if !employee_ids.contains(&id) && Some(id.as_str()) != selected_id {
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
            if !employee_ids.contains(&id) && Some(id.as_str()) != selected_id {
                employee_ids.push(id);
            }
        }
    }

    // Priority 6: Aggregate query fallback (random sample)
    if employee_ids.is_empty() && mentions.is_aggregate_query {
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT id FROM employees WHERE status = 'active' ORDER BY RANDOM() LIMIT ?"
        )
        .bind(remaining_limit as i64)
        .fetch_all(pool)
        .await?;

        for (id,) in rows {
            if Some(id.as_str()) != selected_id {
                employee_ids.push(id);
            }
        }
    }

    // Limit results
    employee_ids.truncate(remaining_limit);

    // Fetch full employee context for each ID
    let mut employees = Vec::new();
    for id in employee_ids {
        if let Ok(emp) = get_employee_context(pool, &id).await {
            employees.push(emp);
        }
    }

    Ok(finalize_results(employees))
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
// Organization Aggregates (Phase 2.7)
// ============================================================================

/// Build organization-wide aggregates from the full database
/// These are computed for every query to give Claude accurate org-level context
pub async fn build_org_aggregates(pool: &DbPool) -> Result<OrgAggregates, ContextError> {
    // 1. Headcount by status
    let headcount = fetch_headcount_by_status(pool).await?;

    // 2. Headcount by department
    let by_department = fetch_headcount_by_department(pool, headcount.active_count).await?;

    // 3. Performance distribution (most recent rating per active employee)
    let (avg_rating, rating_distribution, employees_with_no_rating) =
        fetch_performance_distribution(pool, headcount.active_count).await?;

    // 4. eNPS (reuse existing function)
    let enps = calculate_aggregate_enps(pool).await?;

    // 5. Attrition YTD
    let attrition = fetch_attrition_stats(pool, headcount.active_count).await?;

    Ok(OrgAggregates {
        total_employees: headcount.total,
        active_count: headcount.active_count,
        terminated_count: headcount.terminated_count,
        on_leave_count: headcount.on_leave_count,
        by_department,
        avg_rating,
        rating_distribution,
        employees_with_no_rating,
        enps,
        attrition,
    })
}

/// Internal struct for headcount query result
struct HeadcountResult {
    total: i64,
    active_count: i64,
    terminated_count: i64,
    on_leave_count: i64,
}

/// Fetch headcount by status
async fn fetch_headcount_by_status(pool: &DbPool) -> Result<HeadcountResult, ContextError> {
    let row = sqlx::query(
        r#"
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) as terminated,
            SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as on_leave
        FROM employees
        "#,
    )
    .fetch_one(pool)
    .await?;

    Ok(HeadcountResult {
        total: row.get::<i64, _>("total"),
        active_count: row.get::<i64, _>("active"),
        terminated_count: row.get::<i64, _>("terminated"),
        on_leave_count: row.get::<i64, _>("on_leave"),
    })
}

/// Fetch headcount by department (active employees only)
async fn fetch_headcount_by_department(
    pool: &DbPool,
    total_active: i64,
) -> Result<Vec<DepartmentCount>, ContextError> {
    let rows = sqlx::query(
        r#"
        SELECT
            COALESCE(department, 'Unassigned') as department,
            COUNT(*) as count
        FROM employees
        WHERE status = 'active'
        GROUP BY department
        ORDER BY count DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let departments: Vec<DepartmentCount> = rows
        .iter()
        .map(|row| {
            let name: String = row.get("department");
            let count: i64 = row.get("count");
            let percentage = if total_active > 0 {
                (count as f64 / total_active as f64) * 100.0
            } else {
                0.0
            };
            DepartmentCount {
                name,
                count,
                percentage,
            }
        })
        .collect();

    Ok(departments)
}

/// Fetch performance rating distribution (most recent rating per active employee)
async fn fetch_performance_distribution(
    pool: &DbPool,
    total_active: i64,
) -> Result<(Option<f64>, RatingDistribution, i64), ContextError> {
    // Get most recent rating per active employee
    let row = sqlx::query(
        r#"
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
            SUM(CASE WHEN overall_rating < 2.5 THEN 1 ELSE 0 END) as needs_improvement,
            COUNT(*) as rated_count
        FROM latest_ratings
        WHERE rn = 1
        "#,
    )
    .fetch_one(pool)
    .await?;

    let avg_rating: Option<f64> = row.get("avg_rating");
    let rated_count: i64 = row.get("rated_count");
    let employees_with_no_rating = total_active - rated_count;

    let distribution = RatingDistribution {
        exceptional: row.get("exceptional"),
        exceeds: row.get("exceeds"),
        meets: row.get("meets"),
        needs_improvement: row.get("needs_improvement"),
    };

    Ok((avg_rating, distribution, employees_with_no_rating))
}

/// Fetch attrition stats for YTD
async fn fetch_attrition_stats(
    pool: &DbPool,
    current_active: i64,
) -> Result<AttritionStats, ContextError> {
    // Get YTD termination stats
    let row = sqlx::query(
        r#"
        SELECT
            COUNT(*) as terminations,
            SUM(CASE WHEN termination_reason = 'voluntary' THEN 1 ELSE 0 END) as voluntary,
            SUM(CASE WHEN termination_reason = 'involuntary' THEN 1 ELSE 0 END) as involuntary,
            AVG(
                CAST((julianday(termination_date) - julianday(hire_date)) / 30.0 AS REAL)
            ) as avg_tenure_months
        FROM employees
        WHERE status = 'terminated'
          AND termination_date >= date('now', 'start of year')
        "#,
    )
    .fetch_one(pool)
    .await?;

    let terminations_ytd: i64 = row.get("terminations");
    let voluntary: i64 = row.get("voluntary");
    let involuntary: i64 = row.get("involuntary");
    let avg_tenure_months: Option<f64> = row.get("avg_tenure_months");

    // Calculate annualized turnover rate
    // Formula: (terminations / avg headcount) * (12 / months elapsed) * 100
    let turnover_rate_annualized = calculate_turnover_rate(pool, terminations_ytd, current_active).await?;

    Ok(AttritionStats {
        terminations_ytd,
        voluntary,
        involuntary,
        avg_tenure_months,
        turnover_rate_annualized,
    })
}

/// Calculate annualized turnover rate
async fn calculate_turnover_rate(
    pool: &DbPool,
    terminations_ytd: i64,
    current_active: i64,
) -> Result<Option<f64>, ContextError> {
    if terminations_ytd == 0 {
        return Ok(Some(0.0));
    }

    // Get months elapsed this year
    let row = sqlx::query(
        r#"
        SELECT
            (julianday('now') - julianday(date('now', 'start of year'))) / 30.0 as months_elapsed
        "#,
    )
    .fetch_one(pool)
    .await?;

    let months_elapsed: f64 = row.get("months_elapsed");

    if months_elapsed <= 0.0 {
        return Ok(None);
    }

    // Approximate average headcount = current active + half of terminations
    let avg_headcount = current_active as f64 + (terminations_ytd as f64 / 2.0);

    if avg_headcount <= 0.0 {
        return Ok(None);
    }

    // Annualized rate = (terminations / avg headcount) * (12 / months elapsed) * 100
    let rate = (terminations_ytd as f64 / avg_headcount) * (12.0 / months_elapsed) * 100.0;

    Ok(Some(rate))
}

/// Format organization aggregates for inclusion in system prompt
/// Produces a compact (~1.5-2K chars) summary of org-wide stats
pub fn format_org_aggregates(agg: &OrgAggregates, company_name: Option<&str>) -> String {
    let mut lines = Vec::new();

    // Header
    lines.push("ORGANIZATION DATA:".to_string());
    lines.push(String::new());

    // Workforce summary
    if let Some(name) = company_name {
        lines.push(format!("COMPANY: {}", name));
    }
    lines.push(format!(
        "WORKFORCE: {} employees",
        agg.total_employees
    ));
    lines.push(format!(
        "• Active: {} | Terminated: {} | On Leave: {}",
        agg.active_count, agg.terminated_count, agg.on_leave_count
    ));
    lines.push(String::new());

    // Departments (compact format for space efficiency)
    if !agg.by_department.is_empty() {
        lines.push("DEPARTMENTS:".to_string());
        let dept_strs: Vec<String> = agg
            .by_department
            .iter()
            .take(8) // Limit to 8 departments to save space
            .map(|d| format!("{}: {} ({:.0}%)", d.name, d.count, d.percentage))
            .collect();
        // Group 3 departments per line for compactness
        for chunk in dept_strs.chunks(3) {
            lines.push(format!("• {}", chunk.join(" • ")));
        }
        lines.push(String::new());
    }

    // Performance
    lines.push(format!(
        "PERFORMANCE ({} active employees):",
        agg.active_count
    ));
    if let Some(avg) = agg.avg_rating {
        let label = rating_label(avg);
        lines.push(format!("• Avg rating: {:.1} ({})", avg, label));
    } else {
        lines.push("• No performance data available".to_string());
    }
    let dist = &agg.rating_distribution;
    if dist.exceptional > 0 || dist.exceeds > 0 || dist.meets > 0 || dist.needs_improvement > 0 {
        lines.push(format!(
            "• Distribution: Exceptional: {} | Exceeds: {} | Meets: {} | Needs Improvement: {}",
            dist.exceptional, dist.exceeds, dist.meets, dist.needs_improvement
        ));
    }
    if agg.employees_with_no_rating > 0 {
        lines.push(format!(
            "• Employees with no rating: {}",
            agg.employees_with_no_rating
        ));
    }
    lines.push(String::new());

    // Engagement (eNPS)
    lines.push("ENGAGEMENT:".to_string());
    let sign = if agg.enps.score >= 0 { "+" } else { "" };
    lines.push(format!(
        "• eNPS: {}{} (Promoters: {}, Passives: {}, Detractors: {})",
        sign, agg.enps.score, agg.enps.promoters, agg.enps.passives, agg.enps.detractors
    ));
    lines.push(format!(
        "• Response rate: {:.0}% ({} of {} active)",
        agg.enps.response_rate, agg.enps.total_responses, agg.active_count
    ));
    lines.push(String::new());

    // Attrition
    lines.push("ATTRITION (YTD):".to_string());
    if agg.attrition.terminations_ytd > 0 {
        lines.push(format!(
            "• Terminations: {} (Voluntary: {}, Involuntary: {})",
            agg.attrition.terminations_ytd,
            agg.attrition.voluntary,
            agg.attrition.involuntary
        ));
        if let Some(tenure) = agg.attrition.avg_tenure_months {
            let years = tenure / 12.0;
            lines.push(format!("• Avg tenure at exit: {:.1} years", years));
        }
        if let Some(rate) = agg.attrition.turnover_rate_annualized {
            lines.push(format!("• Turnover rate: {:.1}% annualized", rate));
        }
    } else {
        lines.push("• No terminations YTD".to_string());
    }

    lines.join("\n")
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
// Token Estimation Utilities
// ============================================================================

/// Estimate token count from text length (conservative: ~4 chars per token)
/// This is a rough approximation; actual tokenization varies by content.
pub fn estimate_tokens(text: &str) -> usize {
    // Round up to be conservative
    (text.len() + CHARS_PER_TOKEN - 1) / CHARS_PER_TOKEN
}

/// Convert a token budget to approximate character budget
#[allow(dead_code)]
pub fn tokens_to_chars(tokens: usize) -> usize {
    tokens * CHARS_PER_TOKEN
}

/// Get the maximum conversation token budget
pub fn get_max_conversation_tokens() -> usize {
    MAX_CONVERSATION_TOKENS
}

/// Get the maximum system prompt token budget
#[allow(dead_code)]
pub fn get_max_system_prompt_tokens() -> usize {
    MAX_SYSTEM_PROMPT_TOKENS
}

// ============================================================================
// System Prompt Building
// ============================================================================

/// Build the complete system prompt for Claude
pub fn build_system_prompt(
    company: Option<&CompanyContext>,
    employee_context: &str,
    memory_summaries: &[String],
    user_name: Option<&str>,
) -> String {
    let company_name = company.map(|c| c.name.as_str()).unwrap_or("your company");
    let company_state = company.map(|c| c.state.as_str()).unwrap_or("your state");
    let user_display = user_name.unwrap_or("the HR team");

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
r#"You are Alex, an experienced VP of People Operations helping {user_display} at {company_name}, a company based in {company_state}.

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
        user_display = user_display,
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
/// If selected_employee_id is provided, that employee is always included first
pub async fn build_chat_context(
    pool: &DbPool,
    user_message: &str,
    selected_employee_id: Option<&str>,
) -> Result<ChatContext, ContextError> {
    // Extract mentions from user message
    let mentions = extract_mentions(user_message);

    // Get company context
    let company = get_company_context(pool).await?;

    // Find relevant employees (with selected employee prioritized)
    let employees = find_relevant_employees(pool, &mentions, MAX_EMPLOYEES_IN_CONTEXT, selected_employee_id).await?;
    let employee_ids_used: Vec<String> = employees.iter().map(|e| e.id.clone()).collect();

    // Find relevant past conversation memories (resilient - don't fail if memory lookup errors)
    let memory_summaries = match memory::find_relevant_memories(
        pool,
        user_message,
        memory::DEFAULT_MEMORY_LIMIT,
    )
    .await
    {
        Ok(memories) => memories.into_iter().map(|m| m.summary).collect(),
        Err(e) => {
            // Log the error but continue without memories
            eprintln!("Warning: Failed to retrieve memories: {}", e);
            Vec::new()
        }
    };

    Ok(ChatContext {
        company,
        employees,
        employee_ids_used,
        memory_summaries,
    })
}

/// Get the system prompt for a chat message
/// If selected_employee_id is provided, that employee is always included first
pub async fn get_system_prompt_for_message(
    pool: &DbPool,
    user_message: &str,
    selected_employee_id: Option<&str>,
) -> Result<(String, Vec<String>), ContextError> {
    let context = build_chat_context(pool, user_message, selected_employee_id).await?;

    // Fetch user_name from settings (if set)
    let user_name = crate::settings::get_setting(pool, "user_name")
        .await
        .ok()
        .flatten();

    let employee_context = format_employee_context(&context.employees);
    let system_prompt = build_system_prompt(
        context.company.as_ref(),
        &employee_context,
        &context.memory_summaries,
        user_name.as_deref(),
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

    // ========================================
    // Token Estimation Tests
    // ========================================

    #[test]
    fn test_estimate_tokens_empty() {
        assert_eq!(estimate_tokens(""), 0);
    }

    #[test]
    fn test_estimate_tokens_short_text() {
        // "Hello" = 5 chars = ceil(5/4) = 2 tokens
        assert_eq!(estimate_tokens("Hello"), 2);
    }

    #[test]
    fn test_estimate_tokens_exact_multiple() {
        // 8 chars = 8/4 = 2 tokens
        assert_eq!(estimate_tokens("12345678"), 2);
    }

    #[test]
    fn test_estimate_tokens_rounds_up() {
        // 9 chars = ceil(9/4) = 3 tokens (conservative)
        assert_eq!(estimate_tokens("123456789"), 3);
    }

    #[test]
    fn test_estimate_tokens_longer_text() {
        // 100 chars = 100/4 = 25 tokens
        let text = "a".repeat(100);
        assert_eq!(estimate_tokens(&text), 25);
    }

    #[test]
    fn test_tokens_to_chars() {
        assert_eq!(tokens_to_chars(100), 400);
        assert_eq!(tokens_to_chars(0), 0);
        assert_eq!(tokens_to_chars(1), 4);
    }

    #[test]
    fn test_get_max_conversation_tokens() {
        // Should return the constant value
        assert_eq!(get_max_conversation_tokens(), 150_000);
    }

    // ========================================
    // Organization Aggregates Tests (Phase 2.7)
    // ========================================

    #[test]
    fn test_format_org_aggregates_basic() {
        let agg = OrgAggregates {
            total_employees: 100,
            active_count: 82,
            terminated_count: 12,
            on_leave_count: 6,
            by_department: vec![
                DepartmentCount { name: "Engineering".to_string(), count: 28, percentage: 34.1 },
                DepartmentCount { name: "Sales".to_string(), count: 18, percentage: 22.0 },
                DepartmentCount { name: "Marketing".to_string(), count: 12, percentage: 14.6 },
            ],
            avg_rating: Some(3.4),
            rating_distribution: RatingDistribution {
                exceptional: 8,
                exceeds: 32,
                meets: 38,
                needs_improvement: 4,
            },
            employees_with_no_rating: 12,
            enps: EnpsAggregate {
                score: 12,
                promoters: 34,
                passives: 28,
                detractors: 20,
                total_responses: 67,
                response_rate: 81.7,
            },
            attrition: AttritionStats {
                terminations_ytd: 12,
                voluntary: 8,
                involuntary: 4,
                avg_tenure_months: Some(27.6),
                turnover_rate_annualized: Some(14.6),
            },
        };

        let formatted = format_org_aggregates(&agg, Some("Acme Corp"));

        // Check key sections are present
        assert!(formatted.contains("ORGANIZATION DATA:"));
        assert!(formatted.contains("COMPANY: Acme Corp"));
        assert!(formatted.contains("WORKFORCE: 100 employees"));
        assert!(formatted.contains("Active: 82"));
        assert!(formatted.contains("Terminated: 12"));
        assert!(formatted.contains("On Leave: 6"));

        // Check departments
        assert!(formatted.contains("DEPARTMENTS:"));
        assert!(formatted.contains("Engineering: 28"));
        assert!(formatted.contains("Sales: 18"));

        // Check performance
        assert!(formatted.contains("PERFORMANCE (82 active employees):"));
        assert!(formatted.contains("Avg rating: 3.4 (Meets Expectations)"));
        assert!(formatted.contains("Exceptional: 8"));

        // Check engagement
        assert!(formatted.contains("ENGAGEMENT:"));
        assert!(formatted.contains("eNPS: +12"));
        assert!(formatted.contains("Promoters: 34"));

        // Check attrition
        assert!(formatted.contains("ATTRITION (YTD):"));
        assert!(formatted.contains("Terminations: 12"));
        assert!(formatted.contains("Voluntary: 8"));
        assert!(formatted.contains("Turnover rate: 14.6%"));
    }

    #[test]
    fn test_format_org_aggregates_empty_data() {
        let agg = OrgAggregates {
            total_employees: 0,
            active_count: 0,
            terminated_count: 0,
            on_leave_count: 0,
            by_department: vec![],
            avg_rating: None,
            rating_distribution: RatingDistribution::default(),
            employees_with_no_rating: 0,
            enps: EnpsAggregate {
                score: 0,
                promoters: 0,
                passives: 0,
                detractors: 0,
                total_responses: 0,
                response_rate: 0.0,
            },
            attrition: AttritionStats::default(),
        };

        let formatted = format_org_aggregates(&agg, None);

        // Should still produce valid output
        assert!(formatted.contains("ORGANIZATION DATA:"));
        assert!(formatted.contains("WORKFORCE: 0 employees"));
        assert!(formatted.contains("No performance data available"));
        assert!(formatted.contains("No terminations YTD"));
    }

    #[test]
    fn test_format_org_aggregates_negative_enps() {
        let agg = OrgAggregates {
            total_employees: 50,
            active_count: 45,
            terminated_count: 5,
            on_leave_count: 0,
            by_department: vec![],
            avg_rating: Some(2.8),
            rating_distribution: RatingDistribution {
                exceptional: 2,
                exceeds: 10,
                meets: 25,
                needs_improvement: 8,
            },
            employees_with_no_rating: 0,
            enps: EnpsAggregate {
                score: -15,
                promoters: 10,
                passives: 15,
                detractors: 20,
                total_responses: 45,
                response_rate: 100.0,
            },
            attrition: AttritionStats::default(),
        };

        let formatted = format_org_aggregates(&agg, Some("Test Corp"));

        // Negative eNPS should not have + sign
        assert!(formatted.contains("eNPS: -15"));
        assert!(!formatted.contains("eNPS: +-15"));
    }

    #[test]
    fn test_rating_distribution_default() {
        let dist = RatingDistribution::default();
        assert_eq!(dist.exceptional, 0);
        assert_eq!(dist.exceeds, 0);
        assert_eq!(dist.meets, 0);
        assert_eq!(dist.needs_improvement, 0);
    }

    #[test]
    fn test_attrition_stats_default() {
        let stats = AttritionStats::default();
        assert_eq!(stats.terminations_ytd, 0);
        assert_eq!(stats.voluntary, 0);
        assert_eq!(stats.involuntary, 0);
        assert!(stats.avg_tenure_months.is_none());
        assert!(stats.turnover_rate_annualized.is_none());
    }

    #[test]
    fn test_query_type_serialization() {
        // Verify QueryType can be serialized/deserialized
        let types = vec![
            QueryType::Aggregate,
            QueryType::List,
            QueryType::Individual,
            QueryType::Comparison,
            QueryType::Attrition,
            QueryType::General,
        ];

        for qt in types {
            let serialized = serde_json::to_string(&qt).unwrap();
            let deserialized: QueryType = serde_json::from_str(&serialized).unwrap();
            assert_eq!(qt, deserialized);
        }
    }

    #[test]
    fn test_format_org_aggregates_size_budget() {
        // Verify formatted output stays within reasonable size (~2K chars)
        let agg = OrgAggregates {
            total_employees: 500,
            active_count: 450,
            terminated_count: 40,
            on_leave_count: 10,
            by_department: vec![
                DepartmentCount { name: "Engineering".to_string(), count: 150, percentage: 33.3 },
                DepartmentCount { name: "Sales".to_string(), count: 100, percentage: 22.2 },
                DepartmentCount { name: "Marketing".to_string(), count: 60, percentage: 13.3 },
                DepartmentCount { name: "Operations".to_string(), count: 50, percentage: 11.1 },
                DepartmentCount { name: "Finance".to_string(), count: 40, percentage: 8.9 },
                DepartmentCount { name: "HR".to_string(), count: 30, percentage: 6.7 },
                DepartmentCount { name: "Legal".to_string(), count: 15, percentage: 3.3 },
                DepartmentCount { name: "Executive".to_string(), count: 5, percentage: 1.1 },
            ],
            avg_rating: Some(3.6),
            rating_distribution: RatingDistribution {
                exceptional: 45,
                exceeds: 180,
                meets: 200,
                needs_improvement: 25,
            },
            employees_with_no_rating: 50,
            enps: EnpsAggregate {
                score: 25,
                promoters: 180,
                passives: 150,
                detractors: 70,
                total_responses: 400,
                response_rate: 88.9,
            },
            attrition: AttritionStats {
                terminations_ytd: 40,
                voluntary: 30,
                involuntary: 10,
                avg_tenure_months: Some(36.0),
                turnover_rate_annualized: Some(8.5),
            },
        };

        let formatted = format_org_aggregates(&agg, Some("Large Enterprise Corp"));

        // Should stay under 2500 chars for reasonable context budget
        assert!(
            formatted.len() < 2500,
            "Formatted output too large: {} chars",
            formatted.len()
        );
    }

    // ========================================
    // Query Classification Tests (Phase 2.7.2)
    // ========================================

    #[test]
    fn test_classify_aggregate_queries() {
        // "How many employees?" → Aggregate
        let mentions = extract_mentions("How many employees do we have?");
        assert_eq!(classify_query("How many employees do we have?", &mentions), QueryType::Aggregate);

        // "What's our eNPS?" → Aggregate
        let mentions = extract_mentions("What's our eNPS?");
        assert_eq!(classify_query("What's our eNPS?", &mentions), QueryType::Aggregate);

        // "Average performance rating?" → Aggregate
        let mentions = extract_mentions("What's the average performance rating?");
        assert_eq!(classify_query("What's the average performance rating?", &mentions), QueryType::Aggregate);

        // "Company headcount" → Aggregate
        let mentions = extract_mentions("What's our total headcount?");
        assert_eq!(classify_query("What's our total headcount?", &mentions), QueryType::Aggregate);
    }

    #[test]
    fn test_classify_list_queries() {
        // "Who's in Engineering?" → List
        let mentions = extract_mentions("Who's in Engineering?");
        assert_eq!(classify_query("Who's in Engineering?", &mentions), QueryType::List);

        // "Show me everyone in Sales" → List
        let mentions = extract_mentions("Show me everyone in Sales");
        assert_eq!(classify_query("Show me everyone in Sales", &mentions), QueryType::List);

        // "List all employees in Marketing" → List
        let mentions = extract_mentions("List all employees in Marketing");
        assert_eq!(classify_query("List all employees in Marketing", &mentions), QueryType::List);
    }

    #[test]
    fn test_classify_individual_queries() {
        // "Tell me about Sarah Chen" → Individual
        let mentions = extract_mentions("Tell me about Sarah Chen");
        assert_eq!(classify_query("Tell me about Sarah Chen", &mentions), QueryType::Individual);

        // "What's John's rating?" → Individual
        let mentions = extract_mentions("What's John's rating?");
        assert_eq!(classify_query("What's John's rating?", &mentions), QueryType::Individual);

        // "Is Marcus struggling?" → Individual
        let mentions = extract_mentions("Is Marcus struggling?");
        assert_eq!(classify_query("Is Marcus struggling?", &mentions), QueryType::Individual);
    }

    #[test]
    fn test_classify_comparison_queries() {
        // "Who are our top performers?" → Comparison
        let mentions = extract_mentions("Who are our top performers?");
        assert_eq!(classify_query("Who are our top performers?", &mentions), QueryType::Comparison);

        // "Who's underperforming?" → Comparison
        let mentions = extract_mentions("Who's underperforming?");
        assert_eq!(classify_query("Who's underperforming?", &mentions), QueryType::Comparison);

        // "Show me the star employees" → Comparison
        let mentions = extract_mentions("Show me the star employees");
        assert_eq!(classify_query("Show me the star employees", &mentions), QueryType::Comparison);

        // "Who needs improvement?" → Comparison
        let mentions = extract_mentions("Who needs improvement?");
        assert_eq!(classify_query("Who needs improvement?", &mentions), QueryType::Comparison);
    }

    #[test]
    fn test_classify_attrition_queries() {
        // "Who left this year?" → Attrition
        let mentions = extract_mentions("Who left this year?");
        assert_eq!(classify_query("Who left this year?", &mentions), QueryType::Attrition);

        // "What's our turnover rate?" → Attrition (not Aggregate because turnover is attrition-specific)
        let mentions = extract_mentions("What's our turnover rate?");
        assert_eq!(classify_query("What's our turnover rate?", &mentions), QueryType::Attrition);

        // "Recent departures" → Attrition
        let mentions = extract_mentions("Show me recent departures");
        assert_eq!(classify_query("Show me recent departures", &mentions), QueryType::Attrition);

        // "Who's been terminated?" → Attrition
        let mentions = extract_mentions("Who's been terminated?");
        assert_eq!(classify_query("Who's been terminated?", &mentions), QueryType::Attrition);
    }

    #[test]
    fn test_classify_status_check_queries() {
        // "How's the Engineering team doing?" → Aggregate (status check)
        let mentions = extract_mentions("How's the Engineering team doing?");
        assert_eq!(classify_query("How's the Engineering team doing?", &mentions), QueryType::Aggregate);

        // "How is the Sales department doing?" → Aggregate
        let mentions = extract_mentions("How is the Sales department doing?");
        assert_eq!(classify_query("How is the Sales department doing?", &mentions), QueryType::Aggregate);
    }

    #[test]
    fn test_classify_general_fallback() {
        // Vague question with no clear intent → General
        let mentions = extract_mentions("Tell me something interesting");
        assert_eq!(classify_query("Tell me something interesting", &mentions), QueryType::General);

        // Simple greeting → General
        let mentions = extract_mentions("Hello, can you help me?");
        assert_eq!(classify_query("Hello, can you help me?", &mentions), QueryType::General);
    }

    #[test]
    fn test_classify_priority_individual_over_aggregate() {
        // Name + aggregate phrasing without wants_aggregate flag → Individual wins
        // "Tell me about Sarah's performance" has a name, should be Individual
        let mentions = extract_mentions("Tell me about Sarah's performance");
        assert_eq!(classify_query("Tell me about Sarah's performance", &mentions), QueryType::Individual);
    }

    #[test]
    fn test_classify_priority_comparison_over_list() {
        // "Top performers in Engineering" → Comparison (not List)
        let mentions = extract_mentions("Who are the top performers in Engineering?");
        assert_eq!(classify_query("Who are the top performers in Engineering?", &mentions), QueryType::Comparison);
    }

    #[test]
    fn test_classify_priority_attrition_over_list() {
        // "Who left the Engineering team?" → Attrition (not List)
        let mentions = extract_mentions("Who left the Engineering team?");
        assert_eq!(classify_query("Who left the Engineering team?", &mentions), QueryType::Attrition);
    }

    #[test]
    fn test_classify_aggregate_with_name_and_wants_aggregate() {
        // "What's our company eNPS?" with aggregate flag → Aggregate even if names detected
        let mentions = extract_mentions("What's our company eNPS?");
        // The wants_aggregate flag should be set, so it goes to Aggregate
        assert!(mentions.wants_aggregate);
        assert_eq!(classify_query("What's our company eNPS?", &mentions), QueryType::Aggregate);
    }
}
