use std::fs;
use std::path::{Path, PathBuf};
use directories::ProjectDirs;
use crate::models::{LayoutConfig, WidgetConfig};

pub fn get_app_config_dir() -> Result<PathBuf, std::io::Error> {
    let proj_dirs = ProjectDirs::from("com", "lifeos", "LifeOS")
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "Unable to resolve OS app data directory"))?;
    let config_dir = proj_dirs.config_dir().to_path_buf();
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)?;
    }
    Ok(config_dir)
}

pub fn default_layout() -> LayoutConfig {
    LayoutConfig {
        version: 1,
        widgets: vec![
            WidgetConfig {
                id: "widget-kpis".to_string(),
                widget_type: "kpi_strip".to_string(),
                title: "Key Performance Indicators".to_string(),
                x: 0,
                y: 0,
                w: 12,
                h: 1,
                visible: true,
            },
            WidgetConfig {
                id: "widget-schedule".to_string(),
                widget_type: "schedule".to_string(),
                title: "Schedule & Agenda".to_string(),
                x: 0,
                y: 1,
                w: 3,
                h: 2,
                visible: true,
            },
            WidgetConfig {
                id: "widget-scratchpad".to_string(),
                widget_type: "scratchpad".to_string(),
                title: "Daily Scratchpad".to_string(),
                x: 3,
                y: 1,
                w: 5,
                h: 1,
                visible: true,
            },
            WidgetConfig {
                id: "widget-projects".to_string(),
                widget_type: "projects".to_string(),
                title: "Active Projects".to_string(),
                x: 3,
                y: 2,
                w: 5,
                h: 1,
                visible: true,
            },
            WidgetConfig {
                id: "widget-tasks".to_string(),
                widget_type: "tasks".to_string(),
                title: "Today's Tasks".to_string(),
                x: 8,
                y: 1,
                w: 4,
                h: 2,
                visible: true,
            },
            WidgetConfig {
                id: "widget-time-allocation".to_string(),
                widget_type: "time_allocation".to_string(),
                title: "Time Allocation".to_string(),
                x: 0,
                y: 3,
                w: 4,
                h: 1,
                visible: true,
            },
            WidgetConfig {
                id: "widget-habit-matrix".to_string(),
                widget_type: "habit_matrix".to_string(),
                title: "Habit & Streak Grid".to_string(),
                x: 4,
                y: 3,
                w: 5,
                h: 1,
                visible: true,
            },
            WidgetConfig {
                id: "widget-quick-notes".to_string(),
                widget_type: "quick_notes".to_string(),
                title: "Quick Notes".to_string(),
                x: 9,
                y: 3,
                w: 3,
                h: 1,
                visible: true,
            },
        ],
    }
}

pub fn load_or_init_layout(config_dir: &Path) -> Result<LayoutConfig, Box<dyn std::error::Error + Send + Sync>> {
    let layout_file = config_dir.join("layout.json");
    if !layout_file.exists() {
        let def = default_layout();
        let serialized = serde_json::to_string_pretty(&def)?;
        fs::write(&layout_file, serialized)?;
        return Ok(def);
    }

    let contents = fs::read_to_string(&layout_file)?;
    match serde_json::from_str::<LayoutConfig>(&contents) {
        Ok(layout) => Ok(layout),
        Err(err) => {
            eprintln!("Warning: failed to parse layout.json ({err}). Resetting to default.");
            let def = default_layout();
            let serialized = serde_json::to_string_pretty(&def)?;
            fs::write(&layout_file, serialized)?;
            Ok(def)
        }
    }
}

pub fn save_layout_file(config_dir: &Path, layout: &LayoutConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let layout_file = config_dir.join("layout.json");
    let serialized = serde_json::to_string_pretty(layout)?;
    fs::write(&layout_file, serialized)?;
    Ok(())
}
