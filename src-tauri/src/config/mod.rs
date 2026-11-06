use std::fs;
use std::path::{Path, PathBuf};
use directories::ProjectDirs;
use crate::models::{GridSlot, LayoutConfig};

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
        version: 6,
        active_workspace: "home".to_string(),
        widgets: vec![],
        slots: Some(vec![
            GridSlot { id: "slot-1".to_string(), col_span: 12, row_span: 1, widget_id: Some("kpi_strip".to_string()) },
            GridSlot { id: "slot-2".to_string(), col_span: 8, row_span: 2, widget_id: Some("schedule".to_string()) },
            GridSlot { id: "slot-3".to_string(), col_span: 4, row_span: 2, widget_id: Some("tasks".to_string()) },
            GridSlot { id: "slot-4".to_string(), col_span: 4, row_span: 2, widget_id: Some("scratchpad".to_string()) },
            GridSlot { id: "slot-5".to_string(), col_span: 4, row_span: 2, widget_id: Some("projects".to_string()) },
            GridSlot { id: "slot-6".to_string(), col_span: 4, row_span: 2, widget_id: Some("time_allocation".to_string()) },
            GridSlot { id: "slot-7".to_string(), col_span: 6, row_span: 2, widget_id: Some("habit_matrix".to_string()) },
            GridSlot { id: "slot-8".to_string(), col_span: 6, row_span: 2, widget_id: Some("quick_notes".to_string()) },
        ]),
        workspaces: None,
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
        Ok(layout) => {
            // Migrate older layout versions (< 6) to Slot-Swapping dashboard layout
            if layout.version < 6 || layout.slots.is_none() {
                let def = default_layout();
                let serialized = serde_json::to_string_pretty(&def)?;
                let _ = fs::write(&layout_file, serialized);
                return Ok(def);
            }
            Ok(layout)
        }
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
