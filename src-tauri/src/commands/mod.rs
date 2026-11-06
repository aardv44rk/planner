use std::sync::Arc;
use tauri::State;
use crate::config::{default_layout, load_or_init_layout, save_layout_file};
use crate::db;
use crate::error::AppError;
use crate::models::{
    ActivitySummary, CreateHabitInput, CreateScheduleBlockInput, CreateTaskInput,
    DailyNote, DashboardMetrics, Habit, HabitDay, LayoutConfig, ScheduleBlock,
    Task, TimeAllocationItem, UpdateTaskInput,
};
use crate::AppState;

// Layout commands
#[tauri::command]
pub async fn get_layout(state: State<'_, Arc<AppState>>) -> Result<LayoutConfig, AppError> {
    load_or_init_layout(&state.config_dir).map_err(AppError::from)
}

#[tauri::command]
pub async fn save_layout(
    state: State<'_, Arc<AppState>>,
    layout: LayoutConfig,
) -> Result<(), AppError> {
    save_layout_file(&state.config_dir, &layout).map_err(AppError::from)
}

#[tauri::command]
pub async fn reset_layout(state: State<'_, Arc<AppState>>) -> Result<LayoutConfig, AppError> {
    let def = default_layout();
    save_layout_file(&state.config_dir, &def).map_err(AppError::from)?;
    Ok(def)
}

// Tasks commands
#[tauri::command]
pub async fn get_tasks(state: State<'_, Arc<AppState>>) -> Result<Vec<Task>, AppError> {
    db::get_all_tasks(&state.db).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn create_task(
    state: State<'_, Arc<AppState>>,
    input: CreateTaskInput,
) -> Result<Task, AppError> {
    db::create_task(&state.db, input).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn toggle_task(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<Task, AppError> {
    db::toggle_task_completed(&state.db, &id).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn update_task(
    state: State<'_, Arc<AppState>>,
    input: UpdateTaskInput,
) -> Result<Task, AppError> {
    db::update_task(&state.db, input).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn delete_task(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), AppError> {
    db::delete_task(&state.db, &id).await.map_err(AppError::from)
}

// Schedule commands
#[tauri::command]
pub async fn get_schedule_blocks(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<Vec<ScheduleBlock>, AppError> {
    db::get_schedule_blocks(&state.db, &date).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_schedule_blocks_range(
    state: State<'_, Arc<AppState>>,
    start_date: String,
    end_date: String,
) -> Result<Vec<ScheduleBlock>, AppError> {
    db::get_schedule_blocks_range(&state.db, &start_date, &end_date)
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn create_schedule_block(
    state: State<'_, Arc<AppState>>,
    input: CreateScheduleBlockInput,
) -> Result<ScheduleBlock, AppError> {
    db::create_schedule_block(&state.db, input).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn delete_schedule_block(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), AppError> {
    db::delete_schedule_block(&state.db, &id).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn import_ics(
    state: State<'_, Arc<AppState>>,
    ics_content: String,
    target_date: Option<String>,
) -> Result<usize, AppError> {
    let parsed_blocks = parse_ics_string(&ics_content, target_date.as_deref());
    let count = parsed_blocks.len();
    for block in parsed_blocks {
        let _ = db::create_schedule_block(&state.db, block).await;
    }
    Ok(count)
}

// Daily Notes commands
#[tauri::command]
pub async fn get_daily_note(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<DailyNote, AppError> {
    db::get_daily_note(&state.db, &date).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn save_daily_note(
    state: State<'_, Arc<AppState>>,
    date: String,
    content_md: String,
) -> Result<DailyNote, AppError> {
    db::save_daily_note(&state.db, &date, &content_md).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_daily_notes_dates(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<String>, AppError> {
    db::get_daily_notes_dates(&state.db).await.map_err(AppError::from)
}

// Analytics and Metrics
#[tauri::command]
pub async fn get_dashboard_metrics(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<DashboardMetrics, AppError> {
    db::get_dashboard_metrics(&state.db, &date).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_time_allocation(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<Vec<TimeAllocationItem>, AppError> {
    db::get_time_allocation(&state.db, &date).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_activity_summary(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<ActivitySummary, AppError> {
    db::get_activity_summary(&state.db, &date).await.map_err(AppError::from)
}

// Habits commands (real SQLite persistence)
#[tauri::command]
pub async fn get_habits(
    state: State<'_, Arc<AppState>>,
    start_date: String,
) -> Result<Vec<HabitDay>, AppError> {
    db::get_habits_with_days(&state.db, &start_date).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn get_habit_matrix(
    state: State<'_, Arc<AppState>>,
    start_date: String,
) -> Result<Vec<HabitDay>, AppError> {
    db::get_habits_with_days(&state.db, &start_date).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn toggle_habit_day(
    state: State<'_, Arc<AppState>>,
    habit_id: String,
    date: String,
) -> Result<bool, AppError> {
    db::toggle_habit_day(&state.db, &habit_id, &date).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn create_habit(
    state: State<'_, Arc<AppState>>,
    input: CreateHabitInput,
) -> Result<Habit, AppError> {
    db::create_habit(&state.db, &input.name).await.map_err(AppError::from)
}

// Robust .ics parser
fn parse_ics_string(content: &str, default_date: Option<&str>) -> Vec<CreateScheduleBlockInput> {
    let mut blocks = Vec::new();
    let mut current_summary: Option<String> = None;
    let mut current_dtstart: Option<String> = None;
    let mut current_dtend: Option<String> = None;

    let reader = std::io::BufReader::new(content.as_bytes());
    let parser = ical::IcalParser::new(reader);

    for line in parser {
        if let Ok(calendar) = line {
            for event in calendar.events {
                for prop in event.properties {
                    match prop.name.as_str() {
                        "SUMMARY" => current_summary = prop.value,
                        "DTSTART" => current_dtstart = prop.value,
                        "DTEND" => current_dtend = prop.value,
                        _ => {}
                    }
                }

                if let Some(summary) = current_summary.take() {
                    let (date, start_time, end_time) = parse_ics_timestamps(
                        current_dtstart.as_deref(),
                        current_dtend.as_deref(),
                        default_date,
                    );

                    blocks.push(CreateScheduleBlockInput {
                        title: summary,
                        start_time,
                        end_time,
                        category: Some("Imported".to_string()),
                        date,
                    });
                }
            }
        }
    }

    if blocks.is_empty() {
        for line in content.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("SUMMARY:") {
                current_summary = Some(val.to_string());
            } else if let Some(val) = line.strip_prefix("DTSTART:") {
                current_dtstart = Some(val.to_string());
            } else if let Some(val) = line.strip_prefix("DTSTART;") {
                if let Some((_, time_part)) = val.split_once(':') {
                    current_dtstart = Some(time_part.to_string());
                }
            } else if let Some(val) = line.strip_prefix("DTEND:") {
                current_dtend = Some(val.to_string());
            } else if let Some(val) = line.strip_prefix("DTEND;") {
                if let Some((_, time_part)) = val.split_once(':') {
                    current_dtend = Some(time_part.to_string());
                }
            } else if line == "END:VEVENT" {
                if let Some(summary) = current_summary.take() {
                    let (date, start_time, end_time) = parse_ics_timestamps(
                        current_dtstart.as_deref(),
                        current_dtend.as_deref(),
                        default_date,
                    );
                    blocks.push(CreateScheduleBlockInput {
                        title: summary,
                        start_time,
                        end_time,
                        category: Some("Imported".to_string()),
                        date,
                    });
                }
            }
        }
    }

    blocks
}

fn parse_ics_timestamps(
    dtstart: Option<&str>,
    dtend: Option<&str>,
    default_date: Option<&str>,
) -> (String, String, String) {
    let now = chrono::Local::now();
    let def_d = default_date
        .map(|s| s.to_string())
        .unwrap_or_else(|| now.format("%Y-%m-%d").to_string());

    let (date_str, start_time) = if let Some(start) = dtstart {
        if start.len() >= 8 {
            let d = format!("{}-{}-{}", &start[0..4], &start[4..6], &start[6..8]);
            let t = if start.len() >= 13 && start.contains('T') {
                let t_part = start.split('T').nth(1).unwrap_or("090000");
                if t_part.len() >= 4 {
                    format!("{}:{}", &t_part[0..2], &t_part[2..4])
                } else {
                    "09:00".to_string()
                }
            } else {
                "09:00".to_string()
            };
            (d, t)
        } else {
            (def_d.clone(), "09:00".to_string())
        }
    } else {
        (def_d.clone(), "09:00".to_string())
    };

    let end_time = if let Some(end) = dtend {
        if end.len() >= 13 && end.contains('T') {
            let t_part = end.split('T').nth(1).unwrap_or("10:30");
            if t_part.len() >= 4 {
                format!("{}:{}", &t_part[0..2], &t_part[2..4])
            } else {
                "10:30".to_string()
            }
        } else {
            "10:30".to_string()
        }
    } else {
        "10:30".to_string()
    };

    (date_str, start_time, end_time)
}

// ==========================================
// Science Tokyo LMS & Authentication Commands
// ==========================================

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CredentialStatus {
    pub configured: bool,
    pub username: Option<String>,
    pub has_username: bool,
    pub has_password: bool,
    pub has_totp: bool,
    pub has_matrix: bool,
    pub session_cached: bool,

    // Science Tokyo Profile
    pub science_username: Option<String>,
    pub has_science_username: bool,
    pub has_science_password: bool,

    // Tokyo Tech Profile
    pub titech_username: Option<String>,
    pub has_titech_username: bool,
    pub has_titech_password: bool,
}

#[tauri::command]
pub async fn save_credentials(
    username: String,
    password: String,
    totp_seed: String,
    matrix_card: Option<String>,
) -> Result<(), AppError> {
    crate::auth::store_credentials(
        &username,
        &password,
        &totp_seed,
        matrix_card.as_deref(),
    )
    .map_err(AppError::from)
}

#[tauri::command]
pub async fn save_science_credentials(
    username: String,
    password: String,
    totp_seed: String,
) -> Result<(), AppError> {
    crate::auth::store_science_credentials(&username, &password, &totp_seed)
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn save_titech_credentials(
    username: String,
    password: String,
    matrix_card: String,
) -> Result<(), AppError> {
    crate::auth::store_titech_credentials(&username, &password, &matrix_card)
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn clear_science_credentials() -> Result<(), AppError> {
    crate::auth::clear_science_credentials().map_err(AppError::from)
}

#[tauri::command]
pub async fn clear_titech_credentials() -> Result<(), AppError> {
    crate::auth::clear_titech_credentials().map_err(AppError::from)
}

#[tauri::command]
pub async fn save_matrix_card(matrix: String) -> Result<(), AppError> {
    crate::auth::store_matrix_card(&matrix).map_err(AppError::from)
}

#[tauri::command]
pub async fn get_credential_status(state: State<'_, Arc<AppState>>) -> Result<CredentialStatus, AppError> {
    let creds = crate::auth::retrieve_credentials().map_err(AppError::from)?;
    let sci_creds = crate::auth::retrieve_science_credentials().unwrap_or(None);
    let ti_creds = crate::auth::retrieve_titech_credentials().unwrap_or(None);
    let totp_seed = crate::auth::retrieve_totp_seed().unwrap_or(None);
    let matrix_card = crate::auth::retrieve_matrix_card().unwrap_or(None);
    let session_cached = crate::lms::load_session(&state.config_dir)
        .map(|opt| opt.is_some())
        .unwrap_or(false);

    let has_science_username = sci_creds.as_ref().map(|c| !c.username.is_empty()).unwrap_or(false)
        || creds.as_ref().map(|c| !c.username.is_empty()).unwrap_or(false);
    let has_science_password = sci_creds.as_ref().map(|c| !c.password.is_empty()).unwrap_or(false)
        || creds.as_ref().map(|c| !c.password.is_empty()).unwrap_or(false);
    let science_username = sci_creds.as_ref().map(|c| c.username.clone())
        .or_else(|| creds.as_ref().map(|c| c.username.clone()));

    let has_titech_username = ti_creds.as_ref().map(|c| !c.username.is_empty()).unwrap_or(false);
    let has_titech_password = ti_creds.as_ref().map(|c| !c.password.is_empty()).unwrap_or(false);
    let titech_username = ti_creds.as_ref().map(|c| c.username.clone());

    let has_totp = totp_seed.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
        || sci_creds.as_ref().map(|c| !c.totp_seed.is_empty()).unwrap_or(false)
        || creds.as_ref().map(|c| !c.totp_seed.is_empty()).unwrap_or(false);
    let has_matrix = matrix_card.as_ref().map(|m| !m.is_empty()).unwrap_or(false)
        || ti_creds.as_ref().map(|c| !c.matrix_card.is_empty()).unwrap_or(false)
        || creds.as_ref().map(|c| !c.matrix_card.is_empty()).unwrap_or(false);

    let has_username = has_science_username || has_titech_username;
    let has_password = has_science_password || has_titech_password;
    let configured = has_science_username || has_titech_username || has_totp || has_matrix;

    Ok(CredentialStatus {
        configured,
        username: science_username.clone().or_else(|| titech_username.clone()),
        has_username,
        has_password,
        has_totp,
        has_matrix,
        session_cached,
        science_username,
        has_science_username,
        has_science_password,
        titech_username,
        has_titech_username,
        has_titech_password,
    })
}

#[tauri::command]
pub async fn open_url(url: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let _ = Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn clear_credentials(state: State<'_, Arc<AppState>>) -> Result<(), AppError> {
    let _ = crate::lms::clear_session(&state.config_dir);
    crate::auth::delete_credentials().map_err(AppError::from)
}

#[tauri::command]
pub async fn sync_lms(state: State<'_, Arc<AppState>>) -> Result<String, AppError> {
    crate::lms::sync_courses_and_tasks(&state.config_dir, &state.db)
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn get_lms_sync_state(state: State<'_, Arc<AppState>>) -> Result<crate::models::LmsSyncState, AppError> {
    let active_year = db::get_sync_meta(&state.db, "active_academic_year")
        .await
        .map_err(AppError::from)?
        .unwrap_or_default();
    let active_quarter = db::get_sync_meta(&state.db, "active_quarter")
        .await
        .map_err(AppError::from)?
        .unwrap_or_default();
    let last_synced_at = db::get_sync_meta(&state.db, "last_synced_at")
        .await
        .map_err(AppError::from)?;

    Ok(crate::models::LmsSyncState {
        active_academic_year: active_year,
        active_quarter,
        last_synced_at,
    })
}

#[tauri::command]
pub async fn login_titech(state: State<'_, Arc<AppState>>) -> Result<String, AppError> {
    crate::lms::perform_titech_login(&state.config_dir)
        .await
        .map(|_| "Successfully signed in to Tokyo Tech portal".to_string())
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn get_courses(state: State<'_, Arc<AppState>>) -> Result<Vec<crate::models::Course>, AppError> {
    db::get_courses(&state.db).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn upload_assignment(
    state: State<'_, Arc<AppState>>,
    file_path: String,
    assignment_id: String,
) -> Result<crate::lms::UploadResult, AppError> {
    crate::lms::upload_assignment(&state.config_dir, &file_path, &assignment_id, Some(&state.db))
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn pick_assignment_file() -> Result<crate::models::PickedFileResult, AppError> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Select Assignment File to Submit")
        .pick_file()
        .await
        .ok_or_else(|| AppError::Internal("File selection was cancelled".to_string()))?;

    let path = file.path().to_string_lossy().to_string();
    let metadata = tokio::fs::metadata(&file.path())
        .await
        .map_err(|e| AppError::Io(format!("Failed to read file metadata: {}", e)))?;
    let name = file.file_name();

    Ok(crate::models::PickedFileResult {
        path,
        name,
        size: metadata.len(),
    })
}

#[tauri::command]
pub async fn pick_and_upload_assignment(
    state: State<'_, Arc<AppState>>,
    assignment_id: String,
) -> Result<crate::lms::UploadResult, AppError> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Select Assignment File to Submit")
        .pick_file()
        .await
        .ok_or_else(|| AppError::Internal("File selection was cancelled".to_string()))?;

    let file_path = file.path().to_string_lossy().to_string();
    crate::lms::upload_assignment(&state.config_dir, &file_path, &assignment_id, Some(&state.db))
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn get_current_totp() -> Result<crate::auth::TotpCodeResult, AppError> {
    let seed = crate::auth::retrieve_totp_seed()
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::Auth("No TOTP seed is configured in the vault".to_string()))?;

    crate::auth::get_totp_code_info(&seed).map_err(AppError::from)
}

#[tauri::command]
pub async fn verify_totp_seed(seed: String) -> Result<crate::auth::TotpCodeResult, AppError> {
    crate::auth::get_totp_code_info(&seed).map_err(AppError::from)
}

#[tauri::command]
pub async fn save_totp_seed(seed: String) -> Result<crate::auth::TotpCodeResult, AppError> {
    let code_info = crate::auth::get_totp_code_info(&seed).map_err(AppError::from)?;
    crate::auth::store_totp_seed(&seed).map_err(AppError::from)?;
    Ok(code_info)
}

// Quick Notes Commands
#[tauri::command]
pub async fn get_quick_notes(state: State<'_, Arc<AppState>>) -> Result<Vec<crate::models::QuickNote>, AppError> {
    db::get_all_quick_notes(&state.db).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn create_quick_note(
    state: State<'_, Arc<AppState>>,
    content: String,
) -> Result<crate::models::QuickNote, AppError> {
    db::create_quick_note(&state.db, &content).await.map_err(AppError::from)
}

#[tauri::command]
pub async fn delete_quick_note(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), AppError> {
    db::delete_quick_note(&state.db, &id).await.map_err(AppError::from)
}

// Campus Wi-Fi Commands
#[tauri::command]
pub async fn check_campus_wifi() -> Result<bool, AppError> {
    crate::wifi::is_captive_portal_active().await
}

#[tauri::command]
pub async fn login_campus_wifi() -> Result<String, AppError> {
    crate::wifi::login_to_campus_wifi().await
}

// Notification Commands
#[tauri::command]
pub async fn trigger_test_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), AppError> {
    crate::notifications::show_notification(&app, &title, &body).await
}
