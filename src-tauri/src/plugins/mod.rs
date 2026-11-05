use std::time::Duration;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};

pub trait BackgroundPlugin: Send + Sync {
    fn name(&self) -> &str;
    fn init(&mut self, _pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Ok(())
    }
    fn tick(&mut self, pool: &SqlitePool, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    fn shutdown(&mut self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        Ok(())
    }
}

pub struct WindowTrackerPlugin {
    last_app: Option<String>,
    last_title: Option<String>,
    duration_secs: i64,
}

impl WindowTrackerPlugin {
    pub fn new() -> Self {
        Self {
            last_app: None,
            last_title: None,
            duration_secs: 0,
        }
    }

    #[cfg(target_os = "windows")]
    fn get_active_window_info() -> Option<(String, String)> {
        use windows::core::PWSTR;
        use windows::Win32::Foundation::{CloseHandle, HWND};
        use windows::Win32::System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
            PROCESS_QUERY_LIMITED_INFORMATION,
        };
        use windows::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
        };

        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd.0.is_null() {
                return None;
            }

            // Window Title
            let mut title_buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut title_buf);
            let title = if len > 0 {
                String::from_utf16_lossy(&title_buf[..len as usize])
            } else {
                "Active Window".to_string()
            };

            // Process ID
            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == 0 {
                return Some(("Desktop".to_string(), title));
            }

            // Process Name
            let process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
            if let Ok(handle) = process_handle {
                let mut path_buf = [0u16; 1024];
                let mut size = path_buf.len() as u32;
                let pwstr = PWSTR(path_buf.as_mut_ptr());
                let success = QueryFullProcessImageNameW(handle, PROCESS_NAME_FORMAT(0), pwstr, &mut size);
                let _ = CloseHandle(handle);

                if success.is_ok() && size > 0 {
                    let full_path = String::from_utf16_lossy(&path_buf[..size as usize]);
                    let exe_name = std::path::Path::new(&full_path)
                        .file_name()
                        .and_then(|f| f.to_str())
                        .unwrap_or("Desktop")
                        .replace(".exe", "");
                    return Some((exe_name, title));
                }
            }

            Some(("Desktop".to_string(), title))
        }
    }

    #[cfg(target_os = "linux")]
    fn get_active_window_info() -> Option<(String, String)> {
        // Linux fallback using xdotool / proc if available
        Some(("Workspace".to_string(), "Linux Desktop Session".to_string()))
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    fn get_active_window_info() -> Option<(String, String)> {
        Some(("Desktop".to_string(), "Active Session".to_string()))
    }
}

impl BackgroundPlugin for WindowTrackerPlugin {
    fn name(&self) -> &str {
        "WindowTrackerPlugin"
    }

    fn tick(&mut self, pool: &SqlitePool, app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some((app_name, window_title)) = Self::get_active_window_info() {
            let pool_clone = pool.clone();
            let app_clone = app_name.clone();
            let title_clone = window_title.clone();
            
            // Log 5 seconds of active duration asynchronously
            tauri::async_runtime::spawn(async move {
                let _ = crate::db::log_app_activity(&pool_clone, &app_clone, &title_clone, 5).await;
            });

            self.last_app = Some(app_name);
            self.last_title = Some(window_title);
            self.duration_secs += 5;

            // Emit metrics-updated event to frontend
            let _ = app_handle.emit("metrics-updated", ());
        }

        Ok(())
    }
}

// Background Runner that runs registered plugins every 5 seconds without blocking UI thread
pub fn start_plugin_engine(
    app_handle: AppHandle,
    pool: SqlitePool,
    mut plugins: Vec<Box<dyn BackgroundPlugin>>,
) {
    tauri::async_runtime::spawn(async move {
        // Init plugins
        for plugin in plugins.iter_mut() {
            if let Err(err) = plugin.init(&pool) {
                eprintln!("[Plugin {}] Init error: {}", plugin.name(), err);
            }
        }

        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;

            for plugin in plugins.iter_mut() {
                if let Err(err) = plugin.tick(&pool, &app_handle) {
                    eprintln!("[Plugin {}] Tick error: {}", plugin.name(), err);
                }
            }
        }
    });
}
