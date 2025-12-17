// HR Command Center - Tauri Command Wrappers
// All Tauri invoke calls go through here for type safety

import { invoke } from '@tauri-apps/api/core';
import type { Employee, ReviewCycle, PerformanceRating, PerformanceReview, EnpsResponse, ParseResult, ParsePreview, ColumnMapping, Company, UpsertCompany, EmployeeStatesSummary } from './types';

/**
 * Test command - will be replaced with actual commands in Phase 1.4
 */
export async function greet(name: string): Promise<string> {
  return invoke('greet', { name });
}

// =============================================================================
// Phase 1.4 - API Key Management
// =============================================================================

/**
 * Store the Anthropic API key in macOS Keychain
 * @throws Error if key format is invalid or Keychain access fails
 */
export async function storeApiKey(apiKey: string): Promise<void> {
  return invoke('store_api_key', { apiKey });
}

/**
 * Check if an API key exists in the Keychain
 */
export async function hasApiKey(): Promise<boolean> {
  return invoke('has_api_key');
}

/**
 * Delete the API key from the Keychain
 */
export async function deleteApiKey(): Promise<void> {
  return invoke('delete_api_key');
}

/**
 * Validate API key format without storing it
 * Returns true if the key has the correct prefix and length
 */
export async function validateApiKeyFormat(apiKey: string): Promise<boolean> {
  return invoke('validate_api_key_format', { apiKey });
}

// =============================================================================
// Phase 1.4 - Chat Commands
// =============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  input_tokens: number;
  output_tokens: number;
}

/**
 * Send messages to Claude and get a response (non-streaming)
 * @param messages Array of conversation messages
 * @param systemPrompt Optional system prompt for context
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ChatResponse> {
  return invoke('send_chat_message', {
    messages,
    systemPrompt: systemPrompt ?? null
  });
}

/**
 * Send messages to Claude with streaming response
 * Listen for "chat-stream" events for response chunks
 * @param messages Array of conversation messages
 * @param systemPrompt Optional system prompt for context
 */
export async function sendChatMessageStreaming(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<void> {
  return invoke('send_chat_message_streaming', {
    messages,
    systemPrompt: systemPrompt ?? null
  });
}

/** Event payload for streaming chunks */
export interface StreamChunk {
  chunk: string;
  done: boolean;
}

// =============================================================================
// Phase 1.5 - Network Detection
// =============================================================================

/**
 * Network status result from the Rust backend
 */
export interface NetworkStatus {
  /** Whether the network is available */
  is_online: boolean;
  /** Whether the Anthropic API is specifically reachable */
  api_reachable: boolean;
  /** Optional error message if offline */
  error_message: string | null;
}

/**
 * Check network connectivity and Anthropic API availability
 * Returns detailed status including error messages
 */
export async function checkNetworkStatus(): Promise<NetworkStatus> {
  return invoke('check_network_status');
}

/**
 * Quick check if online (returns just a boolean)
 * Use for simple online/offline checks
 */
export async function isOnline(): Promise<boolean> {
  return invoke('is_online');
}

// =============================================================================
// Phase 2.2 - Company Profile
// =============================================================================

/**
 * Check if a company profile has been set up
 * Used to gate the app until company profile is configured
 */
export async function hasCompany(): Promise<boolean> {
  return invoke('has_company');
}

/**
 * Get the company profile
 * @throws Error if company profile doesn't exist
 */
export async function getCompany(): Promise<Company> {
  return invoke('get_company');
}

/**
 * Create or update the company profile (upsert)
 * @param input Company name, state (2-letter code), and optional industry
 */
export async function upsertCompany(input: UpsertCompany): Promise<Company> {
  return invoke('upsert_company', { input });
}

/**
 * Get summary of employee work states (operational footprint)
 * Derived from employees table, not company profile
 * Useful for understanding where employees are located
 */
export async function getEmployeeWorkStates(): Promise<EmployeeStatesSummary> {
  return invoke('get_employee_work_states');
}

// =============================================================================
// Phase 2.1 - Employee Management
// =============================================================================

/**
 * Input for creating a new employee
 */
export interface CreateEmployeeInput {
  email: string;
  full_name: string;
  department?: string;
  job_title?: string;
  manager_id?: string;
  hire_date?: string;
  work_state?: string;
  status?: 'active' | 'terminated' | 'leave';
  date_of_birth?: string;
  gender?: string;
  ethnicity?: string;
  termination_date?: string;
  termination_reason?: string;
  extra_fields?: string;
}

/**
 * Input for updating an employee (all fields optional)
 */
export interface UpdateEmployeeInput {
  email?: string;
  full_name?: string;
  department?: string;
  job_title?: string;
  manager_id?: string;
  hire_date?: string;
  work_state?: string;
  status?: 'active' | 'terminated' | 'leave';
  date_of_birth?: string;
  gender?: string;
  ethnicity?: string;
  termination_date?: string;
  termination_reason?: string;
  extra_fields?: string;
}

/**
 * Filter options for listing employees
 */
export interface EmployeeFilter {
  status?: 'active' | 'terminated' | 'leave';
  department?: string;
  work_state?: string;
  search?: string;
}

/**
 * Result from listing employees (includes pagination info)
 */
export interface EmployeeListResult {
  employees: Employee[];
  total: number;
}

/**
 * Result from bulk import operation
 */
export interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
}

/**
 * Create a new employee
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return invoke('create_employee', { input });
}

/**
 * Get an employee by ID
 */
export async function getEmployee(id: string): Promise<Employee> {
  return invoke('get_employee', { id });
}

/**
 * Get an employee by email
 */
export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  return invoke('get_employee_by_email', { email });
}

/**
 * Update an employee
 */
export async function updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
  return invoke('update_employee', { id, input });
}

/**
 * Delete an employee
 */
export async function deleteEmployee(id: string): Promise<void> {
  return invoke('delete_employee', { id });
}

/**
 * List employees with optional filtering and pagination
 * @param filter - Optional filter criteria
 * @param limit - Max results (default 100)
 * @param offset - Pagination offset (default 0)
 */
export async function listEmployees(
  filter: EmployeeFilter = {},
  limit?: number,
  offset?: number
): Promise<EmployeeListResult> {
  return invoke('list_employees', { filter, limit, offset });
}

/**
 * Get all unique departments
 */
export async function getDepartments(): Promise<string[]> {
  return invoke('get_departments');
}

/**
 * Get employee counts grouped by status
 * Returns array of [status, count] tuples
 */
export async function getEmployeeCounts(): Promise<[string, number][]> {
  return invoke('get_employee_counts');
}

/**
 * Bulk import employees (upsert by email)
 * Existing employees (matched by email) will be updated
 * New employees will be created
 */
export async function importEmployees(employees: CreateEmployeeInput[]): Promise<ImportResult> {
  return invoke('import_employees', { employees });
}

// =============================================================================
// Phase 2.1 - Review Cycles
// =============================================================================

/**
 * Input for creating a review cycle
 */
export interface CreateReviewCycleInput {
  name: string;
  cycle_type: 'annual' | 'semi-annual' | 'quarterly';
  start_date: string;
  end_date: string;
  status?: 'active' | 'closed';
}

/**
 * Input for updating a review cycle
 */
export interface UpdateReviewCycleInput {
  name?: string;
  cycle_type?: 'annual' | 'semi-annual' | 'quarterly';
  start_date?: string;
  end_date?: string;
  status?: 'active' | 'closed';
}

/**
 * Create a new review cycle
 */
export async function createReviewCycle(input: CreateReviewCycleInput): Promise<ReviewCycle> {
  return invoke('create_review_cycle', { input });
}

/**
 * Get a review cycle by ID
 */
export async function getReviewCycle(id: string): Promise<ReviewCycle> {
  return invoke('get_review_cycle', { id });
}

/**
 * Update a review cycle
 */
export async function updateReviewCycle(id: string, input: UpdateReviewCycleInput): Promise<ReviewCycle> {
  return invoke('update_review_cycle', { id, input });
}

/**
 * Delete a review cycle
 */
export async function deleteReviewCycle(id: string): Promise<void> {
  return invoke('delete_review_cycle', { id });
}

/**
 * List all review cycles, optionally filtered by status
 */
export async function listReviewCycles(statusFilter?: 'active' | 'closed'): Promise<ReviewCycle[]> {
  return invoke('list_review_cycles', { statusFilter });
}

/**
 * Get the current active review cycle (most recent by start_date)
 */
export async function getActiveReviewCycle(): Promise<ReviewCycle | null> {
  return invoke('get_active_review_cycle');
}

/**
 * Close a review cycle (convenience method)
 */
export async function closeReviewCycle(id: string): Promise<ReviewCycle> {
  return invoke('close_review_cycle', { id });
}

// =============================================================================
// Phase 2.1 - Performance Ratings
// =============================================================================

/**
 * Input for creating a performance rating
 */
export interface CreateRatingInput {
  employee_id: string;
  review_cycle_id: string;
  overall_rating: number; // 1.0 - 5.0
  goals_rating?: number;
  competencies_rating?: number;
  reviewer_id?: string;
  rating_date?: string;
}

/**
 * Input for updating a performance rating
 */
export interface UpdateRatingInput {
  overall_rating?: number;
  goals_rating?: number;
  competencies_rating?: number;
  reviewer_id?: string;
  rating_date?: string;
}

/**
 * Rating distribution for analytics
 */
export interface RatingDistribution {
  exceptional: number;    // 5.0
  exceeds: number;        // 4.0-4.9
  meets: number;          // 3.0-3.9
  developing: number;     // 2.0-2.9
  unsatisfactory: number; // 1.0-1.9
  total: number;
}

/**
 * Create a performance rating
 */
export async function createPerformanceRating(input: CreateRatingInput): Promise<PerformanceRating> {
  return invoke('create_performance_rating', { input });
}

/**
 * Get a rating by ID
 */
export async function getPerformanceRating(id: string): Promise<PerformanceRating> {
  return invoke('get_performance_rating', { id });
}

/**
 * Get all ratings for an employee (ordered by cycle date desc)
 */
export async function getRatingsForEmployee(employeeId: string): Promise<PerformanceRating[]> {
  return invoke('get_ratings_for_employee', { employeeId });
}

/**
 * Get all ratings for a review cycle
 */
export async function getRatingsForCycle(reviewCycleId: string): Promise<PerformanceRating[]> {
  return invoke('get_ratings_for_cycle', { reviewCycleId });
}

/**
 * Get the most recent rating for an employee
 */
export async function getLatestRating(employeeId: string): Promise<PerformanceRating | null> {
  return invoke('get_latest_rating', { employeeId });
}

/**
 * Update a performance rating
 */
export async function updatePerformanceRating(id: string, input: UpdateRatingInput): Promise<PerformanceRating> {
  return invoke('update_performance_rating', { id, input });
}

/**
 * Delete a performance rating
 */
export async function deletePerformanceRating(id: string): Promise<void> {
  return invoke('delete_performance_rating', { id });
}

/**
 * Get rating distribution for a cycle (for analytics)
 */
export async function getRatingDistribution(reviewCycleId: string): Promise<RatingDistribution> {
  return invoke('get_rating_distribution', { reviewCycleId });
}

/**
 * Get average rating for a cycle
 */
export async function getAverageRating(reviewCycleId: string): Promise<number | null> {
  return invoke('get_average_rating', { reviewCycleId });
}

// =============================================================================
// Phase 2.1 - Performance Reviews
// =============================================================================

/**
 * Get all performance reviews for an employee (ordered by cycle date desc)
 */
export async function getReviewsForEmployee(employeeId: string): Promise<PerformanceReview[]> {
  return invoke('get_reviews_for_employee', { employeeId });
}

// =============================================================================
// Phase 2.1 - eNPS Responses
// =============================================================================

/**
 * Get all eNPS responses for an employee (ordered by survey date desc)
 */
export async function getEnpsForEmployee(employeeId: string): Promise<EnpsResponse[]> {
  return invoke('get_enps_for_employee', { employeeId });
}

/**
 * Get the most recent eNPS response for an employee
 */
export async function getLatestEnpsForEmployee(employeeId: string): Promise<EnpsResponse | null> {
  return invoke('get_latest_enps_for_employee', { employeeId });
}

// =============================================================================
// Phase 2.3 - Context Builder
// =============================================================================

/**
 * Rating info for employee context
 */
export interface RatingInfo {
  cycle_name: string;
  overall_rating: number;
  rating_date: string | null;
}

/**
 * eNPS info for employee context
 */
export interface EnpsInfo {
  score: number;
  survey_name: string | null;
  survey_date: string;
  feedback: string | null;
}

/**
 * Full employee context including performance and eNPS data
 */
export interface EmployeeContext {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  job_title: string | null;
  hire_date: string | null;
  work_state: string | null;
  status: string;
  manager_name: string | null;

  // Performance data
  latest_rating: number | null;
  latest_rating_cycle: string | null;
  rating_trend: string | null; // "improving" | "stable" | "declining"
  all_ratings: RatingInfo[];

  // eNPS data
  latest_enps: number | null;
  latest_enps_date: string | null;
  enps_trend: string | null;
  all_enps: EnpsInfo[];
}

/**
 * Company context for system prompt
 */
export interface CompanyContext {
  name: string;
  state: string;
  industry: string | null;
  employee_count: number;
  department_count: number;
}

/**
 * Full chat context for building system prompt
 */
export interface ChatContext {
  company: CompanyContext | null;
  employees: EmployeeContext[];
  employee_ids_used: string[];
  memory_summaries: string[];
}

/**
 * Build chat context for a user message
 * Extracts mentions, finds relevant employees, and gathers company data
 * @param userMessage - The user's message to analyze
 */
export async function buildChatContext(userMessage: string): Promise<ChatContext> {
  return invoke('build_chat_context', { userMessage });
}

/**
 * Get the system prompt for a chat message
 * Returns the full system prompt and list of employee IDs used
 * @param userMessage - The user's message to analyze
 * @returns Tuple of [system_prompt, employee_ids_used]
 */
export async function getSystemPrompt(userMessage: string): Promise<[string, string[]]> {
  return invoke('get_system_prompt', { userMessage });
}

/**
 * Get full context for a specific employee
 * Useful for debugging or displaying employee details
 * @param employeeId - The employee ID
 */
export async function getEmployeeContext(employeeId: string): Promise<EmployeeContext> {
  return invoke('get_employee_context', { employeeId });
}

/**
 * Get company context (name, state, employee/department counts)
 */
export async function getCompanyContext(): Promise<CompanyContext | null> {
  return invoke('get_company_context');
}

// =============================================================================
// Commands to be implemented in later phases:
// =============================================================================

// Phase 2.4 - Memory
// export async function searchMemory(query: string): Promise<ConversationSummary[]>

// Phase 3.1 - PII Scanner
// export async function scanPII(text: string): Promise<PIIRedaction[]>

// =============================================================================
// Phase 2.1.B - File Parsing
// =============================================================================

/**
 * Parse a file (CSV, TSV, XLSX, XLS) and return all rows
 * @param data - Raw file bytes as Uint8Array
 * @param fileName - Original filename (used for format detection)
 */
export async function parseFile(data: Uint8Array, fileName: string): Promise<ParseResult> {
  return invoke('parse_file', { data: Array.from(data), fileName });
}

/**
 * Parse a file and return only a preview (first N rows)
 * Useful for showing users what they're importing before committing
 * @param data - Raw file bytes as Uint8Array
 * @param fileName - Original filename
 * @param previewRows - Number of rows to include (default: 5)
 */
export async function parseFilePreview(
  data: Uint8Array,
  fileName: string,
  previewRows?: number
): Promise<ParsePreview> {
  return invoke('parse_file_preview', { data: Array.from(data), fileName, previewRows });
}

/**
 * Get list of supported file extensions
 */
export async function getSupportedExtensions(): Promise<string[]> {
  return invoke('get_supported_extensions');
}

/**
 * Check if a file is supported for import
 */
export async function isSupportedFile(fileName: string): Promise<boolean> {
  return invoke('is_supported_file', { fileName });
}

/**
 * Map parsed headers to standard employee fields
 * Returns a mapping of standard field name -> parsed header name
 */
export async function mapEmployeeColumns(headers: string[]): Promise<ColumnMapping> {
  return invoke('map_employee_columns', { headers });
}

/**
 * Map parsed headers to performance rating fields
 */
export async function mapRatingColumns(headers: string[]): Promise<ColumnMapping> {
  return invoke('map_rating_columns', { headers });
}

/**
 * Map parsed headers to eNPS fields
 */
export async function mapEnpsColumns(headers: string[]): Promise<ColumnMapping> {
  return invoke('map_enps_columns', { headers });
}

/**
 * Helper to read a File object as Uint8Array for parsing
 */
export async function readFileAsBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

// =============================================================================
// Bulk Import Commands (Test Data)
// =============================================================================

/**
 * Result from bulk import operations
 */
export interface BulkImportResult {
  inserted: number;
  errors: string[];
}

/**
 * Result from data integrity verification
 */
export interface IntegrityCheckResult {
  check_name: string;
  passed: boolean;
  expected: number;
  actual: number;
  details: string | null;
}

/**
 * Employee import record (with explicit ID for FK preservation)
 * Note: Uses null union types to match JSON data from generators
 */
export interface ImportEmployee {
  id: string;
  email: string;
  full_name: string;
  department?: string | null;
  job_title?: string | null;
  manager_id?: string | null;
  hire_date?: string | null;
  work_state?: string | null;
  status?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  termination_date?: string | null;
  termination_reason?: string | null;
}

/**
 * Review cycle import record (with explicit ID)
 */
export interface ImportReviewCycle {
  id: string;
  name: string;
  cycle_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

/**
 * Performance rating import record (with explicit ID)
 */
export interface ImportRating {
  id: string;
  employee_id: string;
  review_cycle_id: string;
  reviewer_id?: string;
  overall_rating: number;
  goals_rating?: number;
  competency_rating?: number;
  submitted_at?: string;
}

/**
 * Performance review import record (with explicit ID)
 */
export interface ImportReview {
  id: string;
  employee_id: string;
  review_cycle_id: string;
  reviewer_id?: string;
  strengths?: string;
  areas_for_improvement?: string;
  accomplishments?: string;
  manager_comments?: string;
  submitted_at?: string;
}

/**
 * eNPS import record (with explicit ID)
 * Note: Uses null union types to match JSON data from generators
 */
export interface ImportEnps {
  id: string;
  employee_id: string;
  survey_date: string;
  survey_name: string;
  score: number;
  feedback_text?: string | null;
  submitted_at?: string | null;
}

/**
 * Clear all data from the database (for test data reset)
 */
export async function bulkClearData(): Promise<void> {
  return invoke('bulk_clear_data');
}

/**
 * Bulk import review cycles with predefined IDs
 */
export async function bulkImportReviewCycles(cycles: ImportReviewCycle[]): Promise<BulkImportResult> {
  return invoke('bulk_import_review_cycles', { cycles });
}

/**
 * Bulk import employees with predefined IDs
 */
export async function bulkImportEmployees(employees: ImportEmployee[]): Promise<BulkImportResult> {
  return invoke('bulk_import_employees', { employees });
}

/**
 * Bulk import performance ratings with predefined IDs
 */
export async function bulkImportRatings(ratings: ImportRating[]): Promise<BulkImportResult> {
  return invoke('bulk_import_ratings', { ratings });
}

/**
 * Bulk import performance reviews with predefined IDs
 */
export async function bulkImportReviews(reviews: ImportReview[]): Promise<BulkImportResult> {
  return invoke('bulk_import_reviews', { reviews });
}

/**
 * Bulk import eNPS responses with predefined IDs
 */
export async function bulkImportEnps(responses: ImportEnps[]): Promise<BulkImportResult> {
  return invoke('bulk_import_enps', { responses });
}

/**
 * Verify data integrity after import
 */
export async function verifyDataIntegrity(): Promise<IntegrityCheckResult[]> {
  return invoke('verify_data_integrity');
}
