pub mod auth;
pub mod commands;
pub mod config;
pub mod db;
pub mod lms;
pub mod models;
pub mod plugins;

use std::path::PathBuf;
use std::sync::Arc;
use sqlx::SqlitePool;

pub struct AppState {
    pub db: SqlitePool,
    pub config_dir: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_dir = config::get_app_config_dir().expect("Failed to resolve config directory");
    let db_pool = tauri::async_runtime::block_on(async {
        db::init_db(&config_dir)
            .await
            .expect("Failed to initialize SQLite database")
    });

    let _ = config::load_or_init_layout(&config_dir);

    let app_state = Arc::new(AppState {
        db: db_pool.clone(),
        config_dir,
    });

    tauri::Builder::default()
        .manage(app_state)
        .setup(move |app| {
            // Start background plugins engine (Desktop Tracker, etc.)
            let plugins: Vec<Box<dyn plugins::BackgroundPlugin>> = vec![
                Box::new(plugins::WindowTrackerPlugin::new()),
            ];
            plugins::start_plugin_engine(app.handle().clone(), db_pool, plugins);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Layout
            commands::get_layout,
            commands::save_layout,
            commands::reset_layout,
            // Tasks
            commands::get_tasks,
            commands::create_task,
            commands::toggle_task,
            commands::update_task,
            commands::delete_task,
            // Schedule
            commands::get_schedule_blocks,
            commands::get_schedule_blocks_range,
            commands::create_schedule_block,
            commands::delete_schedule_block,
            commands::import_ics,
            // Daily Notes
            commands::get_daily_note,
            commands::save_daily_note,
            commands::get_daily_notes_dates,
            // Analytics
            commands::get_dashboard_metrics,
            commands::get_time_allocation,
            commands::get_activity_summary,
            // Habits
            commands::get_habits,
            commands::get_habit_matrix,
            commands::toggle_habit_day,
            commands::create_habit,
            // Science Tokyo LMS & Auth
            commands::save_credentials,
            commands::save_matrix_card,
            commands::get_credential_status,
            commands::clear_credentials,
            commands::sync_lms,
            commands::get_lms_sync_state,
            commands::login_titech,
            commands::get_courses,
            commands::upload_assignment,
            commands::pick_assignment_file,
            commands::pick_and_upload_assignment,
            commands::get_current_totp,
            commands::verify_totp_seed,
            commands::save_totp_seed,
            // Quick Notes
            commands::get_quick_notes,
            commands::create_quick_note,
            commands::delete_quick_note,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running LifeOS Command Center");
}
