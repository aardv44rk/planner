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
        // Attempt xdotool first (X11)
        if let Ok(output) = std::process::Command::new("xdotool")
            .args(["getactivewindow", "getwindowname"])
            .output()
        {
            if output.status.success() {
                let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !title.is_empty() {
                    let app = if let Ok(pid_output) = std::process::Command::new("xdotool")
                        .args(["getactivewindow", "getwindowpid"])
                        .output()
                    {
                        if pid_output.status.success() {
                            let pid_str = String::from_utf8_lossy(&pid_output.stdout).trim().to_string();
                            if let Ok(comm) = std::fs::read_to_string(format!("/proc/{}/comm", pid_str)) {
                                comm.trim().to_string()
                            } else {
                                "Linux App".to_string()
                            }
                        } else {
                            "Linux App".to_string()
                        }
                    } else {
                        "Linux App".to_string()
                    };
                    return Some((app, title));
                }
            }
        }

        // Attempt hyprctl for Wayland / Hyprland
        if let Ok(output) = std::process::Command::new("hyprctl")
            .args(["activewindow", "-j"])
            .output()
        {
            if output.status.success() {
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                    let class = json.get("class").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let title = json.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if !class.is_empty() || !title.is_empty() {
                        let app = if class.is_empty() { "Wayland App".to_string() } else { class };
                        return Some((app, title));
                    }
                }
            }
        }

        // Attempt xprop as secondary X11 check
        if let Ok(output) = std::process::Command::new("xprop")
            .args(["-root", "_NET_ACTIVE_WINDOW"])
            .output()
        {
            if output.status.success() {
                let out = String::from_utf8_lossy(&output.stdout);
                if let Some(id_str) = out.split_whitespace().last() {
                    if let Ok(win_out) = std::process::Command::new("xprop")
                        .args(["-id", id_str, "WM_NAME", "WM_CLASS"])
                        .output()
                    {
                        if win_out.status.success() {
                            let text = String::from_utf8_lossy(&win_out.stdout);
                            let title = text.lines()
                                .find(|l| l.starts_with("WM_NAME"))
                                .and_then(|l| l.split('=').nth(1))
                                .map(|s| s.trim().trim_matches('"').to_string())
                                .unwrap_or_else(|| "Window".to_string());
                            let app = text.lines()
                                .find(|l| l.starts_with("WM_CLASS"))
                                .and_then(|l| l.split('=').nth(1))
                                .and_then(|s| s.split(',').last())
                                .map(|s| s.trim().trim_matches('"').to_string())
                                .unwrap_or_else(|| "Linux App".to_string());
                            if !title.is_empty() {
                                return Some((app, title));
                            }
                        }
                    }
                }
            }
        }

        // Return None if no active window tool succeeds so app_activity_log is never polluted with fake entries
        None
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    fn get_active_window_info() -> Option<(String, String)> {
        None
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
