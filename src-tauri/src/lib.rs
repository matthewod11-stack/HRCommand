// HR Command Center - Rust Backend
// This file contains the core library code for Tauri commands

use tauri::Manager;

/// Greet command for testing - will be replaced with actual commands
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to HR Command Center.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
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
