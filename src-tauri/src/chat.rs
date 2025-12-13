// HR Command Center - Claude API Integration
// Handles communication with the Anthropic Messages API

use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
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
// Streaming Event Types (SSE)
// ============================================================================

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "message_start")]
    MessageStart { message: StreamMessageStart },
    #[serde(rename = "content_block_start")]
    ContentBlockStart { index: u32, content_block: ContentBlock },
    #[serde(rename = "content_block_delta")]
    ContentBlockDelta { index: u32, delta: TextDelta },
    #[serde(rename = "content_block_stop")]
    ContentBlockStop { index: u32 },
    #[serde(rename = "message_delta")]
    MessageDelta { delta: MessageDeltaData, usage: Option<UsageDelta> },
    #[serde(rename = "message_stop")]
    MessageStop,
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "error")]
    Error { error: ApiErrorDetail },
}

#[derive(Debug, Deserialize)]
pub struct StreamMessageStart {
    pub id: String,
    pub model: String,
}

#[derive(Debug, Deserialize)]
pub struct TextDelta {
    #[serde(rename = "type")]
    pub delta_type: String,
    #[serde(default)]
    pub text: String,
}

#[derive(Debug, Deserialize)]
pub struct MessageDeltaData {
    pub stop_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UsageDelta {
    pub output_tokens: u32,
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

/// Event emitted to frontend during streaming
#[derive(Debug, Clone, Serialize)]
pub struct StreamChunk {
    pub chunk: String,
    pub done: bool,
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
        stream: None,
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

/// Send a message to Claude with streaming response
/// Emits "chat-stream" events to the frontend as chunks arrive
pub async fn send_message_streaming(
    app: AppHandle,
    messages: Vec<ChatMessage>,
    system_prompt: Option<String>,
) -> Result<(), ChatError> {
    // Get API key
    let api_key = keyring::get_api_key()?;

    // Build the request with streaming enabled
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
        stream: Some(true),
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
        if let Ok(api_error) = serde_json::from_str::<ApiErrorResponse>(&error_text) {
            return Err(ChatError::ApiError(format!(
                "{}: {}",
                api_error.error.error_type, api_error.error.message
            )));
        }
        return Err(ChatError::ApiError(format!("HTTP {}: {}", status.as_u16(), error_text)));
    }

    // Process SSE stream
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| ChatError::RequestError(e.to_string()))?;
        let chunk_str = String::from_utf8_lossy(&chunk);
        buffer.push_str(&chunk_str);

        // Process complete SSE events (lines ending with \n\n)
        while let Some(pos) = buffer.find("\n\n") {
            let event_data = buffer[..pos].to_string();
            buffer = buffer[pos + 2..].to_string();

            // Parse SSE event
            for line in event_data.lines() {
                if let Some(data) = line.strip_prefix("data: ") {
                    if let Ok(event) = serde_json::from_str::<StreamEvent>(data) {
                        match event {
                            StreamEvent::ContentBlockDelta { delta, .. } => {
                                // Emit text chunk to frontend
                                let _ = app.emit("chat-stream", StreamChunk {
                                    chunk: delta.text,
                                    done: false,
                                });
                            }
                            StreamEvent::MessageStop => {
                                // Signal completion
                                let _ = app.emit("chat-stream", StreamChunk {
                                    chunk: String::new(),
                                    done: true,
                                });
                            }
                            StreamEvent::Error { error } => {
                                return Err(ChatError::ApiError(error.message));
                            }
                            _ => {} // Ignore other events
                        }
                    }
                }
            }
        }
    }

    Ok(())
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
