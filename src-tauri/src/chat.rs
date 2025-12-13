// HR Command Center - Claude API Integration
// Handles communication with the Anthropic Messages API

use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::keyring;

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MODEL: &str = "claude-sonnet-4-20250514";
const MAX_TOKENS: u32 = 4096;

#[derive(Error, Debug)]
pub enum ChatError {
    #[error("API key not configured")]
    NoApiKey,
    #[error("Failed to access API key: {0}")]
    KeyringError(String),
    #[error("API request failed: {0}")]
    RequestError(String),
    #[error("API returned error: {0}")]
    ApiError(String),
    #[error("Failed to parse response: {0}")]
    ParseError(String),
}

impl From<keyring::KeyringError> for ChatError {
    fn from(err: keyring::KeyringError) -> Self {
        match err {
            keyring::KeyringError::NotFound => ChatError::NoApiKey,
            other => ChatError::KeyringError(other.to_string()),
        }
    }
}

impl From<reqwest::Error> for ChatError {
    fn from(err: reqwest::Error) -> Self {
        ChatError::RequestError(err.to_string())
    }
}

// Make ChatError serializable for Tauri commands
impl serde::Serialize for ChatError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// ============================================================================
// Request/Response Types (Anthropic Messages API)
// ============================================================================

#[derive(Debug, Serialize)]
pub struct MessageRequest {
    pub model: String,
    pub max_tokens: u32,
    pub messages: Vec<Message>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct MessageResponse {
    pub id: String,
    pub content: Vec<ContentBlock>,
    pub model: String,
    pub stop_reason: Option<String>,
    pub usage: Usage,
}

#[derive(Debug, Deserialize)]
pub struct ContentBlock {
    #[serde(rename = "type")]
    pub content_type: String,
    pub text: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

#[derive(Debug, Deserialize)]
pub struct ApiErrorResponse {
    #[serde(rename = "type")]
    pub error_type: String,
    pub error: ApiErrorDetail,
}

#[derive(Debug, Deserialize)]
pub struct ApiErrorDetail {
    #[serde(rename = "type")]
    pub error_type: String,
    pub message: String,
}

// ============================================================================
// Simplified types for frontend communication
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub content: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
}

// ============================================================================
// API Client
// ============================================================================

/// Send a message to Claude and get a response (non-streaming)
pub async fn send_message(
    messages: Vec<ChatMessage>,
    system_prompt: Option<String>,
) -> Result<ChatResponse, ChatError> {
    // Get API key from Keychain
    let api_key = keyring::get_api_key()?;

    // Build the request
    let request = MessageRequest {
        model: MODEL.to_string(),
        max_tokens: MAX_TOKENS,
        messages: messages
            .into_iter()
            .map(|m| Message {
                role: m.role,
                content: m.content,
            })
            .collect(),
        system: system_prompt,
    };

    // Create HTTP client and send request
    let client = Client::new();
    let response = client
        .post(ANTHROPIC_API_URL)
        .header("x-api-key", &api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await?;

    // Check for HTTP errors
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();

        // Try to parse as API error
        if let Ok(api_error) = serde_json::from_str::<ApiErrorResponse>(&error_text) {
            return Err(ChatError::ApiError(format!(
                "{}: {}",
                api_error.error.error_type, api_error.error.message
            )));
        }

        return Err(ChatError::ApiError(format!(
            "HTTP {}: {}",
            status.as_u16(),
            error_text
        )));
    }

    // Parse successful response
    let api_response: MessageResponse = response
        .json()
        .await
        .map_err(|e| ChatError::ParseError(e.to_string()))?;

    // Extract text content from response
    let content = api_response
        .content
        .iter()
        .filter_map(|block| {
            if block.content_type == "text" {
                block.text.clone()
            } else {
                None
            }
        })
        .collect::<Vec<_>>()
        .join("");

    Ok(ChatResponse {
        content,
        input_tokens: api_response.usage.input_tokens,
        output_tokens: api_response.usage.output_tokens,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_serialization() {
        let msg = ChatMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("user"));
        assert!(json.contains("Hello"));
    }
}
