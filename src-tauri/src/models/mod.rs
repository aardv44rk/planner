use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

fn default_true() -> bool {
    true
}

fn default_manual() -> Option<String> {
    Some("manual".to_string())
}

fn default_workspace() -> String {
    "home".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub project: String,
    pub status: String,
    pub priority: String,
    pub due_date: Option<String>,
    pub completed: i64,
    pub created_at: String,
    #[serde(default = "default_manual")]
    #[sqlx(default)]
    pub source: Option<String>,
    #[sqlx(default)]
    pub external_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskInput {
    pub title: String,
    pub project: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: Option<String>,
    pub project: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<String>,
    pub completed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ScheduleBlock {
    pub id: String,
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub category: String,
    pub date: String,
    #[serde(default = "default_manual")]
    #[sqlx(default)]
    pub source: Option<String>,
    #[sqlx(default)]
    pub external_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Course {
    pub id: String,
    pub code: String,
    pub title: String,
    pub instructor: String,
    pub schedule: String,
    pub room: String,
    pub color: String,
    #[serde(default)]
    pub term: String,
    pub updated_at: String,
    #[serde(default)]
    #[sqlx(skip)]
    pub assignments: Vec<Assignment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Assignment {
    pub id: String,
    pub course_id: String,
    pub title: String,
    pub due_date: String,
    pub due_text: String,
    pub status: String,
    pub weight: String,
    pub description: String,
    pub handout_name: String,
    pub updated_at: String,
    #[serde(default)]
    #[sqlx(default)]
    pub instructions_html: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateScheduleBlockInput {
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub category: Option<String>,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DailyNote {
    pub date: String,
    pub content_md: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AppActivityLog {
    pub id: String,
    pub app_name: String,
    pub window_title: String,
    pub duration_secs: i64,
    pub recorded_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetConfig {
    pub id: String,
    #[serde(rename = "type")]
    pub widget_type: String,
    pub title: String,
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
    #[serde(rename = "minW", default)]
    pub min_w: Option<u32>,
    #[serde(rename = "minH", default)]
    pub min_h: Option<u32>,
    #[serde(default = "default_true")]
    pub visible: bool,
    #[serde(default = "default_workspace")]
    pub workspace: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridSlot {
    pub id: String,
    #[serde(rename = "colSpan")]
    pub col_span: u32,
    #[serde(rename = "rowSpan")]
    pub row_span: u32,
    #[serde(rename = "widgetId")]
    pub widget_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    pub version: u32,
    #[serde(default = "default_workspace")]
    pub active_workspace: String,
    #[serde(default)]
    pub sidebar_collapsed: bool,
    #[serde(default)]
    pub pane_sizes: HashMap<String, f64>,
    #[serde(default)]
    pub widgets: Option<Vec<WidgetConfig>>,
    #[serde(default)]
    pub slots: Option<Vec<GridSlot>>,
    #[serde(default)]
    pub workspaces: Option<HashMap<String, Vec<WidgetConfig>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardMetrics {
    pub focus_time_today_secs: i64,
    pub tasks_completed_today: i64,
    pub active_streak_days: i64,
    pub pending_items_count: i64,
    pub sparklines: MetricSparklines,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSparklines {
    pub focus: Vec<i64>,
    pub tasks: Vec<i64>,
    pub streak: Vec<i64>,
    pub pending: Vec<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeAllocationItem {
    pub category: String,
    pub minutes: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateHabitInput {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitDay {
    pub id: String,
    pub habit_name: String,
    pub days: Vec<bool>, // 7 days (e.g. Mon-Sun)
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct QuickNote {
    pub id: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LmsSyncState {
    pub active_academic_year: String,
    pub active_quarter: String,
    pub last_synced_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PickedFileResult {
    pub path: String,
    pub name: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivitySummary {
    pub total_focus_secs: i64,
    pub tasks_completed_today: i64,
    pub pending_tasks_count: i64,
    pub active_streak_days: i64,
    pub top_apps: Vec<TimeAllocationItem>,
}
