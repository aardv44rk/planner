use tauri::{AppHandle, Manager};
use crate::error::AppError;

/// Dispatches a native OS desktop notification.
/// On Windows, utilizes Windows Toast via WinRT with click-to-activate.
/// Emits fallback event for shells on other targets or without desktop shell integration.
pub async fn show_notification(
    app: &AppHandle,
    title: &str,
    body: &str,
) -> Result<(), AppError> {
    log::info!("[Notification] {}: {}", title, body);

    #[cfg(target_os = "windows")]
    {
        let app_clone = app.clone();
        let title_str = title.to_string();
        let body_str = body.to_string();
        let identifier = app.config().identifier.clone();

        let _ = tauri::async_runtime::spawn_blocking(move || {
            let activate = app_clone.clone();
            let _ = tauri_winrt_notification::Toast::new(&identifier)
                .title(&title_str)
                .text1(&body_str)
                .sound(Some(tauri_winrt_notification::Sound::Default))
                .on_activated(move |_| {
                    if let Some(window) = activate.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                    Ok(())
                })
                .show();
        })
        .await;
    }

    // Always emit an event to frontend so in-app toast/UI can also reflect it
    use tauri::Emitter;
    let _ = app.emit("app-notification", serde_json::json!({
        "title": title,
        "body": body,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }));

    Ok(())
}
