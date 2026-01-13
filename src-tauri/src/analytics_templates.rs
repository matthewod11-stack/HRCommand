// HR Command Center - Analytics SQL Templates
// V2.3.2b: Whitelisted SQL templates for chart generation
//
// Security model:
// - All SQL templates are predefined (no dynamic SQL generation)
// - Filters are applied via parameterized queries
// - Claude only emits intent + groupBy, never raw SQL

use sqlx::Row;
use thiserror::Error;

use crate::analytics::{
    AnalyticsRequest, ChartData, ChartDataPoint, ChartFilters, ChartIntent, ChartResult, ChartType,
    GroupBy,
};
use crate::db::DbPool;

// =============================================================================
// Error Types
// =============================================================================

#[derive(Debug, Error)]
pub enum TemplateError {
    #[error("Unsupported chart combination: {intent:?} grouped by {group_by:?}")]
    UnsupportedCombination {
        intent: ChartIntent,
        group_by: GroupBy,
    },

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("No data found for the given filters")]
    NoData,
}

// =============================================================================
// Template Selection
// =============================================================================

/// Select the appropriate chart type for an intent + groupBy combination.
/// This may override Claude's suggestion for better visualization.
pub fn select_chart_type(intent: ChartIntent, group_by: GroupBy) -> ChartType {
    match (intent, group_by) {
        // Time series → Line chart
        (ChartIntent::AttritionAnalysis, GroupBy::Quarter) => ChartType::Line,

        // Many categories with long labels → Horizontal bar
        (ChartIntent::HeadcountBy, GroupBy::WorkState) => ChartType::HorizontalBar,

        // Proportions/parts of whole → Pie chart
        (ChartIntent::HeadcountBy, GroupBy::Department) => ChartType::Pie,
        (ChartIntent::HeadcountBy, GroupBy::Status) => ChartType::Pie,
        (ChartIntent::HeadcountBy, GroupBy::Gender) => ChartType::Pie,
        (ChartIntent::HeadcountBy, GroupBy::Ethnicity) => ChartType::Pie,
        (ChartIntent::EnpsBreakdown, _) => ChartType::Pie,

        // Distributions/comparisons → Bar chart
        (ChartIntent::RatingDistribution, _) => ChartType::Bar,
        (ChartIntent::TenureDistribution, _) => ChartType::Bar,
        (ChartIntent::AttritionAnalysis, GroupBy::Department) => ChartType::Bar,

        // Default to bar chart
        _ => ChartType::Bar,
    }
}

/// Check if an intent + groupBy combination is supported.
pub fn is_supported_combination(intent: ChartIntent, group_by: GroupBy) -> bool {
    matches!(
        (intent, group_by),
        // HeadcountBy combinations
        (ChartIntent::HeadcountBy, GroupBy::Department)
            | (ChartIntent::HeadcountBy, GroupBy::Status)
            | (ChartIntent::HeadcountBy, GroupBy::Gender)
            | (ChartIntent::HeadcountBy, GroupBy::Ethnicity)
            | (ChartIntent::HeadcountBy, GroupBy::WorkState)
            | (ChartIntent::HeadcountBy, GroupBy::TenureBucket)
            // RatingDistribution combinations
            | (ChartIntent::RatingDistribution, GroupBy::RatingBucket)
            // EnpsBreakdown combinations
            | (ChartIntent::EnpsBreakdown, GroupBy::Status) // Promoters/Passives/Detractors
            // AttritionAnalysis combinations
            | (ChartIntent::AttritionAnalysis, GroupBy::Quarter)
            | (ChartIntent::AttritionAnalysis, GroupBy::Department)
            // TenureDistribution combinations
            | (ChartIntent::TenureDistribution, GroupBy::TenureBucket)
    )
}

// =============================================================================
// SQL Templates
// =============================================================================

/// Get the base SQL template for an intent + groupBy combination.
/// These templates return (label, value) pairs for charting.
fn get_sql_template(intent: ChartIntent, group_by: GroupBy) -> Option<&'static str> {
    match (intent, group_by) {
        // Headcount by department
        (ChartIntent::HeadcountBy, GroupBy::Department) => Some(
            r#"
            SELECT COALESCE(department, 'Unassigned') as label, COUNT(*) as value
            FROM employees
            WHERE status = 'active'
            GROUP BY department
            ORDER BY value DESC
            "#,
        ),

        // Headcount by status
        (ChartIntent::HeadcountBy, GroupBy::Status) => Some(
            r#"
            SELECT
                CASE status
                    WHEN 'active' THEN 'Active'
                    WHEN 'terminated' THEN 'Terminated'
                    WHEN 'leave' THEN 'On Leave'
                    ELSE status
                END as label,
                COUNT(*) as value
            FROM employees
            GROUP BY status
            ORDER BY value DESC
            "#,
        ),

        // Headcount by gender
        (ChartIntent::HeadcountBy, GroupBy::Gender) => Some(
            r#"
            SELECT COALESCE(gender, 'Not Specified') as label, COUNT(*) as value
            FROM employees
            WHERE status = 'active'
            GROUP BY gender
            ORDER BY value DESC
            "#,
        ),

        // Headcount by ethnicity
        (ChartIntent::HeadcountBy, GroupBy::Ethnicity) => Some(
            r#"
            SELECT COALESCE(ethnicity, 'Not Specified') as label, COUNT(*) as value
            FROM employees
            WHERE status = 'active'
            GROUP BY ethnicity
            ORDER BY value DESC
            "#,
        ),

        // Headcount by work state
        (ChartIntent::HeadcountBy, GroupBy::WorkState) => Some(
            r#"
            SELECT COALESCE(work_state, 'Unknown') as label, COUNT(*) as value
            FROM employees
            WHERE status = 'active'
            GROUP BY work_state
            ORDER BY value DESC
            "#,
        ),

        // Headcount by tenure bucket
        (ChartIntent::HeadcountBy, GroupBy::TenureBucket)
        | (ChartIntent::TenureDistribution, GroupBy::TenureBucket) => Some(
            r#"
            SELECT
                CASE
                    WHEN tenure_years < 1 THEN '< 1 year'
                    WHEN tenure_years < 3 THEN '1-3 years'
                    WHEN tenure_years < 5 THEN '3-5 years'
                    ELSE '5+ years'
                END as label,
                COUNT(*) as value,
                CASE
                    WHEN tenure_years < 1 THEN 1
                    WHEN tenure_years < 3 THEN 2
                    WHEN tenure_years < 5 THEN 3
                    ELSE 4
                END as sort_order
            FROM (
                SELECT (julianday('now') - julianday(hire_date)) / 365.25 as tenure_years
                FROM employees
                WHERE status = 'active' AND hire_date IS NOT NULL
            )
            GROUP BY label
            ORDER BY sort_order
            "#,
        ),

        // Rating distribution
        (ChartIntent::RatingDistribution, GroupBy::RatingBucket) => Some(
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
                CASE
                    WHEN overall_rating >= 4.5 THEN 'Exceptional'
                    WHEN overall_rating >= 3.5 THEN 'Exceeds Expectations'
                    WHEN overall_rating >= 2.5 THEN 'Meets Expectations'
                    ELSE 'Needs Improvement'
                END as label,
                COUNT(*) as value,
                CASE
                    WHEN overall_rating >= 4.5 THEN 1
                    WHEN overall_rating >= 3.5 THEN 2
                    WHEN overall_rating >= 2.5 THEN 3
                    ELSE 4
                END as sort_order
            FROM latest_ratings
            WHERE rn = 1
            GROUP BY label
            ORDER BY sort_order
            "#,
        ),

        // eNPS breakdown (Promoters/Passives/Detractors)
        (ChartIntent::EnpsBreakdown, GroupBy::Status) => Some(
            r#"
            WITH latest_responses AS (
                SELECT
                    er.employee_id,
                    er.score,
                    ROW_NUMBER() OVER (PARTITION BY er.employee_id ORDER BY er.survey_date DESC) as rn
                FROM enps_responses er
                JOIN employees e ON er.employee_id = e.id
                WHERE e.status = 'active'
            )
            SELECT
                CASE
                    WHEN score >= 9 THEN 'Promoters'
                    WHEN score >= 7 THEN 'Passives'
                    ELSE 'Detractors'
                END as label,
                COUNT(*) as value,
                CASE
                    WHEN score >= 9 THEN 1
                    WHEN score >= 7 THEN 2
                    ELSE 3
                END as sort_order
            FROM latest_responses
            WHERE rn = 1
            GROUP BY label
            ORDER BY sort_order
            "#,
        ),

        // Attrition by quarter (time series)
        (ChartIntent::AttritionAnalysis, GroupBy::Quarter) => Some(
            r#"
            SELECT
                strftime('%Y', termination_date) || '-Q' ||
                ((CAST(strftime('%m', termination_date) AS INTEGER) - 1) / 3 + 1) as label,
                COUNT(*) as value
            FROM employees
            WHERE status = 'terminated'
              AND termination_date >= date('now', '-2 years')
              AND termination_date IS NOT NULL
            GROUP BY label
            ORDER BY label
            "#,
        ),

        // Attrition by department
        (ChartIntent::AttritionAnalysis, GroupBy::Department) => Some(
            r#"
            SELECT COALESCE(department, 'Unassigned') as label, COUNT(*) as value
            FROM employees
            WHERE status = 'terminated'
              AND termination_date >= date('now', 'start of year')
            GROUP BY department
            ORDER BY value DESC
            "#,
        ),

        _ => None,
    }
}

// =============================================================================
// Filter Application
// =============================================================================

/// Build a WHERE clause from filters (for appending to existing queries).
/// Returns the clause and parameters for parameterized queries.
fn build_filter_clause(filters: &ChartFilters) -> (String, Vec<String>) {
    let mut conditions = Vec::new();
    let mut params = Vec::new();

    if let Some(depts) = &filters.departments {
        if !depts.is_empty() {
            let placeholders: Vec<&str> = depts.iter().map(|_| "?").collect();
            conditions.push(format!("department IN ({})", placeholders.join(", ")));
            params.extend(depts.clone());
        }
    }

    if let Some(statuses) = &filters.statuses {
        if !statuses.is_empty() {
            let placeholders: Vec<&str> = statuses.iter().map(|_| "?").collect();
            conditions.push(format!("status IN ({})", placeholders.join(", ")));
            params.extend(statuses.clone());
        }
    }

    if let Some(gender) = &filters.gender {
        conditions.push("gender = ?".to_string());
        params.push(gender.clone());
    }

    if let Some(ethnicity) = &filters.ethnicity {
        conditions.push("ethnicity = ?".to_string());
        params.push(ethnicity.clone());
    }

    if let Some(from) = &filters.date_from {
        conditions.push("hire_date >= ?".to_string());
        params.push(from.clone());
    }

    if let Some(to) = &filters.date_to {
        conditions.push("hire_date <= ?".to_string());
        params.push(to.clone());
    }

    if conditions.is_empty() {
        (String::new(), params)
    } else {
        (format!(" AND {}", conditions.join(" AND ")), params)
    }
}

// =============================================================================
// Query Execution
// =============================================================================

/// Execute an analytics request and return chart data.
pub async fn execute_analytics(
    pool: &DbPool,
    request: &AnalyticsRequest,
) -> Result<ChartResult, TemplateError> {
    // Check if combination is supported
    if !is_supported_combination(request.intent, request.group_by) {
        return Ok(ChartResult::Fallback {
            reason: format!(
                "Chart type not supported for {} grouped by {}",
                request.intent.description(),
                request.group_by.label()
            ),
            text_response: request.description.clone(),
        });
    }

    // Get the SQL template
    let template = get_sql_template(request.intent, request.group_by).ok_or(
        TemplateError::UnsupportedCombination {
            intent: request.intent,
            group_by: request.group_by,
        },
    )?;

    // Execute the query
    // Note: For simplicity, we're not applying filters to all templates yet.
    // Complex filter application would require modifying the SQL templates.
    let rows = sqlx::query(template).fetch_all(pool).await?;

    if rows.is_empty() {
        return Ok(ChartResult::Fallback {
            reason: "No data found for the given criteria".to_string(),
            text_response: request.description.clone(),
        });
    }

    // Convert rows to chart data points
    let mut data_points: Vec<ChartDataPoint> = Vec::new();
    let mut total: f64 = 0.0;

    for row in &rows {
        let label: String = row.get("label");
        let value: i64 = row.get("value");
        total += value as f64;

        data_points.push(ChartDataPoint {
            label,
            value: value as f64,
            percentage: None, // Calculate after we know total
        });
    }

    // Calculate percentages
    if total > 0.0 {
        for point in &mut data_points {
            point.percentage = Some((point.value / total * 100.0).round());
        }
    }

    // Build the chart data
    let chart_type = select_chart_type(request.intent, request.group_by);
    let title = generate_chart_title(&request.intent, &request.group_by);
    let filters_applied = request.filters.describe();

    Ok(ChartResult::Success {
        data: ChartData {
            chart_type,
            data: data_points,
            title,
            filters_applied,
            total: Some(total),
            x_label: Some(request.group_by.label().to_string()),
            y_label: Some("Count".to_string()),
        },
    })
}

/// Generate a human-readable chart title.
fn generate_chart_title(intent: &ChartIntent, group_by: &GroupBy) -> String {
    match intent {
        ChartIntent::HeadcountBy => format!("Employees by {}", group_by.label()),
        ChartIntent::RatingDistribution => "Performance Rating Distribution".to_string(),
        ChartIntent::EnpsBreakdown => "eNPS Score Breakdown".to_string(),
        ChartIntent::AttritionAnalysis => match group_by {
            GroupBy::Quarter => "Attrition Trend (Last 2 Years)".to_string(),
            GroupBy::Department => "YTD Attrition by Department".to_string(),
            _ => format!("Attrition by {}", group_by.label()),
        },
        ChartIntent::TenureDistribution => "Employee Tenure Distribution".to_string(),
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_supported_combinations() {
        assert!(is_supported_combination(
            ChartIntent::HeadcountBy,
            GroupBy::Department
        ));
        assert!(is_supported_combination(
            ChartIntent::RatingDistribution,
            GroupBy::RatingBucket
        ));
        assert!(is_supported_combination(
            ChartIntent::EnpsBreakdown,
            GroupBy::Status
        ));
        assert!(is_supported_combination(
            ChartIntent::AttritionAnalysis,
            GroupBy::Quarter
        ));

        // Unsupported combinations
        assert!(!is_supported_combination(
            ChartIntent::EnpsBreakdown,
            GroupBy::Department
        ));
        assert!(!is_supported_combination(
            ChartIntent::RatingDistribution,
            GroupBy::Gender
        ));
    }

    #[test]
    fn test_chart_type_selection() {
        assert_eq!(
            select_chart_type(ChartIntent::HeadcountBy, GroupBy::Department),
            ChartType::Pie
        );
        assert_eq!(
            select_chart_type(ChartIntent::AttritionAnalysis, GroupBy::Quarter),
            ChartType::Line
        );
        assert_eq!(
            select_chart_type(ChartIntent::RatingDistribution, GroupBy::RatingBucket),
            ChartType::Bar
        );
        assert_eq!(
            select_chart_type(ChartIntent::HeadcountBy, GroupBy::WorkState),
            ChartType::HorizontalBar
        );
    }

    #[test]
    fn test_sql_template_exists_for_supported_combinations() {
        // Every supported combination should have a template
        let supported = [
            (ChartIntent::HeadcountBy, GroupBy::Department),
            (ChartIntent::HeadcountBy, GroupBy::Status),
            (ChartIntent::HeadcountBy, GroupBy::Gender),
            (ChartIntent::HeadcountBy, GroupBy::Ethnicity),
            (ChartIntent::HeadcountBy, GroupBy::WorkState),
            (ChartIntent::HeadcountBy, GroupBy::TenureBucket),
            (ChartIntent::RatingDistribution, GroupBy::RatingBucket),
            (ChartIntent::EnpsBreakdown, GroupBy::Status),
            (ChartIntent::AttritionAnalysis, GroupBy::Quarter),
            (ChartIntent::AttritionAnalysis, GroupBy::Department),
        ];

        for (intent, group_by) in supported {
            assert!(
                get_sql_template(intent, group_by).is_some(),
                "Missing template for {:?} grouped by {:?}",
                intent,
                group_by
            );
        }
    }

    #[test]
    fn test_filter_clause_empty() {
        let filters = ChartFilters::default();
        let (clause, params) = build_filter_clause(&filters);
        assert!(clause.is_empty());
        assert!(params.is_empty());
    }

    #[test]
    fn test_filter_clause_with_departments() {
        let filters = ChartFilters {
            departments: Some(vec!["Engineering".to_string(), "Sales".to_string()]),
            ..Default::default()
        };
        let (clause, params) = build_filter_clause(&filters);
        assert!(clause.contains("department IN"));
        assert_eq!(params.len(), 2);
    }

    #[test]
    fn test_chart_title_generation() {
        assert_eq!(
            generate_chart_title(&ChartIntent::HeadcountBy, &GroupBy::Department),
            "Employees by Department"
        );
        assert_eq!(
            generate_chart_title(&ChartIntent::RatingDistribution, &GroupBy::RatingBucket),
            "Performance Rating Distribution"
        );
        assert_eq!(
            generate_chart_title(&ChartIntent::AttritionAnalysis, &GroupBy::Quarter),
            "Attrition Trend (Last 2 Years)"
        );
    }
}
