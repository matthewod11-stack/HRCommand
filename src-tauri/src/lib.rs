// HR Command Center - Rust Backend
// This file contains the core library code for Tauri commands

use tauri::Manager;

mod bulk_import;
mod chat;
mod company;
mod db;
mod employees;
mod enps;
mod file_parser;
mod keyring;
mod network;
mod performance_ratings;
mod performance_reviews;
mod review_cycles;

use db::Database;

/// Greet command for testing - will be replaced with actual commands
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to HR Command Center.", name)
}

/// Check if database is initialized
#[tauri::command]
fn check_db(state: tauri::State<'_, Database>) -> bool {
    // If we can access the state, the database is initialized
    let _ = &state.pool;
    true
}

// ============================================================================
// API Key Management Commands
// ============================================================================

/// Store the Anthropic API key in macOS Keychain
#[tauri::command]
fn store_api_key(api_key: String) -> Result<(), keyring::KeyringError> {
    keyring::store_api_key(&api_key)
}

/// Check if an API key exists in the Keychain
#[tauri::command]
fn has_api_key() -> bool {
    keyring::has_api_key()
}

/// Delete the API key from the Keychain
#[tauri::command]
fn delete_api_key() -> Result<(), keyring::KeyringError> {
    keyring::delete_api_key()
}

/// Validate an API key format (does not store it)
#[tauri::command]
fn validate_api_key_format(api_key: String) -> bool {
    api_key.starts_with("sk-ant-") && api_key.len() > 20
}

// ============================================================================
// Chat Commands
// ============================================================================

/// Send a message to Claude and get a response (non-streaming)
#[tauri::command]
async fn send_chat_message(
    messages: Vec<chat::ChatMessage>,
    system_prompt: Option<String>,
) -> Result<chat::ChatResponse, chat::ChatError> {
    chat::send_message(messages, system_prompt).await
}

/// Send a message to Claude with streaming response
/// Emits "chat-stream" events as response chunks arrive
#[tauri::command]
async fn send_chat_message_streaming(
    app: tauri::AppHandle,
    messages: Vec<chat::ChatMessage>,
    system_prompt: Option<String>,
) -> Result<(), chat::ChatError> {
    chat::send_message_streaming(app, messages, system_prompt).await
}

// ============================================================================
// Network Status Commands
// ============================================================================

/// Check if the network and Anthropic API are reachable
#[tauri::command]
async fn check_network_status() -> network::NetworkStatus {
    network::check_network().await
}

/// Quick check if online (returns just a boolean)
#[tauri::command]
async fn is_online() -> bool {
    network::is_online().await
}

// ============================================================================
// Company Profile Commands
// ============================================================================

/// Check if a company profile exists
#[tauri::command]
async fn has_company(
    state: tauri::State<'_, Database>,
) -> Result<bool, company::CompanyError> {
    company::has_company(&state.pool).await
}

/// Get the company profile
#[tauri::command]
async fn get_company(
    state: tauri::State<'_, Database>,
) -> Result<company::Company, company::CompanyError> {
    company::get_company(&state.pool).await
}

/// Create or update the company profile
#[tauri::command]
async fn upsert_company(
    state: tauri::State<'_, Database>,
    input: company::UpsertCompany,
) -> Result<company::Company, company::CompanyError> {
    company::upsert_company(&state.pool, input).await
}

/// Get summary of states where employees work (operational footprint)
#[tauri::command]
async fn get_employee_work_states(
    state: tauri::State<'_, Database>,
) -> Result<company::EmployeeStatesSummary, company::CompanyError> {
    company::get_employee_work_states(&state.pool).await
}

// ============================================================================
// Employee Management Commands
// ============================================================================

/// Create a new employee
#[tauri::command]
async fn create_employee(
    state: tauri::State<'_, Database>,
    input: employees::CreateEmployee,
) -> Result<employees::Employee, employees::EmployeeError> {
    employees::create_employee(&state.pool, input).await
}

/// Get an employee by ID
#[tauri::command]
async fn get_employee(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<employees::Employee, employees::EmployeeError> {
    employees::get_employee(&state.pool, &id).await
}

/// Get an employee by email
#[tauri::command]
async fn get_employee_by_email(
    state: tauri::State<'_, Database>,
    email: String,
) -> Result<Option<employees::Employee>, employees::EmployeeError> {
    employees::get_employee_by_email(&state.pool, &email).await
}

/// Update an employee
#[tauri::command]
async fn update_employee(
    state: tauri::State<'_, Database>,
    id: String,
    input: employees::UpdateEmployee,
) -> Result<employees::Employee, employees::EmployeeError> {
    employees::update_employee(&state.pool, &id, input).await
}

/// Delete an employee
#[tauri::command]
async fn delete_employee(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<(), employees::EmployeeError> {
    employees::delete_employee(&state.pool, &id).await
}

/// List employees with filtering
#[tauri::command]
async fn list_employees(
    state: tauri::State<'_, Database>,
    filter: employees::EmployeeFilter,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<employees::EmployeeListResult, employees::EmployeeError> {
    employees::list_employees(&state.pool, filter, limit, offset).await
}

/// Get all unique departments
#[tauri::command]
async fn get_departments(
    state: tauri::State<'_, Database>,
) -> Result<Vec<String>, employees::EmployeeError> {
    employees::get_departments(&state.pool).await
}

/// Get employee counts by status
#[tauri::command]
async fn get_employee_counts(
    state: tauri::State<'_, Database>,
) -> Result<Vec<(String, i64)>, employees::EmployeeError> {
    employees::get_employee_counts(&state.pool).await
}

/// Bulk import employees (upsert by email)
#[tauri::command]
async fn import_employees(
    state: tauri::State<'_, Database>,
    employees: Vec<employees::CreateEmployee>,
) -> Result<employees::ImportResult, employees::EmployeeError> {
    employees::import_employees(&state.pool, employees).await
}

// ============================================================================
// Review Cycle Commands
// ============================================================================

/// Create a new review cycle
#[tauri::command]
async fn create_review_cycle(
    state: tauri::State<'_, Database>,
    input: review_cycles::CreateReviewCycle,
) -> Result<review_cycles::ReviewCycle, review_cycles::ReviewCycleError> {
    review_cycles::create_review_cycle(&state.pool, input).await
}

/// Get a review cycle by ID
#[tauri::command]
async fn get_review_cycle(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<review_cycles::ReviewCycle, review_cycles::ReviewCycleError> {
    review_cycles::get_review_cycle(&state.pool, &id).await
}

/// Update a review cycle
#[tauri::command]
async fn update_review_cycle(
    state: tauri::State<'_, Database>,
    id: String,
    input: review_cycles::UpdateReviewCycle,
) -> Result<review_cycles::ReviewCycle, review_cycles::ReviewCycleError> {
    review_cycles::update_review_cycle(&state.pool, &id, input).await
}

/// Delete a review cycle
#[tauri::command]
async fn delete_review_cycle(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<(), review_cycles::ReviewCycleError> {
    review_cycles::delete_review_cycle(&state.pool, &id).await
}

/// List all review cycles
#[tauri::command]
async fn list_review_cycles(
    state: tauri::State<'_, Database>,
    status_filter: Option<String>,
) -> Result<Vec<review_cycles::ReviewCycle>, review_cycles::ReviewCycleError> {
    review_cycles::list_review_cycles(&state.pool, status_filter).await
}

/// Get the current active review cycle
#[tauri::command]
async fn get_active_review_cycle(
    state: tauri::State<'_, Database>,
) -> Result<Option<review_cycles::ReviewCycle>, review_cycles::ReviewCycleError> {
    review_cycles::get_active_review_cycle(&state.pool).await
}

/// Close a review cycle
#[tauri::command]
async fn close_review_cycle(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<review_cycles::ReviewCycle, review_cycles::ReviewCycleError> {
    review_cycles::close_review_cycle(&state.pool, &id).await
}

// ============================================================================
// Performance Rating Commands
// ============================================================================

/// Create a performance rating
#[tauri::command]
async fn create_performance_rating(
    state: tauri::State<'_, Database>,
    input: performance_ratings::CreateRating,
) -> Result<performance_ratings::PerformanceRating, performance_ratings::RatingError> {
    performance_ratings::create_rating(&state.pool, input).await
}

/// Get a rating by ID
#[tauri::command]
async fn get_performance_rating(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<performance_ratings::PerformanceRating, performance_ratings::RatingError> {
    performance_ratings::get_rating(&state.pool, &id).await
}

/// Get all ratings for an employee
#[tauri::command]
async fn get_ratings_for_employee(
    state: tauri::State<'_, Database>,
    employee_id: String,
) -> Result<Vec<performance_ratings::PerformanceRating>, performance_ratings::RatingError> {
    performance_ratings::get_ratings_for_employee(&state.pool, &employee_id).await
}

/// Get all ratings for a review cycle
#[tauri::command]
async fn get_ratings_for_cycle(
    state: tauri::State<'_, Database>,
    review_cycle_id: String,
) -> Result<Vec<performance_ratings::PerformanceRating>, performance_ratings::RatingError> {
    performance_ratings::get_ratings_for_cycle(&state.pool, &review_cycle_id).await
}

/// Get the latest rating for an employee
#[tauri::command]
async fn get_latest_rating(
    state: tauri::State<'_, Database>,
    employee_id: String,
) -> Result<Option<performance_ratings::PerformanceRating>, performance_ratings::RatingError> {
    performance_ratings::get_latest_rating_for_employee(&state.pool, &employee_id).await
}

/// Update a rating
#[tauri::command]
async fn update_performance_rating(
    state: tauri::State<'_, Database>,
    id: String,
    input: performance_ratings::UpdateRating,
) -> Result<performance_ratings::PerformanceRating, performance_ratings::RatingError> {
    performance_ratings::update_rating(&state.pool, &id, input).await
}

/// Delete a rating
#[tauri::command]
async fn delete_performance_rating(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<(), performance_ratings::RatingError> {
    performance_ratings::delete_rating(&state.pool, &id).await
}

/// Get rating distribution for a cycle
#[tauri::command]
async fn get_rating_distribution(
    state: tauri::State<'_, Database>,
    review_cycle_id: String,
) -> Result<performance_ratings::RatingDistribution, performance_ratings::RatingError> {
    performance_ratings::get_rating_distribution(&state.pool, &review_cycle_id).await
}

/// Get average rating for a cycle
#[tauri::command]
async fn get_average_rating(
    state: tauri::State<'_, Database>,
    review_cycle_id: String,
) -> Result<Option<f64>, performance_ratings::RatingError> {
    performance_ratings::get_average_rating(&state.pool, &review_cycle_id).await
}

// ============================================================================
// Performance Review Commands
// ============================================================================

#[tauri::command]
async fn create_performance_review(
    state: tauri::State<'_, Database>,
    input: performance_reviews::CreateReview,
) -> Result<performance_reviews::PerformanceReview, performance_reviews::ReviewError> {
    performance_reviews::create_review(&state.pool, input).await
}

#[tauri::command]
async fn get_performance_review(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<performance_reviews::PerformanceReview, performance_reviews::ReviewError> {
    performance_reviews::get_review(&state.pool, &id).await
}

#[tauri::command]
async fn get_reviews_for_employee(
    state: tauri::State<'_, Database>,
    employee_id: String,
) -> Result<Vec<performance_reviews::PerformanceReview>, performance_reviews::ReviewError> {
    performance_reviews::get_reviews_for_employee(&state.pool, &employee_id).await
}

#[tauri::command]
async fn get_reviews_for_cycle(
    state: tauri::State<'_, Database>,
    review_cycle_id: String,
) -> Result<Vec<performance_reviews::PerformanceReview>, performance_reviews::ReviewError> {
    performance_reviews::get_reviews_for_cycle(&state.pool, &review_cycle_id).await
}

#[tauri::command]
async fn update_performance_review(
    state: tauri::State<'_, Database>,
    id: String,
    input: performance_reviews::UpdateReview,
) -> Result<performance_reviews::PerformanceReview, performance_reviews::ReviewError> {
    performance_reviews::update_review(&state.pool, &id, input).await
}

#[tauri::command]
async fn delete_performance_review(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<(), performance_reviews::ReviewError> {
    performance_reviews::delete_review(&state.pool, &id).await
}

#[tauri::command]
async fn search_performance_reviews(
    state: tauri::State<'_, Database>,
    query: String,
) -> Result<Vec<performance_reviews::PerformanceReview>, performance_reviews::ReviewError> {
    performance_reviews::search_reviews(&state.pool, &query).await
}

// ============================================================================
// eNPS Commands
// ============================================================================

#[tauri::command]
async fn create_enps_response(
    state: tauri::State<'_, Database>,
    input: enps::CreateEnps,
) -> Result<enps::EnpsResponse, enps::EnpsError> {
    enps::create_enps(&state.pool, input).await
}

#[tauri::command]
async fn get_enps_response(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<enps::EnpsResponse, enps::EnpsError> {
    enps::get_enps(&state.pool, &id).await
}

#[tauri::command]
async fn get_enps_for_employee(
    state: tauri::State<'_, Database>,
    employee_id: String,
) -> Result<Vec<enps::EnpsResponse>, enps::EnpsError> {
    enps::get_enps_for_employee(&state.pool, &employee_id).await
}

#[tauri::command]
async fn get_enps_for_survey(
    state: tauri::State<'_, Database>,
    survey_name: String,
) -> Result<Vec<enps::EnpsResponse>, enps::EnpsError> {
    enps::get_enps_for_survey(&state.pool, &survey_name).await
}

#[tauri::command]
async fn delete_enps_response(
    state: tauri::State<'_, Database>,
    id: String,
) -> Result<(), enps::EnpsError> {
    enps::delete_enps(&state.pool, &id).await
}

#[tauri::command]
async fn calculate_enps_score(
    state: tauri::State<'_, Database>,
    survey_name: String,
) -> Result<enps::EnpsScore, enps::EnpsError> {
    enps::calculate_enps(&state.pool, &survey_name).await
}

#[tauri::command]
async fn get_latest_enps_for_employee(
    state: tauri::State<'_, Database>,
    employee_id: String,
) -> Result<Option<enps::EnpsResponse>, enps::EnpsError> {
    enps::get_latest_enps(&state.pool, &employee_id).await
}

// ============================================================================
// Bulk Import Commands (Test Data)
// ============================================================================

/// Clear all data from the database (for test data reset)
#[tauri::command]
async fn bulk_clear_data(
    state: tauri::State<'_, Database>,
) -> Result<(), bulk_import::ImportError> {
    bulk_import::clear_all_data(&state.pool).await
}

/// Bulk import review cycles with predefined IDs
#[tauri::command]
async fn bulk_import_review_cycles(
    state: tauri::State<'_, Database>,
    cycles: Vec<bulk_import::ImportReviewCycle>,
) -> Result<bulk_import::BulkImportResult, bulk_import::ImportError> {
    bulk_import::import_review_cycles(&state.pool, cycles).await
}

/// Bulk import employees with predefined IDs
#[tauri::command]
async fn bulk_import_employees(
    state: tauri::State<'_, Database>,
    employees: Vec<bulk_import::ImportEmployee>,
) -> Result<bulk_import::BulkImportResult, bulk_import::ImportError> {
    bulk_import::import_employees_bulk(&state.pool, employees).await
}

/// Bulk import performance ratings with predefined IDs
#[tauri::command]
async fn bulk_import_ratings(
    state: tauri::State<'_, Database>,
    ratings: Vec<bulk_import::ImportRating>,
) -> Result<bulk_import::BulkImportResult, bulk_import::ImportError> {
    bulk_import::import_ratings_bulk(&state.pool, ratings).await
}

/// Bulk import performance reviews with predefined IDs
#[tauri::command]
async fn bulk_import_reviews(
    state: tauri::State<'_, Database>,
    reviews: Vec<bulk_import::ImportReview>,
) -> Result<bulk_import::BulkImportResult, bulk_import::ImportError> {
    bulk_import::import_reviews_bulk(&state.pool, reviews).await
}

/// Bulk import eNPS responses with predefined IDs
#[tauri::command]
async fn bulk_import_enps(
    state: tauri::State<'_, Database>,
    responses: Vec<bulk_import::ImportEnps>,
) -> Result<bulk_import::BulkImportResult, bulk_import::ImportError> {
    bulk_import::import_enps_bulk(&state.pool, responses).await
}

/// Verify data integrity after import
#[tauri::command]
async fn verify_data_integrity(
    state: tauri::State<'_, Database>,
) -> Result<Vec<bulk_import::IntegrityCheckResult>, bulk_import::ImportError> {
    bulk_import::verify_integrity(&state.pool).await
}

// ============================================================================
// File Parser Commands
// ============================================================================

/// Parse a file (CSV, TSV, XLSX, XLS) and return all rows
#[tauri::command]
fn parse_file(
    data: Vec<u8>,
    file_name: String,
) -> Result<file_parser::ParseResult, file_parser::ParseError> {
    file_parser::parse_file(&data, &file_name)
}

/// Parse a file and return only a preview (first N rows)
#[tauri::command]
fn parse_file_preview(
    data: Vec<u8>,
    file_name: String,
    preview_rows: Option<usize>,
) -> Result<file_parser::ParsePreview, file_parser::ParseError> {
    file_parser::parse_file_preview(&data, &file_name, preview_rows)
}

/// Get list of supported file extensions
#[tauri::command]
fn get_supported_extensions() -> Vec<&'static str> {
    file_parser::supported_extensions()
}

/// Check if a file is supported for import
#[tauri::command]
fn is_supported_file(file_name: String) -> bool {
    file_parser::is_supported_file(&file_name)
}

/// Map parsed headers to standard employee fields
#[tauri::command]
fn map_employee_columns(
    headers: Vec<String>,
) -> std::collections::HashMap<String, String> {
    file_parser::map_employee_columns(&headers)
}

/// Map parsed headers to rating fields
#[tauri::command]
fn map_rating_columns(
    headers: Vec<String>,
) -> std::collections::HashMap<String, String> {
    file_parser::map_rating_columns(&headers)
}

/// Map parsed headers to eNPS fields
#[tauri::command]
fn map_enps_columns(
    headers: Vec<String>,
) -> std::collections::HashMap<String, String> {
    file_parser::map_enps_columns(&headers)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_db,
            store_api_key,
            has_api_key,
            delete_api_key,
            validate_api_key_format,
            send_chat_message,
            send_chat_message_streaming,
            check_network_status,
            is_online,
            // Company profile
            has_company,
            get_company,
            upsert_company,
            get_employee_work_states,
            // Employee management
            create_employee,
            get_employee,
            get_employee_by_email,
            update_employee,
            delete_employee,
            list_employees,
            get_departments,
            get_employee_counts,
            import_employees,
            // Review cycles
            create_review_cycle,
            get_review_cycle,
            update_review_cycle,
            delete_review_cycle,
            list_review_cycles,
            get_active_review_cycle,
            close_review_cycle,
            // Performance ratings
            create_performance_rating,
            get_performance_rating,
            get_ratings_for_employee,
            get_ratings_for_cycle,
            get_latest_rating,
            update_performance_rating,
            delete_performance_rating,
            get_rating_distribution,
            get_average_rating,
            // Performance reviews
            create_performance_review,
            get_performance_review,
            get_reviews_for_employee,
            get_reviews_for_cycle,
            update_performance_review,
            delete_performance_review,
            search_performance_reviews,
            // eNPS
            create_enps_response,
            get_enps_response,
            get_enps_for_employee,
            get_enps_for_survey,
            delete_enps_response,
            calculate_enps_score,
            get_latest_enps_for_employee,
            // File parser
            parse_file,
            parse_file_preview,
            get_supported_extensions,
            is_supported_file,
            map_employee_columns,
            map_rating_columns,
            map_enps_columns,
            // Bulk import (test data)
            bulk_clear_data,
            bulk_import_review_cycles,
            bulk_import_employees,
            bulk_import_ratings,
            bulk_import_reviews,
            bulk_import_enps,
            verify_data_integrity
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize database asynchronously
            tauri::async_runtime::block_on(async move {
                match db::init_db(&handle).await {
                    Ok(pool) => {
                        // Store database pool in app state
                        handle.manage(Database::new(pool));
                        println!("Database initialized successfully");
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize database: {}", e);
                        // In production, we might want to show an error dialog
                        // For now, we'll let the app continue and handle errors gracefully
                    }
                }
            });

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
