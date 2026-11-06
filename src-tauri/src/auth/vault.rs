use anyhow::{anyhow, Result};
use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE_NAME: &str = "lifeos-command-center";
const ENTRY_SCIENCE_SSO: &str = "science_tokyo_sso";
const ENTRY_SCIENCE_TOTP: &str = "science_tokyo_totp";
const ENTRY_TITECH_SSO: &str = "titech_portal_sso";
const ENTRY_TITECH_MATRIX: &str = "titech_matrix_card";
const ENTRY_LEGACY_ACCOUNT: &str = "science_tokyo_sso";
const ENTRY_LEGACY_MATRIX: &str = "tokyo_tech_matrix";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScienceCredentials {
    pub username: String,
    pub password: String,
    pub totp_seed: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TitechCredentials {
    pub username: String,
    pub password: String,
    pub matrix_card: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UniversityCredentials {
    pub username: String,
    pub password: String,
    pub totp_seed: String,
    #[serde(default)]
    pub matrix_card: String,
}

/// Helper function to read an entry directly from OS Keyring without any recursion.
fn raw_get_keyring_password(entry_name: &str) -> Option<String> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, entry_name) {
        if let Ok(pwd) = entry.get_password() {
            let trimmed = pwd.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

/// Securely stores Science Tokyo (Extic LMS SSO) credentials in OS Keyring.
pub fn store_science_credentials(username: &str, password: &str, totp_seed: &str) -> Result<()> {
    let existing = retrieve_science_credentials().unwrap_or(None);
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
        let clean = totp_seed.trim().to_string();
        let _ = store_totp_seed(&clean);
        clean
    } else if let Some(ref e) = existing {
        e.totp_seed.clone()
    } else if let Ok(Some(s)) = retrieve_totp_seed() {
        s
    } else {
        String::new()
    };

    let creds = ScienceCredentials {
        username: final_username.clone(),
        password: final_password.clone(),
        totp_seed: final_totp_seed.clone(),
    };

    let payload = serde_json::to_string(&creds)
        .map_err(|e| anyhow!("Failed to serialize Science Tokyo credentials: {}", e))?;

    let entry = Entry::new(SERVICE_NAME, ENTRY_SCIENCE_SSO)
        .map_err(|e| anyhow!("Failed to access OS Keyring service: {}", e))?;
    entry.set_password(&payload)
        .map_err(|e| anyhow!("Failed to write Science Tokyo credentials to OS Keyring: {}", e))?;

    // Also update legacy bundle without calling store_credentials to avoid any recursion
    let legacy_creds = UniversityCredentials {
        username: final_username,
        password: final_password,
        totp_seed: final_totp_seed,
        matrix_card: retrieve_matrix_card().unwrap_or(None).unwrap_or_default(),
    };
    let _ = save_credentials_bundle(&legacy_creds);

    log::info!("Science Tokyo credentials securely written to OS Keyring");
    Ok(())
}

/// Retrieves Science Tokyo (Extic LMS SSO) credentials from OS Keyring without recursion.
pub fn retrieve_science_credentials() -> Result<Option<ScienceCredentials>> {
    // 1. Try reading dedicated Science SSO entry
    if let Some(payload) = raw_get_keyring_password(ENTRY_SCIENCE_SSO) {
        if let Ok(mut c) = serde_json::from_str::<ScienceCredentials>(&payload) {
            if c.totp_seed.is_empty() {
                if let Some(totp) = raw_get_keyring_password(ENTRY_SCIENCE_TOTP) {
                    c.totp_seed = totp;
                }
            }
            return Ok(Some(c));
        }
    }

    // 2. Fallback to legacy account bundle
    if let Some(payload) = raw_get_keyring_password(ENTRY_LEGACY_ACCOUNT) {
        if let Ok(legacy) = serde_json::from_str::<UniversityCredentials>(&payload) {
            let totp = if !legacy.totp_seed.is_empty() {
                legacy.totp_seed
            } else {
                raw_get_keyring_password(ENTRY_SCIENCE_TOTP).unwrap_or_default()
            };

            if !legacy.username.is_empty() || !legacy.password.is_empty() || !totp.is_empty() {
                return Ok(Some(ScienceCredentials {
                    username: legacy.username,
                    password: legacy.password,
                    totp_seed: totp,
                }));
            }
        }
    }

    // 3. Fallback: only TOTP seed exists
    if let Some(totp) = raw_get_keyring_password(ENTRY_SCIENCE_TOTP) {
        return Ok(Some(ScienceCredentials {
            username: String::new(),
            password: String::new(),
            totp_seed: totp,
        }));
    }

    Ok(None)
}

/// Clears Science Tokyo credentials from OS Keyring.
pub fn clear_science_credentials() -> Result<()> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_SCIENCE_SSO) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_SCIENCE_TOTP) {
        let _ = entry.delete_credential();
    }
    log::info!("Science Tokyo credentials cleared from OS Keyring");
    Ok(())
}

/// Securely stores Tokyo Tech (Portal / GetAccess) credentials in OS Keyring.
pub fn store_titech_credentials(username: &str, password: &str, matrix_card: &str) -> Result<()> {
    let existing = retrieve_titech_credentials().unwrap_or(None);
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

    let final_matrix = if !matrix_card.trim().is_empty() {
        let clean: String = matrix_card.chars().filter(|c| !c.is_whitespace()).collect();
        let _ = store_matrix_card(&clean);
        clean
    } else if let Some(ref e) = existing {
        e.matrix_card.clone()
    } else if let Ok(Some(m)) = retrieve_matrix_card() {
        m
    } else {
        String::new()
    };

    let creds = TitechCredentials {
        username: final_username,
        password: final_password,
        matrix_card: final_matrix,
    };

    let payload = serde_json::to_string(&creds)
        .map_err(|e| anyhow!("Failed to serialize Tokyo Tech credentials: {}", e))?;

    let entry = Entry::new(SERVICE_NAME, ENTRY_TITECH_SSO)
        .map_err(|e| anyhow!("Failed to access OS Keyring service: {}", e))?;
    entry.set_password(&payload)
        .map_err(|e| anyhow!("Failed to write Tokyo Tech credentials to OS Keyring: {}", e))?;

    log::info!("Tokyo Tech credentials securely written to OS Keyring");
    Ok(())
}

/// Retrieves Tokyo Tech (Portal / GetAccess) credentials from OS Keyring without recursion.
pub fn retrieve_titech_credentials() -> Result<Option<TitechCredentials>> {
    // 1. Try reading dedicated Titech SSO entry
    if let Some(payload) = raw_get_keyring_password(ENTRY_TITECH_SSO) {
        if let Ok(mut c) = serde_json::from_str::<TitechCredentials>(&payload) {
            if c.matrix_card.is_empty() {
                if let Ok(Some(m)) = retrieve_matrix_card() {
                    c.matrix_card = m;
                }
            }
            return Ok(Some(c));
        }
    }

    // 2. Check if standalone matrix card exists
    if let Ok(Some(mat)) = retrieve_matrix_card() {
        return Ok(Some(TitechCredentials {
            username: String::new(),
            password: String::new(),
            matrix_card: mat,
        }));
    }

    Ok(None)
}

/// Clears Tokyo Tech credentials from OS Keyring.
pub fn clear_titech_credentials() -> Result<()> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_TITECH_SSO) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_TITECH_MATRIX) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_LEGACY_MATRIX) {
        let _ = entry.delete_credential();
    }
    log::info!("Tokyo Tech credentials cleared from OS Keyring");
    Ok(())
}

/// Securely stores the 70-character Tokyo Tech Matrix Card in an isolated OS Keyring entry.
pub fn store_matrix_card(matrix: &str) -> Result<()> {
    let clean_matrix: String = matrix.chars().filter(|c| !c.is_whitespace()).collect();
    if clean_matrix.is_empty() {
        return Err(anyhow!("Matrix card cannot be empty"));
    }

    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_TITECH_MATRIX) {
        let _ = entry.set_password(&clean_matrix);
    }
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_LEGACY_MATRIX) {
        let _ = entry.set_password(&clean_matrix);
    }

    // Update raw TitechCredentials if present without recursive store call
    if let Some(raw_payload) = raw_get_keyring_password(ENTRY_TITECH_SSO) {
        if let Ok(mut c) = serde_json::from_str::<TitechCredentials>(&raw_payload) {
            c.matrix_card = clean_matrix.clone();
            if let Ok(new_payload) = serde_json::to_string(&c) {
                if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_TITECH_SSO) {
                    let _ = entry.set_password(&new_payload);
                }
            }
        }
    }

    log::info!("Tokyo Tech Matrix card securely written to OS Keyring");
    Ok(())
}

/// Retrieves stored Tokyo Tech Matrix card without recursion.
pub fn retrieve_matrix_card() -> Result<Option<String>> {
    if let Some(matrix) = raw_get_keyring_password(ENTRY_TITECH_MATRIX) {
        let clean: String = matrix.chars().filter(|c| !c.is_whitespace()).collect();
        if !clean.is_empty() {
            return Ok(Some(clean));
        }
    }

    if let Some(matrix) = raw_get_keyring_password(ENTRY_LEGACY_MATRIX) {
        let clean: String = matrix.chars().filter(|c| !c.is_whitespace()).collect();
        if !clean.is_empty() {
            return Ok(Some(clean));
        }
    }

    if let Some(payload) = raw_get_keyring_password(ENTRY_TITECH_SSO) {
        if let Ok(c) = serde_json::from_str::<TitechCredentials>(&payload) {
            let clean: String = c.matrix_card.chars().filter(|ch| !ch.is_whitespace()).collect();
            if !clean.is_empty() {
                return Ok(Some(clean));
            }
        }
    }

    if let Some(payload) = raw_get_keyring_password(ENTRY_LEGACY_ACCOUNT) {
        if let Ok(creds) = serde_json::from_str::<UniversityCredentials>(&payload) {
            let clean: String = creds.matrix_card.chars().filter(|ch| !ch.is_whitespace()).collect();
            if !clean.is_empty() {
                return Ok(Some(clean));
            }
        }
    }

    Ok(None)
}

/// Securely stores the TOTP seed in an isolated OS Keyring entry without recursion.
pub fn store_totp_seed(seed: &str) -> Result<()> {
    let clean_seed = seed.trim();
    if clean_seed.is_empty() {
        return Err(anyhow!("TOTP seed cannot be empty"));
    }

    let entry = Entry::new(SERVICE_NAME, ENTRY_SCIENCE_TOTP)
        .map_err(|e| anyhow!("Failed to access OS Keyring service: {}", e))?;

    if let Err(e) = entry.set_password(clean_seed) {
        return Err(anyhow!("Failed to write TOTP seed to OS Keyring: {}", e));
    }

    // Update raw ScienceCredentials if present without recursive store call
    if let Some(raw_payload) = raw_get_keyring_password(ENTRY_SCIENCE_SSO) {
        if let Ok(mut c) = serde_json::from_str::<ScienceCredentials>(&raw_payload) {
            c.totp_seed = clean_seed.to_string();
            if let Ok(new_payload) = serde_json::to_string(&c) {
                if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_SCIENCE_SSO) {
                    let _ = entry.set_password(&new_payload);
                }
            }
        }
    }

    log::info!("TOTP seed securely written to OS Keyring");
    Ok(())
}

/// Retrieves stored TOTP seed without recursion.
pub fn retrieve_totp_seed() -> Result<Option<String>> {
    if let Some(secret) = raw_get_keyring_password(ENTRY_SCIENCE_TOTP) {
        let trimmed = secret.trim();
        if !trimmed.is_empty() {
            return Ok(Some(trimmed.to_string()));
        }
    }

    if let Some(payload) = raw_get_keyring_password(ENTRY_SCIENCE_SSO) {
        if let Ok(c) = serde_json::from_str::<ScienceCredentials>(&payload) {
            let trimmed = c.totp_seed.trim();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed.to_string()));
            }
        }
    }

    if let Some(payload) = raw_get_keyring_password(ENTRY_LEGACY_ACCOUNT) {
        if let Ok(creds) = serde_json::from_str::<UniversityCredentials>(&payload) {
            let trimmed = creds.totp_seed.trim();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed.to_string()));
            }
        }
    }

    Ok(None)
}

fn save_credentials_bundle(creds: &UniversityCredentials) -> Result<()> {
    let payload = serde_json::to_string(creds)
        .map_err(|e| anyhow!("Failed to serialize credentials bundle: {}", e))?;

    let entry = Entry::new(SERVICE_NAME, ENTRY_LEGACY_ACCOUNT)
        .map_err(|e| anyhow!("Failed to access OS Keyring service: {}", e))?;

    entry
        .set_password(&payload)
        .map_err(|e| anyhow!("Failed to write credentials to OS Keyring: {}", e))?;

    Ok(())
}

/// Legacy credentials store for backward compatibility.
pub fn store_credentials(
    username: &str,
    password: &str,
    totp_seed: &str,
    matrix_card: Option<&str>,
) -> Result<()> {
    let existing = retrieve_credentials().unwrap_or(None);

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
        let _ = store_totp_seed(&s);
        s
    } else if let Some(ref e) = existing {
        e.totp_seed.clone()
    } else if let Ok(Some(s)) = retrieve_totp_seed() {
        s
    } else {
        String::new()
    };

    let final_matrix = if let Some(m) = matrix_card {
        let clean: String = m.chars().filter(|c| !c.is_whitespace()).collect();
        if !clean.is_empty() {
            let _ = store_matrix_card(&clean);
            clean
        } else if let Some(ref e) = existing {
            e.matrix_card.clone()
        } else if let Ok(Some(m)) = retrieve_matrix_card() {
            m
        } else {
            String::new()
        }
    } else if let Some(ref e) = existing {
        e.matrix_card.clone()
    } else if let Ok(Some(m)) = retrieve_matrix_card() {
        m
    } else {
        String::new()
    };

    let creds = UniversityCredentials {
        username: final_username,
        password: final_password,
        totp_seed: final_totp_seed,
        matrix_card: final_matrix,
    };

    save_credentials_bundle(&creds)?;
    Ok(())
}

/// Retrieves stored credentials bundle from host OS credential manager without circular recursion.
pub fn retrieve_credentials() -> Result<Option<UniversityCredentials>> {
    let mut creds = if let Some(payload) = raw_get_keyring_password(ENTRY_LEGACY_ACCOUNT) {
        let c: UniversityCredentials = serde_json::from_str(&payload).unwrap_or_default();
        Some(c)
    } else if let Some(payload) = raw_get_keyring_password(ENTRY_SCIENCE_SSO) {
        if let Ok(c) = serde_json::from_str::<ScienceCredentials>(&payload) {
            Some(UniversityCredentials {
                username: c.username,
                password: c.password,
                totp_seed: c.totp_seed,
                matrix_card: String::new(),
            })
        } else {
            None
        }
    } else {
        None
    };

    // If totp_seed is empty, fill from raw TOTP entry
    if let Some(secret) = raw_get_keyring_password(ENTRY_SCIENCE_TOTP) {
        if let Some(ref mut c) = creds {
            if c.totp_seed.is_empty() {
                c.totp_seed = secret;
            }
        }
    }

    // If matrix_card is empty, fill from raw Matrix entry
    let matrix_opt = raw_get_keyring_password(ENTRY_TITECH_MATRIX)
        .or_else(|| raw_get_keyring_password(ENTRY_LEGACY_MATRIX));
    if let Some(mat) = matrix_opt {
        let clean: String = mat.chars().filter(|ch| !ch.is_whitespace()).collect();
        if let Some(ref mut c) = creds {
            if c.matrix_card.is_empty() {
                c.matrix_card = clean;
            }
        }
    }

    Ok(creds)
}

/// Checks whether valid credentials exist in the secure vault without recursion.
pub fn has_credentials() -> bool {
    raw_get_keyring_password(ENTRY_SCIENCE_SSO).is_some()
        || raw_get_keyring_password(ENTRY_TITECH_SSO).is_some()
        || raw_get_keyring_password(ENTRY_LEGACY_ACCOUNT).is_some()
        || raw_get_keyring_password(ENTRY_SCIENCE_TOTP).is_some()
        || raw_get_keyring_password(ENTRY_TITECH_MATRIX).is_some()
        || raw_get_keyring_password(ENTRY_LEGACY_MATRIX).is_some()
}

/// Clears all stored credentials from the host OS credential manager.
pub fn delete_credentials() -> Result<()> {
    let _ = clear_science_credentials();
    let _ = clear_titech_credentials();
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_LEGACY_ACCOUNT) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(SERVICE_NAME, ENTRY_LEGACY_MATRIX) {
        let _ = entry.delete_credential();
    }
    log::info!("All credentials removed from OS Keyring");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SERVICE: &str = "lifeos-unit-tests-isolated";
    const TEST_ACCOUNT: &str = "test_transient_account";

    #[test]
    fn test_store_and_retrieve_credentials_isolated() {
        let entry = Entry::new(TEST_SERVICE, TEST_ACCOUNT);
        if let Ok(e) = entry {
            let test_payload = r#"{"username":"test_user","password":"test_pass","totp_seed":"JBSWY3DPEHPK3PXP"}"#;
            let _ = e.set_password(test_payload);
            let read_back = e.get_password().unwrap_or_default();
            assert_eq!(read_back, test_payload);
            let _ = e.delete_credential();
        }
    }

    #[test]
    fn test_no_recursion_in_retrieval() {
        // Calling retrieve_credentials, retrieve_science_credentials,
        // retrieve_titech_credentials, retrieve_totp_seed, retrieve_matrix_card
        // must NEVER trigger stack overflow or mutual recursion.
        let _ = retrieve_credentials();
        let _ = retrieve_science_credentials();
        let _ = retrieve_titech_credentials();
        let _ = retrieve_totp_seed();
        let _ = retrieve_matrix_card();
        let _ = has_credentials();
    }

    #[tokio::test]
    async fn test_tokio_stack_safety_concurrent_calls() {
        let mut handles = vec![];
        for _ in 0..20 {
            handles.push(tokio::spawn(async {
                let _ = retrieve_credentials();
                let _ = retrieve_science_credentials();
                let _ = retrieve_titech_credentials();
                let _ = retrieve_totp_seed();
                let _ = retrieve_matrix_card();
                let _ = has_credentials();
            }));
        }
        for h in handles {
            h.await.unwrap();
        }
    }
}
