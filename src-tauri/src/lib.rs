// HR Command Center - Rust Backend
// This file contains the core library code for Tauri commands

use tauri::Manager;

mod chat;
mod db;
mod keyring;
mod network;

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
            is_online
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
