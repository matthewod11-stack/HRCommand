// HR Command Center - Insight Canvas Module
// V2.3.2g-l: Persistent chart storage with boards, pinned charts, and annotations

use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use thiserror::Error;
use uuid::Uuid;

use crate::db::DbPool;

// ============================================================================
// Error Type
// ============================================================================

#[derive(Error, Debug)]
pub enum InsightCanvasError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Board not found: {0}")]
    BoardNotFound(String),
    #[error("Chart not found: {0}")]
    ChartNotFound(String),
    #[error("Annotation not found: {0}")]
    AnnotationNotFound(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl From<sqlx::Error> for InsightCanvasError {
    fn from(err: sqlx::Error) -> Self {
        InsightCanvasError::Database(err.to_string())
    }
}

impl serde::Serialize for InsightCanvasError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// ============================================================================
// Board Types
// ============================================================================

/// Full insight board record from database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InsightBoard {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub layout: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Lightweight board item for list views
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct InsightBoardListItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub chart_count: i64,
    pub updated_at: String,
}

/// Input for creating a new board
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBoardInput {
    pub name: String,
    pub description: Option<String>,
}

/// Input for updating an existing board
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBoardInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub layout: Option<String>,
}

// ============================================================================
// Pinned Chart Types
// ============================================================================

/// Full pinned chart record from database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PinnedChart {
    pub id: String,
    pub board_id: String,
    pub chart_data: String,
    pub analytics_request: String,
    pub title: String,
    pub position_x: i32,
    pub position_y: i32,
    pub width: i32,
    pub height: i32,
    pub conversation_id: Option<String>,
    pub message_id: Option<String>,
    pub pinned_at: String,
    pub updated_at: String,
}

/// Input for pinning a chart to a board
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinChartInput {
    pub board_id: String,
    pub chart_data: String,
    pub analytics_request: String,
    pub title: String,
    pub conversation_id: Option<String>,
    pub message_id: Option<String>,
}

/// Input for updating a pinned chart
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePinnedChartInput {
    pub title: Option<String>,
    pub position_x: Option<i32>,
    pub position_y: Option<i32>,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

// ============================================================================
// Annotation Types
// ============================================================================

/// Chart annotation record from database
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ChartAnnotation {
    pub id: String,
    pub chart_id: String,
    pub content: String,
    pub annotation_type: String,
    pub position_x: Option<i32>,
    pub position_y: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

/// Input for creating an annotation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAnnotationInput {
    pub chart_id: String,
    pub content: String,
    pub annotation_type: Option<String>,
}

// ============================================================================
// Board CRUD Operations
// ============================================================================

/// Create a new insight board
pub async fn create_board(
    pool: &DbPool,
    input: CreateBoardInput,
) -> Result<InsightBoard, InsightCanvasError> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(InsightCanvasError::InvalidInput(
            "Board name cannot be empty".to_string(),
        ));
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO insight_boards (id, name, description)
        VALUES (?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(name)
    .bind(&input.description)
    .execute(pool)
    .await?;

    get_board(pool, &id).await
}

/// Get a single board by ID
pub async fn get_board(pool: &DbPool, id: &str) -> Result<InsightBoard, InsightCanvasError> {
    let board = sqlx::query_as::<_, InsightBoard>(
        "SELECT id, name, description, layout, created_at, updated_at FROM insight_boards WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    board.ok_or_else(|| InsightCanvasError::BoardNotFound(id.to_string()))
}

/// Update an existing board
pub async fn update_board(
    pool: &DbPool,
    id: &str,
    input: UpdateBoardInput,
) -> Result<InsightBoard, InsightCanvasError> {
    // Fetch existing board
    let existing = get_board(pool, id).await?;

    // Merge with existing values
    let name = input.name.unwrap_or(existing.name);
    let description = input.description.or(existing.description);
    let layout = input.layout.unwrap_or(existing.layout);

    // Validate
    if name.trim().is_empty() {
        return Err(InsightCanvasError::InvalidInput(
            "Board name cannot be empty".to_string(),
        ));
    }

    sqlx::query(
        r#"
        UPDATE insight_boards
        SET name = ?, description = ?, layout = ?, updated_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(&layout)
    .bind(id)
    .execute(pool)
    .await?;

    get_board(pool, id).await
}

/// Delete a board and all its charts (cascading)
pub async fn delete_board(pool: &DbPool, id: &str) -> Result<(), InsightCanvasError> {
    // Verify board exists
    let _ = get_board(pool, id).await?;

    sqlx::query("DELETE FROM insight_boards WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

/// List all boards with chart counts
pub async fn list_boards(pool: &DbPool) -> Result<Vec<InsightBoardListItem>, InsightCanvasError> {
    let boards = sqlx::query_as::<_, InsightBoardListItem>(
        r#"
        SELECT
            b.id,
            b.name,
            b.description,
            COUNT(c.id) as chart_count,
            b.updated_at
        FROM insight_boards b
        LEFT JOIN pinned_charts c ON c.board_id = b.id
        GROUP BY b.id
        ORDER BY b.updated_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(boards)
}

// ============================================================================
// Pinned Chart CRUD Operations
// ============================================================================

/// Pin a chart to a board
pub async fn pin_chart(
    pool: &DbPool,
    input: PinChartInput,
) -> Result<PinnedChart, InsightCanvasError> {
    // Verify board exists
    let _ = get_board(pool, &input.board_id).await?;

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO pinned_charts (
            id, board_id, chart_data, analytics_request, title,
            conversation_id, message_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.board_id)
    .bind(&input.chart_data)
    .bind(&input.analytics_request)
    .bind(&input.title)
    .bind(&input.conversation_id)
    .bind(&input.message_id)
    .execute(pool)
    .await?;

    get_pinned_chart(pool, &id).await
}

/// Get a single pinned chart by ID
pub async fn get_pinned_chart(
    pool: &DbPool,
    id: &str,
) -> Result<PinnedChart, InsightCanvasError> {
    let chart = sqlx::query_as::<_, PinnedChart>(
        r#"
        SELECT id, board_id, chart_data, analytics_request, title,
               position_x, position_y, width, height,
               conversation_id, message_id, pinned_at, updated_at
        FROM pinned_charts WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    chart.ok_or_else(|| InsightCanvasError::ChartNotFound(id.to_string()))
}

/// Get all charts for a board
pub async fn get_charts_for_board(
    pool: &DbPool,
    board_id: &str,
) -> Result<Vec<PinnedChart>, InsightCanvasError> {
    let charts = sqlx::query_as::<_, PinnedChart>(
        r#"
        SELECT id, board_id, chart_data, analytics_request, title,
               position_x, position_y, width, height,
               conversation_id, message_id, pinned_at, updated_at
        FROM pinned_charts
        WHERE board_id = ?
        ORDER BY position_y, position_x
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(charts)
}

/// Update a pinned chart's properties
pub async fn update_pinned_chart(
    pool: &DbPool,
    id: &str,
    input: UpdatePinnedChartInput,
) -> Result<PinnedChart, InsightCanvasError> {
    let existing = get_pinned_chart(pool, id).await?;

    let title = input.title.unwrap_or(existing.title);
    let position_x = input.position_x.unwrap_or(existing.position_x);
    let position_y = input.position_y.unwrap_or(existing.position_y);
    let width = input.width.unwrap_or(existing.width);
    let height = input.height.unwrap_or(existing.height);

    sqlx::query(
        r#"
        UPDATE pinned_charts
        SET title = ?, position_x = ?, position_y = ?, width = ?, height = ?,
            updated_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(&title)
    .bind(position_x)
    .bind(position_y)
    .bind(width)
    .bind(height)
    .bind(id)
    .execute(pool)
    .await?;

    get_pinned_chart(pool, id).await
}

/// Remove a chart from a board
pub async fn unpin_chart(pool: &DbPool, id: &str) -> Result<(), InsightCanvasError> {
    let _ = get_pinned_chart(pool, id).await?;

    sqlx::query("DELETE FROM pinned_charts WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

// ============================================================================
// Annotation CRUD Operations
// ============================================================================

/// Create an annotation on a chart
pub async fn create_annotation(
    pool: &DbPool,
    input: CreateAnnotationInput,
) -> Result<ChartAnnotation, InsightCanvasError> {
    // Verify chart exists
    let _ = get_pinned_chart(pool, &input.chart_id).await?;

    let id = Uuid::new_v4().to_string();
    let annotation_type = input.annotation_type.unwrap_or_else(|| "note".to_string());

    sqlx::query(
        r#"
        INSERT INTO chart_annotations (id, chart_id, content, annotation_type)
        VALUES (?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.chart_id)
    .bind(&input.content)
    .bind(&annotation_type)
    .execute(pool)
    .await?;

    get_annotation(pool, &id).await
}

/// Get a single annotation by ID
pub async fn get_annotation(
    pool: &DbPool,
    id: &str,
) -> Result<ChartAnnotation, InsightCanvasError> {
    let annotation = sqlx::query_as::<_, ChartAnnotation>(
        r#"
        SELECT id, chart_id, content, annotation_type,
               position_x, position_y, created_at, updated_at
        FROM chart_annotations WHERE id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    annotation.ok_or_else(|| InsightCanvasError::AnnotationNotFound(id.to_string()))
}

/// Get all annotations for a chart
pub async fn get_annotations_for_chart(
    pool: &DbPool,
    chart_id: &str,
) -> Result<Vec<ChartAnnotation>, InsightCanvasError> {
    let annotations = sqlx::query_as::<_, ChartAnnotation>(
        r#"
        SELECT id, chart_id, content, annotation_type,
               position_x, position_y, created_at, updated_at
        FROM chart_annotations
        WHERE chart_id = ?
        ORDER BY created_at
        "#,
    )
    .bind(chart_id)
    .fetch_all(pool)
    .await?;

    Ok(annotations)
}

/// Update an annotation's content
pub async fn update_annotation(
    pool: &DbPool,
    id: &str,
    content: &str,
) -> Result<ChartAnnotation, InsightCanvasError> {
    let _ = get_annotation(pool, id).await?;

    sqlx::query(
        r#"
        UPDATE chart_annotations
        SET content = ?, updated_at = datetime('now')
        WHERE id = ?
        "#,
    )
    .bind(content)
    .bind(id)
    .execute(pool)
    .await?;

    get_annotation(pool, id).await
}

/// Delete an annotation
pub async fn delete_annotation(pool: &DbPool, id: &str) -> Result<(), InsightCanvasError> {
    let _ = get_annotation(pool, id).await?;

    sqlx::query("DELETE FROM chart_annotations WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_board_input_serialization() {
        let input = CreateBoardInput {
            name: "Q3 Review".to_string(),
            description: Some("Quarterly analytics".to_string()),
        };
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("Q3 Review"));
    }

    #[test]
    fn test_pin_chart_input_serialization() {
        let input = PinChartInput {
            board_id: "board-123".to_string(),
            chart_data: r#"{"chart_type":"bar"}"#.to_string(),
            analytics_request: r#"{"intent":"headcount_by"}"#.to_string(),
            title: "Headcount by Department".to_string(),
            conversation_id: Some("conv-456".to_string()),
            message_id: None,
        };
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("Headcount by Department"));
    }

    #[test]
    fn test_annotation_type_default() {
        let input = CreateAnnotationInput {
            chart_id: "chart-789".to_string(),
            content: "This trend is concerning".to_string(),
            annotation_type: None,
        };
        // When None, the create function defaults to "note"
        assert!(input.annotation_type.is_none());
    }
}
