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
 * Send messages to Claude and get a response
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

// =============================================================================
// Commands to be implemented in later phases:
// =============================================================================

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
