use std::time::Duration;
use reqwest::Client;
use scraper::{Html, Selector};
use url::Url;
use crate::error::AppError;

const PROBE_URL: &str = "http://captive.apple.com/hotspot-detect.html";
const FALLBACK_PROBE_URL: &str = "http://detectportal.firefox.com/success.txt";
const SSID_NAME: &str = "ScienceTokyo";

/// Checks if the client is currently behind a Cisco Meraki captive portal (ScienceTokyo Wi-Fi).
/// Returns true if a captive portal splash screen is detected and requires sign-in, false if online.
pub async fn is_captive_portal_active() -> Result<bool, AppError> {
    let client = Client::builder()
        .timeout(Duration::from_secs(6))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()?;

    let (is_active, _, _) = probe_portal(&client).await?;
    Ok(is_active)
}

/// Probes captive portal and returns (is_captive, portal_url, html_body).
async fn probe_portal(client: &Client) -> Result<(bool, Option<Url>, Option<String>), AppError> {
    let resp = match client.get(PROBE_URL).send().await {
        Ok(r) => r,
        Err(_) => {
            // Fallback probe
            client.get(FALLBACK_PROBE_URL).send().await?
        }
    };

    let url = resp.url().clone();
    let body = resp.text().await.unwrap_or_default();

    // Check if network is already open and directly reaching Apple / Mozilla success pages
    if body.contains("<TITLE>Success</TITLE>")
        || body.contains("<title>Success</title>")
        || (body.trim() == "success" && url.as_str().contains("firefox"))
    {
        return Ok((false, None, None));
    }

    // Check if redirected to Cisco Meraki splash or custom captive portal
    let is_meraki_splash = url
        .host_str()
        .map(|h| h.ends_with(".network-auth.com"))
        .unwrap_or(false)
        && url.path().starts_with("/splash/");

    let has_splash_elements = body.contains("sign_in_form")
        || body.contains(SSID_NAME)
        || body.contains("Science Tokyo")
        || body.contains("STWireless");

    if is_meraki_splash || has_splash_elements {
        Ok((true, Some(url), Some(body)))
    } else {
        // Unknown redirect or connection issue
        Ok((false, None, None))
    }
}

/// Automatically signs into the ScienceTokyo campus Wi-Fi Meraki captive portal
/// using Tokyo Tech / Science Tokyo credentials retrieved from the OS vault.
pub async fn login_to_campus_wifi() -> Result<String, AppError> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()?;

    let (is_active, portal_url_opt, body_opt) = probe_portal(&client).await?;
    if !is_active {
        return Ok("Already connected to the internet. No captive portal sign-in required.".to_string());
    }

    let portal_url = portal_url_opt.ok_or_else(|| {
        AppError::Network("Captive portal detected but failed to resolve portal URL.".into())
    })?;
    let body = body_opt.unwrap_or_default();

    // Retrieve Tokyo Tech credentials (primary profile for campus Wi-Fi per NOC guide), fallback to Science credentials
    let (username, password) = if let Ok(Some(ti)) = crate::auth::retrieve_titech_credentials() {
        if !ti.username.is_empty() && !ti.password.is_empty() {
            (ti.username, ti.password)
        } else if let Ok(Some(sci)) = crate::auth::retrieve_science_credentials() {
            (sci.username, sci.password)
        } else if let Ok(Some(c)) = crate::auth::retrieve_credentials() {
            (c.username, c.password)
        } else {
            return Err(AppError::Auth("No credentials found in OS vault. Please configure your credentials in Settings first.".into()));
        }
    } else if let Ok(Some(sci)) = crate::auth::retrieve_science_credentials() {
        (sci.username, sci.password)
    } else if let Ok(Some(c)) = crate::auth::retrieve_credentials() {
        (c.username, c.password)
    } else {
        return Err(AppError::Auth("No credentials found in OS vault. Please configure your credentials in Settings first.".into()));
    };

    // Parse the Meraki sign-in form inside an isolated block so scraper::Html & ElementRef are dropped before .await
    let (submit_url, form_data) = {
        let doc = Html::parse_document(&body);
        let form_sel = Selector::parse("form#sign_in_form, form[method='post'], form[method='POST']").unwrap();
        let hidden_sel = Selector::parse("input[type='hidden']").unwrap();

        let form_el = doc.select(&form_sel).next().ok_or_else(|| {
            AppError::Parse("Could not find sign-in form on the ScienceTokyo campus Wi-Fi portal page.".into())
        })?;

        let action_attr = form_el.value().attr("action").unwrap_or("");
        let submit_url = portal_url.join(action_attr).map_err(|e| {
            AppError::Parse(format!("Failed to resolve form action URL '{}': {}", action_attr, e))
        })?;

        let mut data: Vec<(String, String)> = Vec::new();

        // Collect all hidden fields (CSRF tokens, continue_url, etc.)
        for input in form_el.select(&hidden_sel) {
            if let Some(name) = input.value().attr("name") {
                let val = input.value().attr("value").unwrap_or("").to_string();
                data.push((name.to_string(), val));
            }
        }

        // Add email / username and password fields
        data.push(("email".to_string(), username));
        data.push(("password".to_string(), password));

        (submit_url, data)
    };

    log::info!("Submitting credentials to campus Wi-Fi captive portal at {}...", submit_url);

    let post_resp = client.post(submit_url.clone())
        .form(&form_data)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Failed to submit captive portal sign-in form: {}", e)))?;

    let post_body = post_resp.text().await.unwrap_or_default();

    // Check if error message displayed in returned page
    if post_body.contains("login-error") && !post_body.contains("hidden") {
        return Err(AppError::Auth("Campus Wi-Fi portal rejected credentials. Please verify your Tokyo Tech / Science Tokyo ID and password.".into()));
    }

    // Give the access point a moment to apply the grant, then probe to verify
    for attempt in 1..=4 {
        tokio::time::sleep(Duration::from_millis(800 * attempt)).await;
        if let Ok((still_captive, _, _)) = probe_portal(&client).await {
            if !still_captive {
                log::info!("ScienceTokyo Wi-Fi successfully verified online!");
                return Ok("Successfully authenticated and connected to ScienceTokyo Campus Wi-Fi!".to_string());
            }
        }
    }

    // Even if probe didn't return success immediately, if redirect finished outside splash, it succeeded
    Ok("Sign-in request sent to ScienceTokyo Wi-Fi portal. Network access should open shortly.".to_string())
}
