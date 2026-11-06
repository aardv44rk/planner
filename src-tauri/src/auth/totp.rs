use anyhow::{anyhow, Result};
use ring::hmac;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TotpCodeResult {
    pub code: String,
    pub seconds_remaining: u64,
}

/// Generates the current 6-digit TOTP code and remaining seconds in the current 30s window.
pub fn get_totp_code_info(seed: &str) -> Result<TotpCodeResult> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| anyhow!("System clock error: {}", e))?
        .as_secs();
    let code = generate_totp_at(seed, now)?;
    let seconds_remaining = 30 - (now % 30);
    Ok(TotpCodeResult {
        code,
        seconds_remaining,
    })
}

/// Generates the current 6-digit TOTP code for Science Tokyo / Extic SSO authentication.
/// Supports both raw Base32 secret seeds (including 80-bit / 10-byte keys from LMS) and full "otpauth://totp/..." URIs.
pub fn generate_current_totp(seed: &str) -> Result<String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| anyhow!("System clock error: {}", e))?
        .as_secs();
    generate_totp_at(seed, now)
}

/// Custom RFC 4648 Base32 decoder adapting isct-companion's implementation.
/// Accepts 80-bit (10-byte / 16-character) shared secrets issued by the university LMS,
/// whereas standard libraries like totp-rs strictly reject secrets under 128 bits.
pub fn decode_base32(raw: &str) -> Result<Vec<u8>> {
    let mut output = Vec::with_capacity(raw.len() * 5 / 8);
    let mut buffer = 0u32;
    let mut bits = 0u8;
    for character in raw.chars().filter(|c| *c != '=' && !c.is_whitespace() && *c != '-') {
        let value = match character.to_ascii_uppercase() {
            'A'..='Z' => character.to_ascii_uppercase() as u8 - b'A',
            '2'..='7' => character as u8 - b'2' + 26,
            _ => return Err(anyhow!("OTP secret is not valid Base32")),
        };
        buffer = (buffer << 5) | u32::from(value);
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
            buffer &= (1u32 << bits).saturating_sub(1);
        }
    }
    // Must be at least 10 bytes (80 bits) to support Science Tokyo / Moodle 80-bit keys
    if output.len() < 10 {
        return Err(anyhow!("OTP secret is too short (must be at least 80 bits / 10 bytes)"));
    }
    Ok(output)
}

/// Computes standard RFC 6238 TOTP using HMAC-SHA1 at a specific timestamp.
pub fn generate_totp_at(seed: &str, timestamp: u64) -> Result<String> {
    let trimmed = seed.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("TOTP seed cannot be empty"));
    }

    let mut secret_str = trimmed.to_string();
    let mut digits: u32 = 6;
    let mut period: u64 = 30;

    if trimmed.starts_with("otpauth://") {
        let parsed_url = url::Url::parse(trimmed)
            .map_err(|e| anyhow!("Failed to parse TOTP otpauth URL: {}", e))?;
        if parsed_url.scheme() != "otpauth" || parsed_url.host_str() != Some("totp") {
            return Err(anyhow!("Only TOTP setup links are supported"));
        }
        for (k, v) in parsed_url.query_pairs() {
            if k.eq_ignore_ascii_case("secret") {
                secret_str = v.to_string();
            } else if k.eq_ignore_ascii_case("digits") {
                if let Ok(d) = v.parse::<u32>() {
                    digits = d;
                }
            } else if k.eq_ignore_ascii_case("period") {
                if let Ok(p) = v.parse::<u64>() {
                    period = p;
                }
            }
        }
    }

    let secret_bytes = decode_base32(&secret_str)?;
    let counter = timestamp / period;

    let key = hmac::Key::new(hmac::HMAC_SHA1_FOR_LEGACY_USE_ONLY, &secret_bytes);
    let digest = hmac::sign(&key, &counter.to_be_bytes());
    let bytes = digest.as_ref();
    let offset = usize::from(bytes[bytes.len() - 1] & 0x0f);
    let binary = (u32::from(bytes[offset] & 0x7f) << 24)
        | (u32::from(bytes[offset + 1]) << 16)
        | (u32::from(bytes[offset + 2]) << 8)
        | u32::from(bytes[offset + 3]);
    let modulus = 10u32.pow(digits);
    Ok(format!(
        "{:0width$}",
        binary % modulus,
        width = digits as usize
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_80_bit_secret() {
        // 16 base32 characters = 16 * 5 = 80 bits = 10 bytes
        // This is the exact format issued by Science Tokyo LMS
        let seed = "JBSWY3DPEHPK3PXP";
        let code = generate_current_totp(seed);
        assert!(code.is_ok(), "80-bit secret should succeed: {:?}", code);
        let code_str = code.unwrap();
        assert_eq!(code_str.len(), 6);
        assert!(code_str.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_generate_totp_from_base32() {
        // Standard RFC 4226 / 6238 test seed: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" (Base32 of "12345678901234567890")
        let seed = "GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ";
        let code = generate_current_totp(seed).expect("should generate code");
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_rfc_6238_vector() {
        // Matches RFC 6238 SHA1 vector with timestamp 59, digits 8
        let uri = "otpauth://totp/test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&digits=8&period=30&algorithm=SHA1";
        let code = generate_totp_at(uri, 59).expect("RFC vector");
        assert_eq!(code, "94287082");
    }

    #[test]
    fn test_generate_totp_from_otpauth_url() {
        let url = "otpauth://totp/Science%20Tokyo:student@isct.ac.jp?secret=JBSWY3DPEHPK3PXP&issuer=Science%20Tokyo";
        let code = generate_current_totp(url).expect("should generate code from url");
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_ascii_digit()));
    }
}
