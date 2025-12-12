// HR Command Center - Rust Backend
// This file contains the core library code for Tauri commands

use tauri::Manager;

mod db;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet, check_db])
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
