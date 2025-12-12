// HR Command Center - Tauri Command Wrappers
// All Tauri invoke calls go through here for type safety

import { invoke } from '@tauri-apps/api/core';

/**
 * Test command - will be replaced with actual commands in Phase 1.4
 */
export async function greet(name: string): Promise<string> {
  return invoke('greet', { name });
}

// =============================================================================
// Commands to be implemented in later phases:
// =============================================================================

// Phase 1.4 - Claude API Integration
// export async function sendMessage(message: string): Promise<ChatResponse>
// export async function validateApiKey(key: string): Promise<ValidationResult>
// export async function storeApiKey(key: string): Promise<void>

// Phase 1.5 - Network Detection
// export async function checkNetwork(): Promise<boolean>

// Phase 2.1 - Employee Data
// export async function getEmployees(): Promise<Employee[]>
// export async function importCSV(data: string): Promise<ImportResult>

// Phase 2.2 - Company Profile
// export async function getCompany(): Promise<Company | null>
// export async function saveCompany(company: Company): Promise<void>

// Phase 2.3 - Context Builder
// export async function buildContext(query: string): Promise<ContextPayload>

// Phase 2.4 - Memory
// export async function searchMemory(query: string): Promise<ConversationSummary[]>

// Phase 3.1 - PII Scanner
// export async function scanPII(text: string): Promise<PIIRedaction[]>
