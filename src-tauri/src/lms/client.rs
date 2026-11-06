use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use anyhow::{anyhow, Result};
use reqwest::multipart::{Form, Part};
use reqwest::{Client, StatusCode};
use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use url::Url;

use crate::auth::{generate_current_totp, get_totp_code_info, retrieve_credentials};

pub const LMS_BASE: &str = "https://lms.s.isct.ac.jp/2025";
pub const LMS_MY_PAGE: &str = "https://lms.s.isct.ac.jp/2025/my/";
pub const SCIENCE_PORTAL: &str = "https://isct.ex-tic.com/idm/user/portal/";
pub const EXTIC_SECOND_FACTOR: &str = "/auth/session/second_factor";
pub const GETACCESS_START: &str = "https://portal.nap.gsic.titech.ac.jp/GetAccess/ResourceList?lang=ja";
pub const KYOMU_ENTRY: &str = "https://kyomu0.gakumu.titech.ac.jp/Titech/Default.aspx";

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
    let (username, password) = if let Ok(Some(sci)) = crate::auth::retrieve_science_credentials() {
        if !sci.username.is_empty() && !sci.password.is_empty() {
            (sci.username, sci.password)
        } else if let Ok(Some(creds)) = retrieve_credentials() {
            (creds.username, creds.password)
        } else {
            (sci.username, sci.password)
        }
    } else if let Ok(Some(creds)) = retrieve_credentials() {
        (creds.username, creds.password)
    } else {
        return Err(anyhow!("No Science Tokyo credentials found in secure OS vault. Please save your Science Tokyo credentials in Settings."));
    };

    if username.is_empty() || password.is_empty() {
        return Err(anyhow!("Science Tokyo username or password is empty"));
    }

    let totp_seed = crate::auth::retrieve_totp_seed()
        .unwrap_or(None)
        .unwrap_or_default();

    log::info!("Starting headless SSO login flow for Science Tokyo user: {}", username);

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
        ("identifier", &username),
        ("password", &password),
    ])
    .or_else(|_| parse_first_form_with_fields(&html, &final_url, &[
        ("identifier", &username),
        ("password", &password),
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

    // Step 2b: If not already at MFA or SAML, navigate explicitly to EXTIC_SECOND_FACTOR as in isct-companion
    let has_totp_form = current_html.contains("totp-form") || current_html.contains("name=\"totp\"");
    let has_saml = current_html.contains("SAMLResponse") || current_html.contains("SAMLRequest");
    let is_already_logged_in = current_html.contains("login/logout.php");

    if !has_totp_form && !has_saml && !is_already_logged_in {
        let second_factor_url = current_url
            .join(EXTIC_SECOND_FACTOR)
            .unwrap_or_else(|_| Url::parse("https://isct.ex-tic.com/auth/session/second_factor").unwrap());
        log::info!("Navigating explicitly to Extic second factor: {}", second_factor_url);
        if let Ok(resp) = client.get(second_factor_url).send().await {
            current_url = resp.url().clone();
            current_html = resp.text().await.unwrap_or_default();
        }
    }

    // Step 3 & 4: Multi-Factor Authentication (TOTP)
    let is_mfa = current_url.path().contains("second_factor")
        || current_html.contains("totp-form")
        || current_html.contains("name=\"totp\"");

    if is_mfa {
        log::info!("MFA challenge detected. Checking TOTP window timing...");
        if totp_seed.is_empty() {
            return Err(anyhow!("Science Tokyo portal requires Multi-Factor Authentication (TOTP), but no TOTP seed was configured in Settings."));
        }

        // Window boundary check: if <= 2s remaining, wait for next window to avoid race condition
        let code_info = get_totp_code_info(&totp_seed)
            .map_err(|e| anyhow!("Failed to inspect TOTP timing: {}", e))?;
        if code_info.seconds_remaining <= 2 {
            log::info!("TOTP window boundary detected ({}s remaining). Sleeping until next 30s window...", code_info.seconds_remaining);
            tokio::time::sleep(std::time::Duration::from_secs(code_info.seconds_remaining + 1)).await;
        }

        let totp_code = generate_current_totp(&totp_seed)
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

    // Step 5: Follow SAML Auto-submit Form (loop up to 4 times)
    let mut saml_rounds = 0;
    while (current_html.contains("SAMLResponse") || current_html.contains("SAMLRequest")) && saml_rounds < 4 {
        saml_rounds += 1;
        log::info!("SAML assertion detected (round {}). Submitting SAML handshake...", saml_rounds);
        let (saml_action, saml_fields) = parse_saml_form(&current_html, &current_url)?;

        let saml_resp = client
            .post(saml_action)
            .form(&saml_fields)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to submit SAMLResponse assertion: {}", e))?;

        current_url = saml_resp.url().clone();
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
        return Err(anyhow!("SSO login verification failed: Moodle logout link was not detected on landing dashboard."));
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
    let control_sel = Selector::parse("input, textarea, select")
        .map_err(|_| anyhow!("Failed to parse control selector"))?;
    let opt_sel = Selector::parse("option")
        .map_err(|_| anyhow!("Failed to parse option selector"))?;

    for el in form_el.select(&control_sel) {
        if el.value().attr("disabled").is_some() {
            continue;
        }

        match el.value().name() {
            "input" => {
                let Some(name) = el.value().attr("name").filter(|n| !n.is_empty()) else {
                    continue;
                };
                let kind = el.value().attr("type").unwrap_or("text").to_ascii_lowercase();
                let value = el.value().attr("value").unwrap_or("").to_string();
                match kind.as_str() {
                    "button" | "reset" | "file" => {}
                    "checkbox" | "radio" => {
                        if el.value().attr("checked").is_some() {
                            fields.push((name.to_string(), value));
                        }
                    }
                    _ => fields.push((name.to_string(), value)),
                }
            }
            "select" => {
                let Some(name) = el.value().attr("name").filter(|n| !n.is_empty()) else {
                    continue;
                };
                let options: Vec<_> = el.select(&opt_sel).collect();
                let chosen = options
                    .iter()
                    .rfind(|o| o.value().attr("selected").is_some())
                    .or_else(|| options.first());
                if let Some(opt) = chosen {
                    let val = opt
                        .value()
                        .attr("value")
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| opt.text().collect::<String>().trim().to_string());
                    fields.push((name.to_string(), val));
                }
            }
            "textarea" => {
                let Some(name) = el.value().attr("name").filter(|n| !n.is_empty()) else {
                    continue;
                };
                fields.push((name.to_string(), el.text().collect::<String>()));
            }
            _ => {}
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

/// Silently uploads an assignment submission through Moodle's real repository draft and submission flow.
pub async fn upload_assignment(
    config_dir: &Path,
    file_path: &str,
    assignment_id: &str,
    pool: Option<&SqlitePool>,
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
        "Initiating real Moodle submission for file '{}' ({} bytes) to assignment cmid {}",
        filename,
        bytes.len(),
        assignment_id
    );

    // Step A: GET /2025/mod/assign/view.php?id={cmid}&action=editsubmission
    let edit_url = format!("{}/mod/assign/view.php?id={}&action=editsubmission", LMS_BASE, assignment_id);
    let edit_resp = client.get(&edit_url).send().await
        .map_err(|e| anyhow!("Failed to reach assignment submission edit page: {}", e))?;
    let edit_html = edit_resp.text().await
        .map_err(|e| anyhow!("Failed to read assignment edit page HTML: {}", e))?;

    // Step B: Extract sesskey, hidden files_filemanager draft itemid, client_id
    let (sesskey, draft_itemid, client_id) = {
        let doc = Html::parse_document(&edit_html);
        let mut sess: Option<String> = None;
        let mut draft: Option<String> = None;

        if let Ok(sel) = Selector::parse("input[name=\"files_filemanager\"]") {
            if let Some(el) = doc.select(&sel).next() {
                if let Some(val) = el.value().attr("value") {
                    if !val.is_empty() {
                        draft = Some(val.to_string());
                    }
                }
            }
        }

        if let Ok(sel) = Selector::parse("input[name=\"sesskey\"]") {
            if let Some(el) = doc.select(&sel).next() {
                if let Some(val) = el.value().attr("value") {
                    if !val.is_empty() {
                        sess = Some(val.to_string());
                    }
                }
            }
        }

        if sess.is_none() {
            static SESSKEY_RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
            let re = SESSKEY_RE.get_or_init(|| regex::Regex::new(r#""sesskey":"([A-Za-z0-9]{1,64})""#).unwrap());
            if let Some(caps) = re.captures(&edit_html) {
                sess = caps.get(1).map(|m| m.as_str().to_string());
            }
        }

        let draft_val = draft.unwrap_or_else(|| {
            static ITEMID_RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
            let re = ITEMID_RE.get_or_init(|| regex::Regex::new(r#""itemid":(\d+)"#).unwrap());
            re.captures(&edit_html)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().to_string())
                .unwrap_or_else(|| format!("{}", (chrono::Utc::now().timestamp_millis() % 900000000) + 100000000))
        });

        static CLIENT_ID_RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
        let cid_re = CLIENT_ID_RE.get_or_init(|| regex::Regex::new(r#""client_id":"([A-Za-z0-9_]+)""#).unwrap());
        let cid = cid_re.captures(&edit_html)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string());

        (sess, draft_val, cid)
    };

    let sesskey = sesskey.ok_or_else(|| anyhow!("Could not extract active Moodle sesskey from assignment page"))?;

    log::info!("Extracted Moodle draft itemid: {}, sesskey: {}, client_id: {}", draft_itemid, sesskey, client_id);

    // Step C: POST the file via multipart/form-data to repository_ajax.php?action=upload
    let repo_upload_url = format!("{}/repository/repository_ajax.php?action=upload", LMS_BASE);
    let part = Part::bytes(bytes)
        .file_name(filename.clone())
        .mime_str("application/octet-stream")
        .map_err(|e| anyhow!("Failed to set MIME type: {}", e))?;

    let repo_form = Form::new()
        .text("repo_upload_file", filename.clone())
        .text("sesskey", sesskey.clone())
        .text("itemid", draft_itemid.clone())
        .text("filepath", "/")
        .text("client_id", client_id.clone())
        .text("repo_id", "4")
        .text("title", filename.clone())
        .text("author", "Student")
        .part("repo_upload_file", part);

    let repo_resp = client.post(&repo_upload_url).multipart(repo_form).send().await
        .map_err(|e| anyhow!("Failed to POST draft file to Moodle repository: {}", e))?;

    let repo_json_text = repo_resp.text().await
        .map_err(|e| anyhow!("Failed to read Moodle repository JSON response: {}", e))?;

    log::info!("Repository upload response: {}", repo_json_text);
    if repo_json_text.contains("\"error\"") && !repo_json_text.contains("\"error\":false") {
        return Err(anyhow!("Moodle repository upload rejected file: {}", repo_json_text));
    }

    // Step D: POST edit submission form to /mod/assign/view.php with action=savesubmission
    let save_url = format!("{}/mod/assign/view.php", LMS_BASE);
    let save_fields = [
        ("id", assignment_id),
        ("action", "savesubmission"),
        ("sesskey", &sesskey),
        ("files_filemanager", &draft_itemid),
        ("_qf__mod_assign_submission_form", "1"),
    ];

    let save_resp = client.post(&save_url).form(&save_fields).send().await
        .map_err(|e| anyhow!("Failed to POST save submission form: {}", e))?;
    let save_html = save_resp.text().await.unwrap_or_default();

    // Step E: If assignment page requires final confirmation (action="submit"), submit it
    if save_html.contains("action=\"submit\"") || save_html.contains("name=\"submitbutton\"") && save_html.contains("submit") {
        log::info!("Final submission confirmation required. Confirming submission...");
        let confirm_fields = [
            ("id", assignment_id),
            ("action", "submit"),
            ("sesskey", &sesskey),
            ("confirm", "1"),
            ("_qf__mod_assign_confirm_form", "1"),
        ];
        let _ = client.post(&save_url).form(&confirm_fields).send().await;
    }

    // Update assignment's status to 'submitted' in SQLite and remove from tasks
    if let Some(db_pool) = pool {
        let _ = sqlx::query("UPDATE assignments SET status = 'submitted', updated_at = ? WHERE id = ?")
            .bind(chrono::Utc::now().to_rfc3339())
            .bind(assignment_id)
            .execute(db_pool)
            .await;
        log::info!("Updated assignment {} status to 'submitted' in SQLite", assignment_id);

        let task_id = format!("assign-task-{}", assignment_id);
        let _ = sqlx::query("DELETE FROM tasks WHERE id = ? OR external_id = ?")
            .bind(&task_id)
            .bind(assignment_id)
            .execute(db_pool)
            .await;
        log::info!("Removed completed assignment task {} from tasks table", task_id);
    }

    Ok(UploadResult {
        success: true,
        message: format!("Successfully uploaded and submitted '{}' to Science Tokyo LMS assignment #{}", filename, assignment_id),
        assignment_id: assignment_id.to_string(),
        filename,
    })
}

// ==========================================
// Tokyo Tech Portal (GetAccess + Matrix) Flow
// ==========================================

pub async fn perform_titech_login(config_dir: &Path) -> Result<(Client, Arc<CookieStoreMutex>)> {
    let (username, password) = if let Ok(Some(ti)) = crate::auth::retrieve_titech_credentials() {
        if !ti.username.is_empty() && !ti.password.is_empty() {
            (ti.username, ti.password)
        } else if let Ok(Some(creds)) = retrieve_credentials() {
            (creds.username, creds.password)
        } else {
            (ti.username, ti.password)
        }
    } else if let Ok(Some(creds)) = retrieve_credentials() {
        (creds.username, creds.password)
    } else {
        return Err(anyhow!("No Tokyo Tech portal credentials found in secure OS vault. Please save your Tokyo Tech credentials in Settings."));
    };

    if username.is_empty() || password.is_empty() {
        return Err(anyhow!("Tokyo Tech username or password is empty"));
    }

    let matrix = if let Ok(Some(m)) = crate::auth::retrieve_matrix_card() {
        m
    } else if let Ok(Some(ti)) = crate::auth::retrieve_titech_credentials() {
        ti.matrix_card
    } else if let Ok(Some(creds)) = retrieve_credentials() {
        creds.matrix_card
    } else {
        return Err(anyhow!("Tokyo Tech Matrix card (10x7) is not configured in Settings."));
    };

    let clean_matrix: Vec<char> = matrix.chars().filter(|c| !c.is_whitespace()).collect();
    if clean_matrix.len() != 70 {
        return Err(anyhow!("Saved Matrix card must be exactly 70 characters (7 rows x 10 cols). Current length: {}", clean_matrix.len()));
    }

    log::info!("Starting Tokyo Tech GetAccess portal login for user: {}", username);

    let cookie_store = Arc::new(CookieStoreMutex::new(CookieStore::default()));
    let client = build_client(cookie_store.clone())?;

    let page_resp = client.get(GETACCESS_START).send().await
        .map_err(|e| anyhow!("Failed to access GetAccess start page: {}", e))?;
    let mut page_url = page_resp.url().clone();
    let mut page_html = page_resp.text().await.map_err(|e| anyhow!("Failed to read GetAccess response: {}", e))?;

    let mut password_sent = false;
    let mut matrix_sent = false;
    let mut method_sent = false;

    for _ in 0..8 {
        // 1. Check if Agreement page
        if let Some(pw_url) = extract_titech_password_url(&page_html, &page_url) {
            if password_sent {
                return Err(anyhow!("GetAccess portal showed agreement page again after credentials"));
            }
            log::info!("GetAccess agreement page: navigating to login entry {}", pw_url);
            let next_resp = client.get(pw_url).send().await.map_err(|e| anyhow!("Failed to reach login URL: {}", e))?;
            page_url = next_resp.url().clone();
            page_html = next_resp.text().await.map_err(|e| anyhow!("Failed to read login page: {}", e))?;
            continue;
        }

        // 2. Check if Credentials form
        let has_userpass = page_html.contains("usr_name") && page_html.contains("usr_password");
        if has_userpass && !password_sent {
            log::info!("Submitting GetAccess username (uppercase) and password...");
            let upper_user = username.to_ascii_uppercase();
            let (action, fields) = parse_form(&page_html, &page_url, "form[name=\"login\"], form", &[
                ("usr_name", &upper_user),
                ("usr_password", &password),
            ])?;
            password_sent = true;

            let auth_resp = client.post(action).form(&fields).send().await
                .map_err(|e| anyhow!("Failed to submit GetAccess credentials: {}", e))?;
            page_url = auth_resp.url().clone();
            page_html = auth_resp.text().await.map_err(|e| anyhow!("Failed to read credentials response: {}", e))?;
            continue;
        }

        // 3. Check if MethodPicker (select option GridAuthOption)
        if page_html.contains("GridAuthOption") && !method_sent {
            log::info!("Selecting Grid Authentication method...");
            method_sent = true;
            let (action, mut updated_fields) = parse_form(&page_html, &page_url, "form[name=\"login\"], form", &[])?;
            {
                let doc = Html::parse_document(&page_html);
                let sel_selector = Selector::parse("select").unwrap();
                for sel in doc.select(&sel_selector) {
                    let name = sel.value().attr("name").unwrap_or("");
                    let opt_selector = Selector::parse("option").unwrap();
                    if sel.select(&opt_selector).any(|o| o.value().attr("value") == Some("GridAuthOption")) {
                        if let Some(pos) = updated_fields.iter().position(|(k, _)| k == name) {
                            updated_fields[pos].1 = "GridAuthOption".to_string();
                        } else {
                            updated_fields.push((name.to_string(), "GridAuthOption".to_string()));
                        }
                    }
                }
            }

            let method_resp = client.post(action).form(&updated_fields).send().await
                .map_err(|e| anyhow!("Failed to select GridAuthOption: {}", e))?;
            page_url = method_resp.url().clone();
            page_html = method_resp.text().await.map_err(|e| anyhow!("Failed to read method picker response: {}", e))?;
            continue;
        }

        // 4. Check if Matrix Challenge
        let coordinates = extract_matrix_coordinates(&page_html);
        if !coordinates.is_empty() && !matrix_sent {
            log::info!("GetAccess Matrix challenge detected: answering {} cells...", coordinates.len());
            matrix_sent = true;
            let (action, fields) = parse_form(&page_html, &page_url, "form[name=\"login\"], form", &[])?;
            let mut answer_fields = fields;

            let requested_inputs: Vec<String> = {
                let doc = Html::parse_document(&page_html);
                let input_sel = Selector::parse("input[type=\"text\"], input[type=\"password\"]").unwrap();
                let mut req = Vec::new();
                if let Ok(form_sel) = Selector::parse("form[name=\"login\"], form") {
                    if let Some(form_el) = doc.select(&form_sel).next() {
                        for inp in form_el.select(&input_sel) {
                            let name = inp.value().attr("name").unwrap_or("");
                            if !name.is_empty() && !matches!(name, "usr_name" | "usr_password" | "q") {
                                req.push(name.to_string());
                            }
                        }
                    }
                }
                req
            };

            for (idx, name) in requested_inputs.iter().enumerate() {
                if let Some(&(col, row)) = coordinates.get(idx) {
                    let cell_idx = row * 10 + col;
                    if let Some(&ch) = clean_matrix.get(cell_idx) {
                        if let Some(pos) = answer_fields.iter().position(|(k, _)| k == name) {
                            answer_fields[pos].1 = ch.to_string();
                        } else {
                            answer_fields.push((name.clone(), ch.to_string()));
                        }
                    }
                }
            }

            let matrix_resp = client.post(action).form(&answer_fields).send().await
                .map_err(|e| anyhow!("Failed to submit Matrix challenge: {}", e))?;
            page_url = matrix_resp.url().clone();
            page_html = matrix_resp.text().await.map_err(|e| anyhow!("Failed to read matrix challenge response: {}", e))?;
            continue;
        }

        // 5. If reached portal menu or Kyomu
        if page_html.contains("ResourceList") || page_html.contains("Default.aspx") || page_url.path().contains("ResourceList") {
            log::info!("Successfully reached Tokyo Tech portal menu!");
            break;
        }

        break;
    }

    save_cookie_store(config_dir, &cookie_store)?;
    Ok((client, cookie_store))
}

fn extract_titech_password_url(html: &str, base_url: &Url) -> Option<Url> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("a, input, button").unwrap();
    for el in doc.select(&sel) {
        for attr in ["href", "onclick"] {
            if let Some(val) = el.value().attr(attr) {
                if val.contains("template=userpass_key") {
                    for part in val.split(['"', '\'']) {
                        if part.contains("template=userpass_key") {
                            let clean = part.replace("&amp;", "&");
                            if let Ok(u) = base_url.join(&clean) {
                                return Some(u);
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

fn extract_matrix_coordinates(html: &str) -> Vec<(usize, usize)> {
    static PATTERN: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let re = PATTERN.get_or_init(|| regex::Regex::new(r"\[\s*([A-Ja-j])\s*,\s*([1-7])\s*\]").unwrap());
    let mut coords = Vec::new();
    for cap in re.captures_iter(html) {
        if let (Some(c), Some(r)) = (cap.get(1), cap.get(2)) {
            let col_char = c.as_str().to_ascii_uppercase().chars().next().unwrap();
            let col = (col_char as u8).saturating_sub(b'A') as usize;
            if let Ok(row_num) = r.as_str().parse::<usize>() {
                if (1..=7).contains(&row_num) && col < 10 {
                    coords.push((col, row_num - 1));
                }
            }
        }
    }
    coords
}
