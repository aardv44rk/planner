use std::path::{Path, PathBuf};
use crate::command_error::CommandError;
use tauri::{AppHandle, Manager};

/// Resolves the default cache directory for downloaded LMS course materials and handouts.
pub fn get_materials_dir(config_dir: &Path) -> PathBuf {
    let dir = config_dir.join("materials");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

/// Converts a local filesystem path into an `lms://localhost/file?path=...` asset URL.
pub fn to_lms_asset_url(path: &Path) -> String {
    let raw_path = path.to_string_lossy().to_string();
    let mut serializer = url::form_urlencoded::Serializer::new(String::new());
    serializer.append_pair("path", &raw_path);
    format!("lms://localhost/file?{}", serializer.finish())
}

#[tauri::command]
pub async fn get_lms_file_url(file_path: String) -> Result<String, CommandError> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(CommandError::not_found(format!("File does not exist: {}", file_path)));
    }
    Ok(to_lms_asset_url(&path))
}

#[tauri::command]
pub async fn get_materials_root(app: AppHandle) -> Result<String, CommandError> {
    let app_config = app
        .path()
        .app_config_dir()
        .map_err(|e| CommandError::internal(e.to_string()))?;
    let dir = get_materials_dir(&app_config);
    Ok(dir.to_string_lossy().to_string())
}
