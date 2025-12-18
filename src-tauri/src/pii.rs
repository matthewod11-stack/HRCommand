// HR Command Center - PII Scanner Module
// Detects and redacts sensitive financial information before sending to Claude API
//
// Scope (V1): Financial PII only
// - Social Security Numbers (SSN)
// - Credit Card Numbers
// - Bank Account Numbers (with context keywords)
//
// Design: Auto-redact and notify (no blocking modals)

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use thiserror::Error;

// ============================================================================
// Error Types
// ============================================================================

#[derive(Debug, Error, Serialize, Deserialize)]
pub enum PiiError {
    #[error("Regex compilation failed: {0}")]
    RegexError(String),

    #[error("Scan failed: {0}")]
    ScanError(String),
}

// ============================================================================
// PII Types and Structures
// ============================================================================

/// Types of PII that can be detected
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PiiType {
    /// Social Security Number (XXX-XX-XXXX or XXXXXXXXX)
    Ssn,
    /// Credit Card Number (various formats)
    CreditCard,
    /// Bank Account Number (requires context keywords)
    BankAccount,
}

impl PiiType {
    /// Get the redaction placeholder for this PII type
    pub fn placeholder(&self) -> &'static str {
        match self {
            PiiType::Ssn => "[SSN_REDACTED]",
            PiiType::CreditCard => "[CC_REDACTED]",
            PiiType::BankAccount => "[BANK_ACCT_REDACTED]",
        }
    }

    /// Get a human-readable label for this PII type
    pub fn label(&self) -> &'static str {
        match self {
            PiiType::Ssn => "Social Security Number",
            PiiType::CreditCard => "Credit Card Number",
            PiiType::BankAccount => "Bank Account Number",
        }
    }
}

/// A single PII match found in text
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PiiMatch {
    /// Type of PII detected
    pub pii_type: PiiType,

    /// Start position in original text (byte offset)
    pub start: usize,

    /// End position in original text (byte offset)
    pub end: usize,

    /// The matched text (for audit logging, will be stored securely)
    /// Note: This is included for audit purposes but should be handled carefully
    #[serde(skip_serializing)]
    pub matched_text: String,
}

/// Result of scanning and redacting text
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionResult {
    /// The text with PII replaced by placeholders
    pub redacted_text: String,

    /// List of PII matches found (without the actual matched text in serialization)
    pub matches: Vec<PiiMatch>,

    /// Whether any PII was found and redacted
    pub had_pii: bool,

    /// Summary of what was redacted (for notification display)
    pub summary: Option<String>,
}

// ============================================================================
// Compiled Regex Patterns (Lazy Static)
// ============================================================================

// SSN patterns:
// - XXX-XX-XXXX (with dashes)
// - XXX XX XXXX (with spaces)
// - XXXXXXXXX (9 consecutive digits)
// Note: Rust regex doesn't support look-around, so we use word boundaries
static SSN_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    // Simple pattern without extended mode to avoid whitespace issues
    Regex::new(r"\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b|\b[0-9]{3}\s[0-9]{2}\s[0-9]{4}\b|\b[0-9]{9}\b")
        .expect("SSN regex should compile")
});

// Credit card patterns:
// - Visa: 4XXX XXXX XXXX XXXX (16 digits starting with 4)
// - MasterCard: 5[1-5]XX or 2[2-7]XX (16 digits)
// - Amex: 3[47]XX XXXXXX XXXXX (15 digits)
// - Discover: 6011, 65, 644-649 (16 digits)
// Supports spaces, dashes, or no separators
static CREDIT_CARD_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?x)
        \b
        (?:
            # Visa: starts with 4, 16 digits
            4[0-9]{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}
            |
            # MasterCard: starts with 51-55 or 2221-2720, 16 digits
            (?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}
            |
            # Amex: starts with 34 or 37, 15 digits
            3[47][0-9]{2}[\s\-]?[0-9]{6}[\s\-]?[0-9]{5}
            |
            # Discover: starts with 6011, 65, or 644-649, 16 digits
            (?:6011|65[0-9]{2}|64[4-9][0-9])[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}
        )
        \b
        ",
    )
    .expect("Credit card regex should compile")
});

// Bank account context keywords (case-insensitive matching done separately)
static BANK_CONTEXT_KEYWORDS: &[&str] = &[
    "account",
    "acct",
    "routing",
    "aba",
    "bank",
    "checking",
    "savings",
    "direct deposit",
    "wire",
    "transfer",
];

// Bank account number pattern (requires context)
// Typically 8-17 digits, but we look for 8-12 as most common
// Must appear near a context keyword
static BANK_ACCOUNT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b[0-9]{8,17}\b").expect("Bank account regex should compile")
});

// Routing number pattern (9 digits, specific format)
// ABA routing numbers have a checksum, but we'll be lenient
static ROUTING_NUMBER_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\b[0-9]{9}\b").expect("Routing number regex should compile")
});

// ============================================================================
// Detection Functions
// ============================================================================

/// Detect SSN patterns in text
pub fn detect_ssn(text: &str) -> Vec<PiiMatch> {
    SSN_PATTERN
        .find_iter(text)
        .filter(|m| is_valid_ssn(m.as_str()))
        .map(|m| PiiMatch {
            pii_type: PiiType::Ssn,
            start: m.start(),
            end: m.end(),
            matched_text: m.as_str().to_string(),
        })
        .collect()
}

/// Validate SSN format (permissive validation for PII detection)
/// For a PII scanner, we want to catch anything that LOOKS like an SSN,
/// even if it might not be a technically valid SSN according to SSA rules.
/// We only reject obviously impossible patterns:
/// - Area number (first 3 digits) of 000
/// - Group number (middle 2 digits) of 00
/// - Serial number (last 4 digits) of 0000
/// Note: We intentionally DO NOT reject 666 or 900-999 area codes
/// because those could still be typos or test data that should be redacted.
fn is_valid_ssn(ssn: &str) -> bool {
    // Remove separators to get just digits
    let digits: String = ssn.chars().filter(|c| c.is_ascii_digit()).collect();

    if digits.len() != 9 {
        return false;
    }

    let area: u32 = digits[0..3].parse().unwrap_or(0);
    let group: u32 = digits[3..5].parse().unwrap_or(0);
    let serial: u32 = digits[5..9].parse().unwrap_or(0);

    // Only reject obviously impossible patterns (all zeros in any section)
    // We're permissive because we'd rather over-detect than miss real PII
    if area == 0 {
        return false;
    }

    // Invalid group number
    if group == 0 {
        return false;
    }

    // Invalid serial number
    if serial == 0 {
        return false;
    }

    true
}

/// Detect credit card patterns in text
pub fn detect_credit_cards(text: &str) -> Vec<PiiMatch> {
    CREDIT_CARD_PATTERN
        .find_iter(text)
        .filter(|m| is_valid_credit_card(m.as_str()))
        .map(|m| PiiMatch {
            pii_type: PiiType::CreditCard,
            start: m.start(),
            end: m.end(),
            matched_text: m.as_str().to_string(),
        })
        .collect()
}

/// Validate credit card using Luhn algorithm
fn is_valid_credit_card(cc: &str) -> bool {
    // Remove separators to get just digits
    let digits: Vec<u32> = cc
        .chars()
        .filter(|c| c.is_ascii_digit())
        .filter_map(|c| c.to_digit(10))
        .collect();

    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }

    // Luhn algorithm
    let mut sum = 0;
    let mut alternate = false;

    for &digit in digits.iter().rev() {
        let mut d = digit;
        if alternate {
            d *= 2;
            if d > 9 {
                d -= 9;
            }
        }
        sum += d;
        alternate = !alternate;
    }

    sum % 10 == 0
}

/// Detect bank account numbers in text (requires context keywords nearby)
pub fn detect_bank_accounts(text: &str) -> Vec<PiiMatch> {
    let text_lower = text.to_lowercase();
    let mut matches = Vec::new();

    // Check if text contains bank-related context
    let has_bank_context = BANK_CONTEXT_KEYWORDS
        .iter()
        .any(|keyword| text_lower.contains(keyword));

    if !has_bank_context {
        return matches;
    }

    // Find potential account numbers
    for m in BANK_ACCOUNT_PATTERN.find_iter(text) {
        let matched = m.as_str();

        // Skip if it looks like an SSN (9 digits that could be SSN)
        if matched.len() == 9 && is_valid_ssn(matched) {
            continue;
        }

        // Check if there's a bank keyword within 50 characters
        let context_start = m.start().saturating_sub(50);
        let context_end = (m.end() + 50).min(text.len());
        let context = &text_lower[context_start..context_end];

        let near_keyword = BANK_CONTEXT_KEYWORDS
            .iter()
            .any(|keyword| context.contains(keyword));

        if near_keyword {
            matches.push(PiiMatch {
                pii_type: PiiType::BankAccount,
                start: m.start(),
                end: m.end(),
                matched_text: matched.to_string(),
            });
        }
    }

    // Also check for routing numbers near bank context
    for m in ROUTING_NUMBER_PATTERN.find_iter(text) {
        let matched = m.as_str();

        // Skip if already detected as SSN
        if is_valid_ssn(matched) {
            continue;
        }

        // Check for "routing" keyword specifically
        let context_start = m.start().saturating_sub(30);
        let context_end = (m.end() + 30).min(text.len());
        let context = &text_lower[context_start..context_end];

        if context.contains("routing") || context.contains("aba") {
            // Avoid duplicates
            if !matches.iter().any(|existing| existing.start == m.start()) {
                matches.push(PiiMatch {
                    pii_type: PiiType::BankAccount,
                    start: m.start(),
                    end: m.end(),
                    matched_text: matched.to_string(),
                });
            }
        }
    }

    matches
}

// ============================================================================
// Main Scanning and Redaction
// ============================================================================

/// Scan text for all types of PII
pub fn scan_for_pii(text: &str) -> Vec<PiiMatch> {
    let mut all_matches = Vec::new();

    // Detect each PII type
    all_matches.extend(detect_ssn(text));
    all_matches.extend(detect_credit_cards(text));
    all_matches.extend(detect_bank_accounts(text));

    // Sort by position (start offset)
    all_matches.sort_by_key(|m| m.start);

    // Remove overlapping matches (keep the first one)
    let mut filtered_matches = Vec::new();
    let mut last_end = 0;

    for m in all_matches {
        if m.start >= last_end {
            last_end = m.end;
            filtered_matches.push(m);
        }
    }

    filtered_matches
}

/// Scan text and redact any PII found
pub fn scan_and_redact(text: &str) -> RedactionResult {
    let matches = scan_for_pii(text);

    if matches.is_empty() {
        return RedactionResult {
            redacted_text: text.to_string(),
            matches: Vec::new(),
            had_pii: false,
            summary: None,
        };
    }

    // Build redacted text by replacing matches
    let mut redacted = String::with_capacity(text.len());
    let mut last_end = 0;

    for m in &matches {
        // Add text before this match
        redacted.push_str(&text[last_end..m.start]);
        // Add placeholder
        redacted.push_str(m.pii_type.placeholder());
        last_end = m.end;
    }

    // Add remaining text
    redacted.push_str(&text[last_end..]);

    // Build summary
    let summary = build_redaction_summary(&matches);

    RedactionResult {
        redacted_text: redacted,
        matches,
        had_pii: true,
        summary: Some(summary),
    }
}

/// Build a human-readable summary of what was redacted
fn build_redaction_summary(matches: &[PiiMatch]) -> String {
    let mut ssn_count = 0;
    let mut cc_count = 0;
    let mut bank_count = 0;

    for m in matches {
        match m.pii_type {
            PiiType::Ssn => ssn_count += 1,
            PiiType::CreditCard => cc_count += 1,
            PiiType::BankAccount => bank_count += 1,
        }
    }

    let mut parts = Vec::new();

    if ssn_count > 0 {
        parts.push(format!(
            "{} SSN{}",
            ssn_count,
            if ssn_count > 1 { "s" } else { "" }
        ));
    }
    if cc_count > 0 {
        parts.push(format!(
            "{} credit card{}",
            cc_count,
            if cc_count > 1 { "s" } else { "" }
        ));
    }
    if bank_count > 0 {
        parts.push(format!(
            "{} bank account{}",
            bank_count,
            if bank_count > 1 { "s" } else { "" }
        ));
    }

    format!("Redacted: {}", parts.join(", "))
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // SSN Detection Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_detect_ssn_with_dashes() {
        let text = "My SSN is 123-45-6789.";
        let matches = detect_ssn(text);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pii_type, PiiType::Ssn);
        assert_eq!(matches[0].matched_text, "123-45-6789");
    }

    #[test]
    fn test_detect_ssn_with_spaces() {
        let text = "SSN: 123 45 6789";
        let matches = detect_ssn(text);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].matched_text, "123 45 6789");
    }

    #[test]
    fn test_detect_ssn_no_separators() {
        let text = "Social security number: 123456789";
        let matches = detect_ssn(text);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].matched_text, "123456789");
    }

    #[test]
    fn test_detect_ssn_invalid_area_000() {
        let text = "Invalid SSN: 000-12-3456";
        let matches = detect_ssn(text);
        assert_eq!(matches.len(), 0, "SSN with area 000 should be invalid");
    }

    #[test]
    fn test_detect_ssn_area_666_is_detected() {
        // For PII detection, we detect 666 area codes (historically invalid but should still be redacted)
        let text = "SSN: 666-12-3456";
        let matches = detect_ssn(text);
        assert_eq!(matches.len(), 1, "SSN with area 666 should be detected for redaction");
    }

    #[test]
    fn test_detect_ssn_area_900_is_detected() {
        // For PII detection, we detect 900+ area codes (reserved but should still be redacted)
        let text = "SSN: 900-12-3456";
        let matches = detect_ssn(text);
        assert_eq!(matches.len(), 1, "SSN with area 900+ should be detected for redaction");
    }

    #[test]
    fn test_detect_ssn_invalid_group_00() {
        let text = "Invalid SSN: 123-00-4567";
        let matches = detect_ssn(text);
        assert_eq!(matches.len(), 0, "SSN with group 00 should be invalid");
    }

    #[test]
    fn test_detect_ssn_invalid_serial_0000() {
        let text = "Invalid SSN: 123-45-0000";
        let matches = detect_ssn(text);
        assert_eq!(matches.len(), 0, "SSN with serial 0000 should be invalid");
    }

    #[test]
    fn test_detect_multiple_ssns() {
        let text = "SSNs: 123-45-6789 and 987-65-4321";
        let matches = detect_ssn(text);
        assert_eq!(matches.len(), 2);
    }

    // -------------------------------------------------------------------------
    // Credit Card Detection Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_detect_visa_with_spaces() {
        let text = "Card: 4111 1111 1111 1111";
        let matches = detect_credit_cards(text);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pii_type, PiiType::CreditCard);
    }

    #[test]
    fn test_detect_visa_with_dashes() {
        let text = "Card: 4111-1111-1111-1111";
        let matches = detect_credit_cards(text);
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn test_detect_visa_no_separators() {
        let text = "Card: 4111111111111111";
        let matches = detect_credit_cards(text);
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn test_detect_mastercard() {
        let text = "Card: 5500 0000 0000 0004";
        let matches = detect_credit_cards(text);
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn test_detect_amex() {
        // Amex has 15 digits with different grouping
        let text = "Card: 3782 822463 10005";
        let matches = detect_credit_cards(text);
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn test_detect_discover() {
        let text = "Card: 6011 1111 1111 1117";
        let matches = detect_credit_cards(text);
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn test_detect_invalid_cc_luhn() {
        // This is NOT a valid credit card (fails Luhn)
        let text = "Card: 4111 1111 1111 1112";
        let matches = detect_credit_cards(text);
        assert_eq!(matches.len(), 0, "Invalid Luhn checksum should not match");
    }

    // -------------------------------------------------------------------------
    // Bank Account Detection Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_detect_bank_account_with_keyword() {
        let text = "My bank account number is 12345678901234";
        let matches = detect_bank_accounts(text);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pii_type, PiiType::BankAccount);
    }

    #[test]
    fn test_detect_routing_number() {
        let text = "Routing number: 021000021";
        let matches = detect_bank_accounts(text);
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn test_no_bank_account_without_context() {
        // Just a number without bank context should not match
        let text = "The total is 12345678901234";
        let matches = detect_bank_accounts(text);
        assert_eq!(matches.len(), 0);
    }

    #[test]
    fn test_detect_checking_account() {
        let text = "Checking account: 9876543210";
        let matches = detect_bank_accounts(text);
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn test_detect_direct_deposit() {
        let text = "For direct deposit, use account 12345678";
        let matches = detect_bank_accounts(text);
        assert_eq!(matches.len(), 1);
    }

    // -------------------------------------------------------------------------
    // Scan and Redact Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_scan_and_redact_ssn() {
        let text = "Employee SSN: 123-45-6789";
        let result = scan_and_redact(text);

        assert!(result.had_pii);
        assert_eq!(result.redacted_text, "Employee SSN: [SSN_REDACTED]");
        assert_eq!(result.matches.len(), 1);
        assert!(result.summary.unwrap().contains("1 SSN"));
    }

    #[test]
    fn test_scan_and_redact_credit_card() {
        let text = "Card on file: 4111 1111 1111 1111";
        let result = scan_and_redact(text);

        assert!(result.had_pii);
        assert_eq!(result.redacted_text, "Card on file: [CC_REDACTED]");
    }

    #[test]
    fn test_scan_and_redact_multiple_types() {
        let text = "SSN: 123-45-6789, Card: 4111111111111111";
        let result = scan_and_redact(text);

        assert!(result.had_pii);
        assert_eq!(
            result.redacted_text,
            "SSN: [SSN_REDACTED], Card: [CC_REDACTED]"
        );
        assert_eq!(result.matches.len(), 2);
        let summary = result.summary.unwrap();
        assert!(summary.contains("SSN"));
        assert!(summary.contains("credit card"));
    }

    #[test]
    fn test_scan_and_redact_no_pii() {
        let text = "This is a normal message with no sensitive data.";
        let result = scan_and_redact(text);

        assert!(!result.had_pii);
        assert_eq!(result.redacted_text, text);
        assert!(result.matches.is_empty());
        assert!(result.summary.is_none());
    }

    #[test]
    fn test_scan_and_redact_preserves_surrounding_text() {
        let text = "Before 123-45-6789 after";
        let result = scan_and_redact(text);

        assert_eq!(result.redacted_text, "Before [SSN_REDACTED] after");
    }

    // -------------------------------------------------------------------------
    // Edge Cases
    // -------------------------------------------------------------------------

    #[test]
    fn test_empty_string() {
        let result = scan_and_redact("");
        assert!(!result.had_pii);
        assert_eq!(result.redacted_text, "");
    }

    #[test]
    fn test_pii_at_start() {
        let text = "123-45-6789 is the SSN";
        let result = scan_and_redact(text);
        assert_eq!(result.redacted_text, "[SSN_REDACTED] is the SSN");
    }

    #[test]
    fn test_pii_at_end() {
        let text = "The SSN is 123-45-6789";
        let result = scan_and_redact(text);
        assert_eq!(result.redacted_text, "The SSN is [SSN_REDACTED]");
    }

    #[test]
    fn test_placeholder_types() {
        assert_eq!(PiiType::Ssn.placeholder(), "[SSN_REDACTED]");
        assert_eq!(PiiType::CreditCard.placeholder(), "[CC_REDACTED]");
        assert_eq!(PiiType::BankAccount.placeholder(), "[BANK_ACCT_REDACTED]");
    }

    #[test]
    fn test_pii_type_labels() {
        assert_eq!(PiiType::Ssn.label(), "Social Security Number");
        assert_eq!(PiiType::CreditCard.label(), "Credit Card Number");
        assert_eq!(PiiType::BankAccount.label(), "Bank Account Number");
    }
}
