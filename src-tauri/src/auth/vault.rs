use anyhow::{anyhow, Result};
use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE_NAME: &str = "lifeos-command-center";
const ENTRY_ACCOUNT: &str = "science_tokyo_sso";
const ENTRY_TOTP: &str = "science_tokyo_totp";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UniversityCredentials {
    pub username: String,
    pub password: String,
    pub totp_seed: String,
}

/// Securely stores the TOTP seed in an isolated OS Keyring entry.
/// This guarantees the TOTP key cannot be overwritten, blanked out, or deleted
/// by credentials updates or login status checks.
pub fn store_totp_seed(seed: &str) -> Result<()> {
    let clean_seed = seed.trim();
    if clean_seed.is_empty() {
        return Err(anyhow!("TOTP seed cannot be empty"));
    }

    let entry = Entry::new(SERVICE_NAME, ENTRY_TOTP)
        .map_err(|e| anyhow!("Failed to access OS Keyring service: {}", e))?;

    if let Err(e) = entry.set_password(clean_seed) {
        return Err(anyhow!("Failed to write TOTP seed to OS Keyring: {}", e));
    }

    // Also update existing credentials bundle if present
    if let Ok(Some(mut creds)) = retrieve_credentials() {
        creds.totp_seed = clean_seed.to_string();
        let _ = save_credentials_bundle(&creds);
    }

    log::info!("TOTP seed securely written to OS Keyring");
    Ok(())
}

/// Retrieves stored TOTP seed from the dedicated entry or the credentials bundle.
pub fn retrieve_totp_seed() -> Result<Option<String>> {
    // 1. Try dedicated TOTP entry first
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_TOTP) {
        if let Ok(secret) = entry.get_password() {
            let trimmed = secret.trim();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed.to_string()));
            }
        }
    }

    // 2. Fallback to credentials bundle
    if let Ok(Some(creds)) = retrieve_credentials() {
        let trimmed = creds.totp_seed.trim();
        if !trimmed.is_empty() {
            return Ok(Some(trimmed.to_string()));
        }
    }

    Ok(None)
}

fn save_credentials_bundle(creds: &UniversityCredentials) -> Result<()> {
    let payload = serde_json::to_string(creds)
        .map_err(|e| anyhow!("Failed to serialize credentials bundle: {}", e))?;

    let entry = Entry::new(SERVICE_NAME, ENTRY_ACCOUNT)
        .map_err(|e| anyhow!("Failed to access OS Keyring service: {}", e))?;

    entry
        .set_password(&payload)
        .map_err(|e| anyhow!("Failed to write credentials to OS Keyring: {}", e))?;

    Ok(())
}

/// Securely stores credentials in the host OS credential manager.
/// Plaintext secrets are NEVER written to disk or the SQLite database.
/// Existing non-empty fields (especially TOTP seed) are ALWAYS preserved if not provided.
pub fn store_credentials(username: &str, password: &str, totp_seed: &str) -> Result<()> {
    let existing = retrieve_credentials().unwrap_or(None);
    let existing_totp = retrieve_totp_seed().unwrap_or(None);

    let final_username = if !username.trim().is_empty() {
        username.trim().to_string()
    } else if let Some(ref e) = existing {
        e.username.clone()
    } else {
        String::new()
    };

    let final_password = if !password.is_empty() {
        password.to_string()
    } else if let Some(ref e) = existing {
        e.password.clone()
    } else {
        String::new()
    };

    let final_totp_seed = if !totp_seed.trim().is_empty() {
        let s = totp_seed.trim().to_string();
        // Also save to dedicated entry
        let _ = store_totp_seed(&s);
        s
    } else if let Some(ref s) = existing_totp {
        s.clone()
    } else if let Some(ref e) = existing {
        e.totp_seed.clone()
    } else {
        String::new()
    };

    let creds = UniversityCredentials {
        username: final_username,
        password: final_password,
        totp_seed: final_totp_seed,
    };

    save_credentials_bundle(&creds)?;
    log::info!("University credentials securely written to OS Keyring");
    Ok(())
}

/// Retrieves stored credentials from the host OS credential manager.
pub fn retrieve_credentials() -> Result<Option<UniversityCredentials>> {
    let entry = Entry::new(SERVICE_NAME, ENTRY_ACCOUNT)
        .map_err(|e| anyhow!("Failed to access OS Keyring service: {}", e))?;

    let mut creds = match entry.get_password() {
        Ok(payload) => {
            let c: UniversityCredentials = serde_json::from_str(&payload)
                .map_err(|e| anyhow!("Failed to deserialize stored credentials: {}", e))?;
            Some(c)
        }
        Err(keyring::Error::NoEntry) => None,
        Err(e) => return Err(anyhow!("Failed to read from OS Keyring: {}", e)),
    };

    // If totp_seed is empty in bundle, check dedicated TOTP entry
    if let Ok(entry_totp) = Entry::new(SERVICE_NAME, ENTRY_TOTP) {
        if let Ok(secret) = entry_totp.get_password() {
            let clean = secret.trim();
            if !clean.is_empty() {
                if let Some(ref mut c) = creds {
                    if c.totp_seed.is_empty() {
                        c.totp_seed = clean.to_string();
                    }
                } else {
                    creds = Some(UniversityCredentials {
                        username: String::new(),
                        password: String::new(),
                        totp_seed: clean.to_string(),
                    });
                }
            }
        }
    }

    Ok(creds)
}

/// Checks whether valid credentials exist in the secure vault without exposing secrets.
pub fn has_credentials() -> bool {
    retrieve_credentials().map(|opt| opt.is_some()).unwrap_or(false)
}

/// Clears stored credentials from the host OS credential manager.
pub fn delete_credentials() -> Result<()> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_ACCOUNT) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_TOTP) {
        let _ = entry.delete_credential();
    }
    log::info!("University credentials removed from OS Keyring");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SERVICE: &str = "lifeos-unit-tests-isolated";
    const TEST_ACCOUNT: &str = "test_transient_account";

    #[test]
    fn test_store_and_retrieve_credentials_isolated() {
        // Test an isolated entry so tests NEVER touch production user credentials
        let entry = Entry::new(TEST_SERVICE, TEST_ACCOUNT);
        if let Ok(e) = entry {
            let test_payload = r#"{"username":"test_user","password":"test_pass","totp_seed":"JBSWY3DPEHPK3PXP"}"#;
            let _ = e.set_password(test_payload);
            let read_back = e.get_password().unwrap_or_default();
            assert_eq!(read_back, test_payload);
            let _ = e.delete_credential();
        }
    }
}
