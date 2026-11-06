use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use directories::ProjectDirs;
use crate::models::LayoutConfig;

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
    let mut pane_sizes = HashMap::new();
    pane_sizes.insert("today-first".to_string(), 38.0);
    pane_sizes.insert("today-second".to_string(), 62.0);
    pane_sizes.insert("courses-first".to_string(), 32.0);
    pane_sizes.insert("courses-second".to_string(), 68.0);

    LayoutConfig {
        version: 8,
        active_workspace: "today".to_string(),
        sidebar_collapsed: false,
        pane_sizes,
        widgets: None,
        slots: None,
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
            // Migrate older layout versions (< 8) to resizable split-pane workspaces
            if layout.version < 8 {
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
