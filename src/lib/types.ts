// HR Command Center - Type Definitions
// These types mirror the SQLite schema and API responses

// =============================================================================
// Database Models
// =============================================================================

export interface Employee {
  id: string;
  email: string;
  full_name: string;
  department?: string;
  job_title?: string;
  manager_id?: string;
  hire_date?: string;
  work_state?: string;
  status: 'active' | 'terminated' | 'leave';
  extra_fields?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title?: string;
  summary?: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Company {
  id: string;
  name: string;
  state: string;
  industry?: string;
  created_at: string;
}

export interface Settings {
  key: string;
  value: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  conversation_id?: string;
  request_redacted: string;
  response_text: string;
  context_used?: string[];
  created_at: string;
}

// =============================================================================
// Application State
// =============================================================================

export interface AppState {
  isOnline: boolean;
  hasApiKey: boolean;
  hasCompanyProfile: boolean;
  isOnboarded: boolean;
}

// =============================================================================
// PII Redaction
// =============================================================================

export type PIIType = 'SSN' | 'CreditCard' | 'BankAccount';

export interface PIIRedaction {
  type: PIIType;
  original: string;
  placeholder: string;
}

// =============================================================================
// API Responses
// =============================================================================

export interface ChatResponse {
  message: string;
  redactions?: PIIRedaction[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
