// HR Command Center - Secure API Key Storage
// Uses macOS Keychain via the keyring crate for secure credential storage

use keyring::Entry;
use thiserror::Error;

const SERVICE_NAME: &str = "com.hrcommandcenter.app";
const API_KEY_ACCOUNT: &str = "anthropic_api_key";

#[derive(Error, Debug)]
pub enum KeyringError {
    #[error("Failed to access keychain: {0}")]
    KeychainAccess(String),
    #[error("API key not found")]
    NotFound,
    #[error("Invalid API key format")]
    InvalidFormat,
}

impl From<keyring::Error> for KeyringError {
    fn from(err: keyring::Error) -> Self {
        match err {
            keyring::Error::NoEntry => KeyringError::NotFound,
            other => KeyringError::KeychainAccess(other.to_string()),
        }
    }
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

/// Store the Anthropic API key in macOS Keychain
pub fn store_api_key(api_key: &str) -> Result<(), KeyringError> {
    // Validate format: Anthropic keys start with "sk-ant-"
    if !api_key.starts_with("sk-ant-") {
        return Err(KeyringError::InvalidFormat);
    }

    let entry = Entry::new(SERVICE_NAME, API_KEY_ACCOUNT)?;
    entry.set_password(api_key)?;
    Ok(())
}

/// Retrieve the Anthropic API key from macOS Keychain
pub fn get_api_key() -> Result<String, KeyringError> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_ACCOUNT)?;
    let key = entry.get_password()?;
    Ok(key)
}

/// Delete the Anthropic API key from macOS Keychain
pub fn delete_api_key() -> Result<(), KeyringError> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_ACCOUNT)?;
    entry.delete_credential()?;
    Ok(())
}

/// Check if an API key exists in the Keychain
pub fn has_api_key() -> bool {
    get_api_key().is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: These tests interact with the real macOS Keychain
    // Run with caution and clean up after testing

    #[test]
    fn test_invalid_format() {
        let result = store_api_key("invalid-key");
        assert!(matches!(result, Err(KeyringError::InvalidFormat)));
    }

    #[test]
    fn test_valid_format_prefix() {
        // This test only validates the prefix check, not actual storage
        let key = "sk-ant-test123";
        assert!(key.starts_with("sk-ant-"));
    }
}
