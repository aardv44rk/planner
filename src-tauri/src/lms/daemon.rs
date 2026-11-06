use std::path::PathBuf;
use std::time::Duration;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};

/// Spawns the background LMS worker thread running every 30 minutes.
/// Auto-recovers session via credentials stored in the OS vault,
/// runs quiet synchronization, updates SQLite, and fires native notifications.
pub fn start_lms_daemon(app_handle: AppHandle, config_dir: PathBuf, pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        log::info!("Starting LifeOS LMS background daemon (30-minute interval)...");
        // Initial grace period on startup (20 seconds) to allow UI to mount smoothly
        tokio::time::sleep(Duration::from_secs(20)).await;

        let mut interval = tokio::time::interval(Duration::from_secs(1800));

        loop {
            interval.tick().await;

            // Check if any credentials are configured before attempting headless network handshake
            let has_sci = crate::auth::retrieve_science_credentials().ok().flatten().is_some();
            let has_ti = crate::auth::retrieve_titech_credentials().ok().flatten().is_some();
            let has_legacy = crate::auth::retrieve_credentials().ok().flatten().is_some();

            if !has_sci && !has_ti && !has_legacy {
                log::debug!("LMS daemon: No credentials configured in OS vault. Skipping background sync.");
                continue;
            }

            log::info!("LMS daemon: Starting scheduled 30m auto session check & sync...");

            // Query existing pending assignment IDs to detect newly discovered assignments
            let prev_assignments: Vec<(String, String, String, String)> = sqlx::query_as(
                "SELECT id, title, course_id, due_date FROM assignments WHERE status = 'pending'"
            )
            .fetch_all(&pool)
            .await
            .unwrap_or_default();

            // Run sync_courses_and_tasks (which tests session against LMS_MY_PAGE and auto-recovers via perform_sso_login)
            match crate::lms::sync::sync_courses_and_tasks(&config_dir, &pool).await {
                Ok(_) => {
                    log::info!("LMS daemon: Background sync completed successfully.");
                    let _ = app_handle.emit("lms-synced", serde_json::json!({
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    }));

                    // Detect newly appeared assignments
                    let current_pending: Vec<(String, String, String, String)> = sqlx::query_as(
                        "SELECT id, title, course_id, due_date FROM assignments WHERE status = 'pending'"
                    )
                    .fetch_all(&pool)
                    .await
                    .unwrap_or_default();

                    let prev_ids: std::collections::HashSet<String> = prev_assignments.iter().map(|(id, _, _, _)| id.clone()).collect();
                    for (id, title, course_id, _due_date) in &current_pending {
                        if !prev_ids.contains(id) {
                            log::info!("LMS daemon: Newly detected assignment: [{}] {}", course_id, title);
                            let notif_title = format!("New Assignment: {}", course_id.to_uppercase());
                            let notif_body = title.clone();
                            let _ = crate::notifications::show_notification(&app_handle, &notif_title, &notif_body).await;
                        }
                    }

                    // Check for assignments due in <= 24 hours
                    let now = chrono::Utc::now();
                    for (_id, title, _course_id, due_date_str) in &current_pending {
                        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(due_date_str) {
                            let diff_hours = dt.signed_duration_since(now).num_hours();
                            if diff_hours > 0 && diff_hours <= 24 {
                                let notif_title = "Upcoming Deadline (24h)".to_string();
                                let notif_body = format!("\"{}\" is due in {} hours!", title, diff_hours);
                                let _ = crate::notifications::show_notification(&app_handle, &notif_title, &notif_body).await;
                            }
                        }
                    }
                }
                Err(e) => {
                    log::warn!("LMS daemon: Background sync error: {}", e);
                }
            }
        }
    });
}
