// HR Command Center - Database Module
// SQLite connection management and migrations

use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("Migration error: {0}")]
    Migration(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

pub type DbPool = Pool<Sqlite>;
pub type DbResult<T> = Result<T, DbError>;

/// Get the database file path in the app data directory
pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");

    // Ensure directory exists
    fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

    app_data_dir.join("hr_command_center.db")
}

/// Initialize the database connection pool
pub async fn init_db(app: &AppHandle) -> DbResult<DbPool> {
    let db_path = get_db_path(app);
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Run migrations
    run_migrations(&pool).await?;

    Ok(pool)
}

/// Run database migrations
async fn run_migrations(pool: &DbPool) -> DbResult<()> {
    // Read and execute the initial migration
    let migration_sql = include_str!("../migrations/001_initial.sql");

    // Parse statements more carefully - handle multi-line statements
    let mut current_statement = String::new();

    for line in migration_sql.lines() {
        let trimmed = line.trim();

        // Skip empty lines and comments
        if trimmed.is_empty() || trimmed.starts_with("--") {
            continue;
        }

        current_statement.push_str(line);
        current_statement.push('\n');

        // Check if this line ends a statement
        if trimmed.ends_with(';') {
            let stmt = current_statement.trim();
            if !stmt.is_empty() {
                // Remove trailing semicolon for SQLx
                let stmt_without_semi = stmt.trim_end_matches(';').trim();
                if !stmt_without_semi.is_empty() {
                    sqlx::query(stmt_without_semi)
                        .execute(pool)
                        .await
                        .map_err(|e| {
                            DbError::Migration(format!(
                                "Failed to execute: {}\nError: {}",
                                stmt_without_semi.chars().take(100).collect::<String>(),
                                e
                            ))
                        })?;
                }
            }
            current_statement.clear();
        }
    }

    Ok(())
}

/// Database state managed by Tauri
pub struct Database {
    pub pool: DbPool,
}

impl Database {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_migration_sql_is_valid() {
        // This test just ensures the SQL file can be included and parsed
        let sql = include_str!("../migrations/001_initial.sql");
        assert!(!sql.is_empty());
        assert!(sql.contains("CREATE TABLE"));
        assert!(sql.contains("employees"));
        assert!(sql.contains("conversations"));
        assert!(sql.contains("company"));
        assert!(sql.contains("settings"));
        assert!(sql.contains("audit_log"));
        assert!(sql.contains("conversations_fts"));
    }
}
