use std::sync::Arc;
use tauri::State;
use crate::config::{default_layout, load_or_init_layout, save_layout_file};
use crate::db;
use crate::models::{
    ActivitySummary, CreateHabitInput, CreateScheduleBlockInput, CreateTaskInput,
    DailyNote, DashboardMetrics, Habit, HabitDay, LayoutConfig, ScheduleBlock,
    Task, TimeAllocationItem, UpdateTaskInput,
};
use crate::AppState;

// Layout commands
#[tauri::command]
pub async fn get_layout(state: State<'_, Arc<AppState>>) -> Result<LayoutConfig, String> {
    load_or_init_layout(&state.config_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_layout(
    state: State<'_, Arc<AppState>>,
    layout: LayoutConfig,
) -> Result<(), String> {
    save_layout_file(&state.config_dir, &layout).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reset_layout(state: State<'_, Arc<AppState>>) -> Result<LayoutConfig, String> {
    let def = default_layout();
    save_layout_file(&state.config_dir, &def).map_err(|e| e.to_string())?;
    Ok(def)
}

// Tasks commands
#[tauri::command]
pub async fn get_tasks(state: State<'_, Arc<AppState>>) -> Result<Vec<Task>, String> {
    db::get_all_tasks(&state.db).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_task(
    state: State<'_, Arc<AppState>>,
    input: CreateTaskInput,
) -> Result<Task, String> {
    db::create_task(&state.db, input).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_task(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<Task, String> {
    db::toggle_task_completed(&state.db, &id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task(
    state: State<'_, Arc<AppState>>,
    input: UpdateTaskInput,
) -> Result<Task, String> {
    db::update_task(&state.db, input).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_task(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), String> {
    db::delete_task(&state.db, &id).await.map_err(|e| e.to_string())
}

// Schedule commands
#[tauri::command]
pub async fn get_schedule_blocks(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<Vec<ScheduleBlock>, String> {
    db::get_schedule_blocks(&state.db, &date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_schedule_blocks_range(
    state: State<'_, Arc<AppState>>,
    start_date: String,
    end_date: String,
) -> Result<Vec<ScheduleBlock>, String> {
    db::get_schedule_blocks_range(&state.db, &start_date, &end_date)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_schedule_block(
    state: State<'_, Arc<AppState>>,
    input: CreateScheduleBlockInput,
) -> Result<ScheduleBlock, String> {
    db::create_schedule_block(&state.db, input).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_schedule_block(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), String> {
    db::delete_schedule_block(&state.db, &id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_ics(
    state: State<'_, Arc<AppState>>,
    ics_content: String,
    target_date: Option<String>,
) -> Result<usize, String> {
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
) -> Result<DailyNote, String> {
    db::get_daily_note(&state.db, &date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_daily_note(
    state: State<'_, Arc<AppState>>,
    date: String,
    content_md: String,
) -> Result<DailyNote, String> {
    db::save_daily_note(&state.db, &date, &content_md).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_daily_notes_dates(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<String>, String> {
    db::get_daily_notes_dates(&state.db).await.map_err(|e| e.to_string())
}

// Analytics and Metrics
#[tauri::command]
pub async fn get_dashboard_metrics(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<DashboardMetrics, String> {
    db::get_dashboard_metrics(&state.db, &date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_time_allocation(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<Vec<TimeAllocationItem>, String> {
    db::get_time_allocation(&state.db, &date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_activity_summary(
    state: State<'_, Arc<AppState>>,
    date: String,
) -> Result<ActivitySummary, String> {
    db::get_activity_summary(&state.db, &date).await.map_err(|e| e.to_string())
}

// Habits commands (real SQLite persistence)
#[tauri::command]
pub async fn get_habits(
    state: State<'_, Arc<AppState>>,
    start_date: String,
) -> Result<Vec<HabitDay>, String> {
    db::get_habits_with_days(&state.db, &start_date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_habit_matrix(
    state: State<'_, Arc<AppState>>,
    start_date: String,
) -> Result<Vec<HabitDay>, String> {
    db::get_habits_with_days(&state.db, &start_date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_habit_day(
    state: State<'_, Arc<AppState>>,
    habit_id: String,
    date: String,
) -> Result<bool, String> {
    db::toggle_habit_day(&state.db, &habit_id, &date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_habit(
    state: State<'_, Arc<AppState>>,
    input: CreateHabitInput,
) -> Result<Habit, String> {
    db::create_habit(&state.db, &input.name).await.map_err(|e| e.to_string())
}

// Robust .ics parser
fn parse_ics_string(content: &str, default_date: Option<&str>) -> Vec<CreateScheduleBlockInput> {
    let mut blocks = Vec::new();
    let mut current_summary: Option<String> = None;
    let mut current_dtstart: Option<String> = None;
    let mut current_dtend: Option<String> = None;
    let mut current_category: Option<String> = None;
    let mut in_vevent = false;

    let mut unfolded_lines: Vec<String> = Vec::new();
    for line in content.lines() {
        if line.starts_with(' ') || line.starts_with('\t') {
            if let Some(last) = unfolded_lines.last_mut() {
                last.push_str(line.trim_start());
            }
        } else {
            unfolded_lines.push(line.trim().to_string());
        }
    }

    for line in unfolded_lines {
        if line.starts_with("BEGIN:VEVENT") {
            in_vevent = true;
            current_summary = None;
            current_dtstart = None;
            current_dtend = None;
            current_category = None;
        } else if line.starts_with("END:VEVENT") {
            if in_vevent {
                if let (Some(summary), Some(start)) = (current_summary.take(), current_dtstart.take()) {
                    let end = current_dtend.take().unwrap_or_else(|| {
                        let (h, m) = parse_time_hh_mm(&start);
                        format!("{:02}:{:02}", (h + 1) % 24, m)
                    });
                    let date = parse_date_yyyy_mm_dd(&start)
                        .or_else(|| default_date.map(|s| s.to_string()))
                        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
                    let start_time = parse_time_hh_mm_str(&start);

                    blocks.push(CreateScheduleBlockInput {
                        title: summary,
                        start_time,
                        end_time: end,
                        category: current_category.take().or_else(|| Some("Calendar".to_string())),
                        date,
                    });
                }
            }
            in_vevent = false;
        } else if in_vevent {
            if let Some(val) = extract_prop(&line, "SUMMARY") {
                current_summary = Some(val);
            } else if let Some(val) = extract_prop(&line, "DTSTART") {
                current_dtstart = Some(val);
            } else if let Some(val) = extract_prop(&line, "DTEND") {
                current_dtend = Some(parse_time_hh_mm_str(&val));
            } else if let Some(val) = extract_prop(&line, "CATEGORIES") {
                current_category = Some(val);
            }
        }
    }

    blocks
}

fn extract_prop(line: &str, prop_name: &str) -> Option<String> {
    if line.starts_with(prop_name) {
        if let Some(colon_idx) = line.find(':') {
            return Some(line[colon_idx + 1..].trim().to_string());
        }
    }
    None
}

fn parse_date_yyyy_mm_dd(dt: &str) -> Option<String> {
    let clean = dt.replace('-', "");
    if clean.len() >= 8 {
        let y = &clean[0..4];
        let m = &clean[4..6];
        let d = &clean[6..8];
        return Some(format!("{}-{}-{}", y, m, d));
    }
    None
}

fn parse_time_hh_mm_str(dt: &str) -> String {
    if let Some(t_pos) = dt.find('T') {
        let t_part = &dt[t_pos + 1..];
        if t_part.len() >= 4 {
            let h = &t_part[0..2];
            let m = &t_part[2..4];
            return format!("{}:{}", h, m);
        }
    }
    "09:00".to_string()
}

fn parse_time_hh_mm(dt: &str) -> (u32, u32) {
    let s = parse_time_hh_mm_str(dt);
    let mut parts = s.split(':');
    let h = parts.next().and_then(|v| v.parse().ok()).unwrap_or(9);
    let m = parts.next().and_then(|v| v.parse().ok()).unwrap_or(0);
    (h, m)
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
) -> Result<(), String> {
    crate::auth::store_credentials(
        &username,
        &password,
        &totp_seed,
        matrix_card.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_science_credentials(
    username: String,
    password: String,
    totp_seed: String,
) -> Result<(), String> {
    crate::auth::store_science_credentials(&username, &password, &totp_seed)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_titech_credentials(
    username: String,
    password: String,
    matrix_card: String,
) -> Result<(), String> {
    crate::auth::store_titech_credentials(&username, &password, &matrix_card)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_science_credentials() -> Result<(), String> {
    crate::auth::clear_science_credentials().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_titech_credentials() -> Result<(), String> {
    crate::auth::clear_titech_credentials().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_matrix_card(matrix: String) -> Result<(), String> {
    crate::auth::store_matrix_card(&matrix).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_credential_status(state: State<'_, Arc<AppState>>) -> Result<CredentialStatus, String> {
    let creds = crate::auth::retrieve_credentials().map_err(|e| e.to_string())?;
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
pub async fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let _ = Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let _ = Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn clear_credentials(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let _ = crate::lms::clear_session(&state.config_dir);
    crate::auth::delete_credentials().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_lms(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    crate::lms::sync_courses_and_tasks(&state.config_dir, &state.db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_lms_sync_state(state: State<'_, Arc<AppState>>) -> Result<crate::models::LmsSyncState, String> {
    let active_year = db::get_sync_meta(&state.db, "active_academic_year")
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let active_quarter = db::get_sync_meta(&state.db, "active_quarter")
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let last_synced_at = db::get_sync_meta(&state.db, "last_synced_at")
        .await
        .map_err(|e| e.to_string())?;

    Ok(crate::models::LmsSyncState {
        active_academic_year: active_year,
        active_quarter,
        last_synced_at,
    })
}

#[tauri::command]
pub async fn login_titech(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    crate::lms::perform_titech_login(&state.config_dir)
        .await
        .map(|_| "Successfully signed in to Tokyo Tech portal".to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_courses(state: State<'_, Arc<AppState>>) -> Result<Vec<crate::models::Course>, String> {
    db::get_courses(&state.db).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upload_assignment(
    state: State<'_, Arc<AppState>>,
    file_path: String,
    assignment_id: String,
) -> Result<crate::lms::UploadResult, String> {
    crate::lms::upload_assignment(&state.config_dir, &file_path, &assignment_id, Some(&state.db))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pick_assignment_file() -> Result<crate::models::PickedFileResult, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Select Assignment File to Submit")
        .pick_file()
        .await
        .ok_or_else(|| "File selection was cancelled".to_string())?;

    let path = file.path().to_string_lossy().to_string();
    let metadata = tokio::fs::metadata(&file.path())
        .await
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
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
) -> Result<crate::lms::UploadResult, String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Select Assignment File to Submit")
        .pick_file()
        .await
        .ok_or_else(|| "File selection was cancelled".to_string())?;

    let file_path = file.path().to_string_lossy().to_string();
    crate::lms::upload_assignment(&state.config_dir, &file_path, &assignment_id, Some(&state.db))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_current_totp() -> Result<crate::auth::TotpCodeResult, String> {
    let seed = crate::auth::retrieve_totp_seed()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No TOTP seed is configured in the vault".to_string())?;

    crate::auth::get_totp_code_info(&seed).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_totp_seed(seed: String) -> Result<crate::auth::TotpCodeResult, String> {
    crate::auth::get_totp_code_info(&seed).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_totp_seed(seed: String) -> Result<crate::auth::TotpCodeResult, String> {
    let code_info = crate::auth::get_totp_code_info(&seed).map_err(|e| e.to_string())?;
    crate::auth::store_totp_seed(&seed).map_err(|e| e.to_string())?;
    Ok(code_info)
}

// Quick Notes Commands
#[tauri::command]
pub async fn get_quick_notes(state: State<'_, Arc<AppState>>) -> Result<Vec<crate::models::QuickNote>, String> {
    db::get_all_quick_notes(&state.db).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_quick_note(
    state: State<'_, Arc<AppState>>,
    content: String,
) -> Result<crate::models::QuickNote, String> {
    db::create_quick_note(&state.db, &content).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_quick_note(
    state: State<'_, Arc<AppState>>,
    id: String,
) -> Result<(), String> {
    db::delete_quick_note(&state.db, &id).await.map_err(|e| e.to_string())
}

