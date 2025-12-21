// API Key Error Hints
// Maps validation failures to user-friendly guidance for non-technical users

export type ApiKeyErrorType =
  | 'empty'
  | 'wrong_prefix'
  | 'missing_prefix'
  | 'too_short'
  | 'storage_failure';

/**
 * Returns a user-friendly hint based on the API key format.
 * Returns null if the key appears valid or is empty.
 */
export function getApiKeyErrorHint(key: string): string | null {
  if (!key) {
    return null;
  }

  // Check for common OpenAI key format (starts with sk- but not sk-ant-)
  if (key.startsWith('sk-') && !key.startsWith('sk-ant-')) {
    return "This looks like an OpenAI key (starts with 'sk-'). You need an Anthropic key — it starts with 'sk-ant-'";
  }

  // Check for missing Anthropic prefix
  if (!key.startsWith('sk-ant-')) {
    return "Make sure you copied the full key — it should start with 'sk-ant-'";
  }

  // Check for incomplete key (too short)
  if (key.length < 40) {
    return 'This key seems incomplete. Anthropic keys are usually longer. Did you copy the whole thing?';
  }

  // Key appears valid
  return null;
}

/**
 * Returns a user-friendly message for storage/backend errors.
 */
export function getStorageErrorMessage(error: string): string {
  if (error.includes('permission') || error.includes('access')) {
    return 'Could not save your API key. Please check that the app has permission to store data.';
  }

  if (error.includes('storage') || error.includes('write')) {
    return 'Could not save your API key. There may be a problem with your disk or storage.';
  }

  return 'Failed to save API key. Please try again.';
}
