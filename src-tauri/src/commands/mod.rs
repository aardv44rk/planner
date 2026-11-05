use std::sync::Arc;
use tauri::State;
use crate::config::{load_or_init_layout, save_layout_file, default_layout};
use crate::db;
use crate::models::{
    CreateScheduleBlockInput, CreateTaskInput, DailyNote, DashboardMetrics,
    HabitDay, LayoutConfig, ScheduleBlock, Task, TimeAllocationItem, UpdateTaskInput,
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
pub async fn get_habit_matrix(
    _state: State<'_, Arc<AppState>>,
    _start_date: String,
) -> Result<Vec<HabitDay>, String> {
    // Generate 7-day habit status for default habits
    Ok(vec![
        HabitDay {
            habit_name: "Deep Focus (2h+)".to_string(),
            days: vec![true, true, true, false, true, true, true],
        },
        HabitDay {
            habit_name: "Morning Review".to_string(),
            days: vec![true, true, true, true, true, false, true],
        },
        HabitDay {
            habit_name: "Inbox Zero".to_string(),
            days: vec![false, true, true, true, true, false, false],
        },
        HabitDay {
            habit_name: "Read 20 pages".to_string(),
            days: vec![true, true, false, true, true, true, true],
        },
        HabitDay {
            habit_name: "Exercise / Walk".to_string(),
            days: vec![true, false, true, true, false, true, false],
        },
    ])
}

// Robust .ics parser
fn parse_ics_string(content: &str, default_date: Option<&str>) -> Vec<CreateScheduleBlockInput> {
    let mut blocks = Vec::new();
    let mut current_summary: Option<String> = None;
    let mut current_dtstart: Option<String> = None;
    let mut current_dtend: Option<String> = None;
    let mut current_category: Option<String> = None;
    let mut in_vevent = false;

    // Unfold lines (lines starting with space/tab are continuation)
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
                        // Default to 1 hour after start
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
    // 20261105 or 20261105T090000Z
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
