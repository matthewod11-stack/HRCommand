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
        "performance", "rating", "review", "performer", "underperform",
        "pip", "improvement plan", "developing", "exceeds", "exceptional",
    ];

    let enps_keywords = [
        "enps", "nps", "promoter", "engagement", "satisfaction", "survey",
        "detractor", "passive", "morale",
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

    // Extract potential names (capitalized words, 2+ chars, not at sentence start)
    // This is a simple heuristic - more sophisticated NER could be added later
    let words: Vec<&str> = query.split_whitespace().collect();

    for (i, word) in words.iter().enumerate() {
        let clean_word = word.trim_matches(|c: char| !c.is_alphanumeric());

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
pub async fn find_relevant_employees(
    pool: &DbPool,
    mentions: &QueryMentions,
    limit: usize,
) -> Result<Vec<EmployeeContext>, ContextError> {
    let mut employee_ids: Vec<String> = Vec::new();

    // Search by name mentions
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

    // Search by department mentions
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

    // If aggregate query with no specific mentions, get a sample
    if employee_ids.is_empty() && mentions.is_aggregate_query {
        // Get a representative sample for aggregate queries
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
}
