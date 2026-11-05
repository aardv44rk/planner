use serde::{Deserialize, Serialize};
use sqlx::FromRow;

fn default_true() -> bool {
    true
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
    #[serde(default = "default_true")]
    pub visible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutConfig {
    pub version: u32,
    pub widgets: Vec<WidgetConfig>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitDay {
    pub habit_name: String,
    pub days: Vec<bool>, // 7 days (e.g. Mon-Sun)
}
