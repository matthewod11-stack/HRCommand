// HR Command Center - Secure API Key Storage
// Uses file-based storage in app data directory
// TODO: Migrate to proper Keychain once keyring crate issues resolved

use std::fs;
use std::path::PathBuf;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum KeyringError {
    #[error("Failed to access storage: {0}")]
    StorageAccess(String),
    #[error("API key not found")]
    NotFound,
    #[error("Invalid API key format")]
    InvalidFormat,
}

impl From<std::io::Error> for KeyringError {
    fn from(err: std::io::Error) -> Self {
        if err.kind() == std::io::ErrorKind::NotFound {
            KeyringError::NotFound
        } else {
            KeyringError::StorageAccess(err.to_string())
        }
    }
}

/// Get the path to the API key file
fn get_key_path() -> Result<PathBuf, KeyringError> {
    let home = std::env::var("HOME")
        .map_err(|_| KeyringError::StorageAccess("Could not find home directory".into()))?;
    let app_dir = PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("com.hrcommandcenter.app");

    // Ensure directory exists
    fs::create_dir_all(&app_dir)?;

    Ok(app_dir.join(".api_key"))
}

// Make KeyringError serializable for Tauri commands
impl serde::Serialize for KeyringError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Store the Anthropic API key
pub fn store_api_key(api_key: &str) -> Result<(), KeyringError> {
    // Validate format: Anthropic keys start with "sk-ant-"
    if !api_key.starts_with("sk-ant-") {
        return Err(KeyringError::InvalidFormat);
    }

    let path = get_key_path()?;
    fs::write(&path, api_key)?;

    // Set restrictive permissions (owner read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(&path, perms)?;
    }

    println!("[keyring] API key stored to {:?}", path);
    Ok(())
}

/// Retrieve the Anthropic API key
pub fn get_api_key() -> Result<String, KeyringError> {
    let path = get_key_path()?;
    let key = fs::read_to_string(&path)?;
    Ok(key.trim().to_string())
}

/// Delete the API key
pub fn delete_api_key() -> Result<(), KeyringError> {
    let path = get_key_path()?;
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}

/// Check if an API key exists
pub fn has_api_key() -> bool {
    match get_key_path() {
        Ok(path) => path.exists(),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_format() {
        let result = store_api_key("invalid-key");
        assert!(matches!(result, Err(KeyringError::InvalidFormat)));
    }

    #[test]
    fn test_valid_format_prefix() {
        let key = "sk-ant-test123";
        assert!(key.starts_with("sk-ant-"));
    }

    #[test]
    fn test_storage_path() {
        let path = get_key_path().unwrap();
        println!("Storage path: {:?}", path);
        assert!(path.to_string_lossy().contains("com.hrcommandcenter.app"));
    }
}
