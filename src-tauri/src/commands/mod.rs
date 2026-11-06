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
