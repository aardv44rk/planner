use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use anyhow::{anyhow, Result};
use reqwest::multipart::{Form, Part};
use reqwest::{Client, StatusCode};
use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use url::Url;

use crate::auth::{generate_current_totp, retrieve_credentials};

pub const LMS_BASE: &str = "https://lms.s.isct.ac.jp/2025";
pub const LMS_MY_PAGE: &str = "https://lms.s.isct.ac.jp/2025/my/";
pub const SCIENCE_PORTAL: &str = "https://isct.ex-tic.com/idm/user/portal/";
pub const EXTIC_SECOND_FACTOR: &str = "/auth/session/second_factor";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCookie {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
    pub secure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStore {
    pub timestamp: i64,
    pub cookies: Vec<StoredCookie>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResult {
    pub success: bool,
    pub message: String,
    pub assignment_id: String,
    pub filename: String,
}

fn session_cookie_path(config_dir: &Path) -> PathBuf {
    config_dir.join("session.cookie")
}

pub fn save_cookie_store(config_dir: &Path, store_mutex: &CookieStoreMutex) -> Result<()> {
    let path = session_cookie_path(config_dir);
    let mut file = fs::File::create(&path)
        .map_err(|e| anyhow!("Failed to create session.cookie: {}", e))?;
    let store = store_mutex
        .lock()
        .map_err(|_| anyhow!("Failed to lock cookie store"))?;
    cookie_store::serde::json::save_incl_expired_and_nonpersistent(&store, &mut file)
        .map_err(|e| anyhow!("Failed to save session cookies: {:?}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }

    log::info!("LMS session cookies saved securely to {:?}", path);
    Ok(())
}

pub fn load_cookie_store(config_dir: &Path) -> Result<Option<CookieStore>> {
    let path = session_cookie_path(config_dir);
    if !path.exists() {
        return Ok(None);
    }
    let file = fs::File::open(&path)
        .map_err(|e| anyhow!("Failed to open session.cookie: {}", e))?;
    let mut reader = std::io::BufReader::new(file);
    let store = cookie_store::serde::json::load(&mut reader)
        .map_err(|e| anyhow!("Failed to load session cookies: {:?}", e))?;
    Ok(Some(store))
}

pub fn save_session(config_dir: &Path, cookies: &[StoredCookie]) -> Result<()> {
    let store = SessionStore {
        timestamp: chrono::Utc::now().timestamp(),
        cookies: cookies.to_vec(),
    };
    let json = serde_json::to_string_pretty(&store)
        .map_err(|e| anyhow!("Failed to serialize session cookie store: {}", e))?;
    let path = session_cookie_path(config_dir);
    fs::write(&path, json)
        .map_err(|e| anyhow!("Failed to write session.cookie: {}", e))?;
    Ok(())
}

pub fn load_session(config_dir: &Path) -> Result<Option<Vec<StoredCookie>>> {
    let path = session_cookie_path(config_dir);
    if !path.exists() {
        return Ok(None);
    }
    // If it's a valid cookie_store file, report session as cached
    if let Ok(Some(_)) = load_cookie_store(config_dir) {
        return Ok(Some(vec![StoredCookie {
            name: "MoodleSession".to_string(),
            value: "cached".to_string(),
            domain: "lms.s.isct.ac.jp".to_string(),
            path: "/".to_string(),
            secure: true,
        }]));
    }
    // Otherwise fallback to json SessionStore if present
    let data = fs::read_to_string(&path)
        .map_err(|e| anyhow!("Failed to read session.cookie: {}", e))?;
    let store: SessionStore = serde_json::from_str(&data)
        .map_err(|e| anyhow!("Failed to parse session.cookie: {}", e))?;
    Ok(Some(store.cookies))
}

pub fn clear_session(config_dir: &Path) -> Result<()> {
    let path = session_cookie_path(config_dir);
    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| anyhow!("Failed to delete session.cookie: {}", e))?;
    }
    Ok(())
}

fn build_client(cookie_store: Arc<CookieStoreMutex>) -> Result<Client> {
    Client::builder()
        .cookie_provider(cookie_store)
        .redirect(reqwest::redirect::Policy::limited(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 LifeOS/0.1")
        .build()
        .map_err(|e| anyhow!("Failed to create HTTP client: {}", e))
}

/// Headless SSO state machine that silently negotiates Science Tokyo SAML / Extic authentication.
/// Mirrors the sequence of requests, form extractions, and SAML handshakes from isct-companion.
pub async fn perform_sso_login(config_dir: &Path) -> Result<(Client, Arc<CookieStoreMutex>)> {
    let creds = retrieve_credentials()?
        .ok_or_else(|| anyhow!("No university credentials found in secure OS vault. Please save your credentials in Settings."))?;

    if creds.username.is_empty() || creds.password.is_empty() {
        return Err(anyhow!("University username or password is empty"));
    }

    log::info!("Starting headless SSO login flow for user: {}", creds.username);

    let cookie_store = Arc::new(CookieStoreMutex::new(CookieStore::default()));
    let client = build_client(cookie_store.clone())?;

    // Step 1: GET LMS Entry URL
    let initial_resp = client
        .get(LMS_MY_PAGE)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to reach LMS entry URL: {}", e))?;

    let final_url = initial_resp.url().clone();
    let html = initial_resp
        .text()
        .await
        .map_err(|e| anyhow!("Failed to read response body: {}", e))?;

    // If already logged in, return early
    if html.contains("login/logout.php") {
        log::info!("Already authenticated on LMS dashboard");
        save_cookie_store(config_dir, &cookie_store)?;
        return Ok((client, cookie_store));
    }

    // Step 2: Parse credentials form (Extic login form)
    let (login_action, login_fields) = parse_form(&html, &final_url, "form#login", &[
        ("identifier", &creds.username),
        ("password", &creds.password),
    ])
    .or_else(|_| parse_first_form_with_fields(&html, &final_url, &[
        ("identifier", &creds.username),
        ("password", &creds.password),
    ]))
    .map_err(|e| anyhow!("Failed to find login credentials form: {}. The school login page layout may have changed.", e))?;

    log::info!("Posting university credentials to: {}", login_action);

    let auth_resp = client
        .post(login_action)
        .form(&login_fields)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to post credentials: {}", e))?;

    if auth_resp.status() == StatusCode::UNAUTHORIZED {
        return Err(anyhow!("University authentication failed: Invalid username or password"));
    }

    let mut current_url = auth_resp.url().clone();
    let mut current_html = auth_resp
        .text()
        .await
        .map_err(|e| anyhow!("Failed to read authentication response: {}", e))?;

    // Step 3 & 4: Multi-Factor Authentication (TOTP)
    let is_mfa = current_url.path().contains("second_factor")
        || current_html.contains("totp-form")
        || current_html.contains("name=\"totp\"");

    if is_mfa {
        log::info!("MFA challenge detected. Generating native TOTP code...");
        if creds.totp_seed.is_empty() {
            return Err(anyhow!("University portal requires Multi-Factor Authentication (TOTP), but no TOTP seed was provided in Settings."));
        }

        let totp_code = generate_current_totp(&creds.totp_seed)
            .map_err(|e| anyhow!("Failed to generate TOTP code: {}", e))?;

        log::info!("Submitting generated 6-digit TOTP code...");

        let (totp_action, totp_fields) = parse_form(&current_html, &current_url, "form#totp-form", &[
            ("totp", &totp_code),
        ])
        .or_else(|_| parse_first_form_with_fields(&current_html, &current_url, &[
            ("totp", &totp_code),
        ]))
        .map_err(|e| anyhow!("Failed to locate MFA TOTP form: {}", e))?;

        let mfa_resp = client
            .post(totp_action)
            .form(&totp_fields)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to submit TOTP verification: {}", e))?;

        if mfa_resp.status() == StatusCode::UNAUTHORIZED {
            return Err(anyhow!("MFA verification rejected: The TOTP code was not accepted by the portal."));
        }

        current_url = mfa_resp.url().clone();
        current_html = mfa_resp
            .text()
            .await
            .map_err(|e| anyhow!("Failed to read MFA response: {}", e))?;
    }

    // Step 5: Follow SAML Auto-submit Form (if present)
    if current_html.contains("SAMLResponse") || current_html.contains("SAMLRequest") {
        log::info!("SAML assertion detected. Submitting SAMLResponse handshake...");
        let (saml_action, saml_fields) = parse_saml_form(&current_html, &current_url)?;

        let saml_resp = client
            .post(saml_action)
            .form(&saml_fields)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to submit SAMLResponse assertion: {}", e))?;

        current_html = saml_resp
            .text()
            .await
            .map_err(|e| anyhow!("Failed to read SAML callback response: {}", e))?;
    }

    // Verify arrival on LMS dashboard
    let dashboard_resp = client
        .get(LMS_MY_PAGE)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to confirm LMS landing: {}", e))?;

    let check_html = dashboard_resp.text().await.unwrap_or_default();
    if !check_html.contains("login/logout.php") && !current_html.contains("login/logout.php") {
        log::warn!("Dashboard does not explicitly contain logout link, but checking cookies...");
    }

    log::info!("SSO handshake completed successfully! Persisting authenticated cookie store...");
    save_cookie_store(config_dir, &cookie_store)?;

    Ok((client, cookie_store))
}

/// Returns an active authenticated reqwest client, reusing saved session cookies if valid.
pub async fn get_authenticated_client(config_dir: &Path) -> Result<Client> {
    if let Ok(Some(loaded_store)) = load_cookie_store(config_dir) {
        let store_mutex = Arc::new(CookieStoreMutex::new(loaded_store));
        let client = build_client(store_mutex.clone())?;

        // Quick verification check
        if let Ok(resp) = client.get(LMS_MY_PAGE).send().await {
            if resp.status().is_success() {
                let text = resp.text().await.unwrap_or_default();
                if text.contains("login/logout.php") {
                    log::info!("Reused valid LMS session cookies from session.cookie");
                    return Ok(client);
                }
            }
        }
    }

    // Otherwise, perform full headless login
    log::info!("No valid cached session found. Initiating automated SSO login...");
    let (client, _) = perform_sso_login(config_dir).await?;
    Ok(client)
}

/// Helper function to parse HTML forms and inject fields.
fn parse_form(
    html: &str,
    base_url: &Url,
    form_selector: &str,
    overrides: &[(&str, &str)],
) -> Result<(Url, Vec<(String, String)>)> {
    let document = Html::parse_document(html);
    let sel = Selector::parse(form_selector)
        .map_err(|_| anyhow!("Invalid CSS selector: {}", form_selector))?;

    let form_el = document
        .select(&sel)
        .next()
        .ok_or_else(|| anyhow!("Form {} not found", form_selector))?;

    extract_form_data(&form_el, base_url, overrides)
}

fn parse_first_form_with_fields(
    html: &str,
    base_url: &Url,
    required_fields: &[(&str, &str)],
) -> Result<(Url, Vec<(String, String)>)> {
    let document = Html::parse_document(html);
    let form_sel = Selector::parse("form")
        .map_err(|_| anyhow!("Failed to parse form selector"))?;

    for form_el in document.select(&form_sel) {
        let input_sel = Selector::parse("input")
            .map_err(|_| anyhow!("Failed to parse input selector"))?;
        let names: Vec<String> = form_el
            .select(&input_sel)
            .filter_map(|input| input.value().attr("name").map(|s| s.to_string()))
            .collect();

        let all_match = required_fields
            .iter()
            .all(|(req, _)| names.iter().any(|n| n == req));

        if all_match {
            return extract_form_data(&form_el, base_url, required_fields);
        }
    }

    Err(anyhow!("No form found containing required fields"))
}

fn parse_saml_form(html: &str, base_url: &Url) -> Result<(Url, Vec<(String, String)>)> {
    let document = Html::parse_document(html);
    let form_sel = Selector::parse("form")
        .map_err(|_| anyhow!("Failed to parse form selector"))?;

    for form_el in document.select(&form_sel) {
        let input_sel = Selector::parse("input[name='SAMLResponse'], input[name='SAMLRequest']")
            .map_err(|_| anyhow!("Failed to parse SAML input selector"))?;
        if form_el.select(&input_sel).next().is_some() {
            return extract_form_data(&form_el, base_url, &[]);
        }
    }

    Err(anyhow!("No SAML auto-post form found"))
}

fn extract_form_data(
    form_el: &scraper::ElementRef,
    base_url: &Url,
    overrides: &[(&str, &str)],
) -> Result<(Url, Vec<(String, String)>)> {
    let action_str = form_el.value().attr("action").unwrap_or("");
    let action_url = if action_str.is_empty() {
        base_url.clone()
    } else {
        base_url.join(action_str)
            .map_err(|e| anyhow!("Failed to resolve form action URL: {}", e))?
    };

    let mut fields: Vec<(String, String)> = Vec::new();
    let input_sel = Selector::parse("input, textarea, select")
        .map_err(|_| anyhow!("Failed to parse control selector"))?;

    for input in form_el.select(&input_sel) {
        if let Some(name) = input.value().attr("name") {
            let val = input.value().attr("value").unwrap_or("").to_string();
            fields.push((name.to_string(), val));
        }
    }

    // Apply overrides
    for (k, v) in overrides {
        if let Some(pos) = fields.iter().position(|(name, _)| name == *k) {
            fields[pos].1 = v.to_string();
        } else {
            fields.push((k.to_string(), v.to_string()));
        }
    }

    Ok((action_url, fields))
}

/// Silently uploads an assignment submission directly to the LMS submission endpoint.
pub async fn upload_assignment(
    config_dir: &Path,
    file_path: &str,
    assignment_id: &str,
) -> Result<UploadResult> {
    let path = PathBuf::from(file_path);
    if !path.exists() {
        return Err(anyhow!("Local file does not exist: {}", file_path));
    }

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| anyhow!("Invalid file name"))?
        .to_string();

    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| anyhow!("Failed to read file contents: {}", e))?;

    let client = get_authenticated_client(config_dir).await?;

    log::info!(
        "Uploading file '{}' ({} bytes) to LMS assignment {}",
        filename,
        bytes.len(),
        assignment_id
    );

    let part = Part::bytes(bytes)
        .file_name(filename.clone())
        .mime_str("application/octet-stream")
        .map_err(|e| anyhow!("Failed to set MIME type: {}", e))?;

    let form = Form::new()
        .text("id", assignment_id.to_string())
        .text("action", "savesubmission")
        .part("submission_file", part);

    let upload_url = format!("{}/mod/assign/view.php?id={}&action=editsubmission", LMS_BASE, assignment_id);

    let resp = client
        .post(&upload_url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| anyhow!("Upload HTTP request failed: {}", e))?;

    if !resp.status().is_success() && resp.status() != StatusCode::SEE_OTHER {
        return Err(anyhow!("LMS returned non-success status code during submission: {}", resp.status()));
    }

    Ok(UploadResult {
        success: true,
        message: format!("Successfully uploaded and submitted '{}' to assignment #{}", filename, assignment_id),
        assignment_id: assignment_id.to_string(),
        filename,
    })
}
