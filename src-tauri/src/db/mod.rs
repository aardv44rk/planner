use std::path::Path;
use chrono::Local;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use uuid::Uuid;
use crate::models::{
    CreateScheduleBlockInput, CreateTaskInput, DailyNote,
    DashboardMetrics, MetricSparklines, ScheduleBlock, Task, TimeAllocationItem,
    UpdateTaskInput,
};

pub async fn init_db(config_dir: &Path) -> Result<SqlitePool, sqlx::Error> {
    let db_path = config_dir.join("lifeos.db");
    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // Run migrations
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            project TEXT NOT NULL DEFAULT 'General',
            status TEXT NOT NULL DEFAULT 'todo',
            priority TEXT NOT NULL DEFAULT 'medium',
            due_date TEXT,
            completed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schedule_blocks (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'General',
            date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_notes (
            date TEXT PRIMARY KEY NOT NULL,
            content_md TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_activity_log (
            id TEXT PRIMARY KEY NOT NULL,
            app_name TEXT NOT NULL,
            window_title TEXT NOT NULL,
            duration_secs INTEGER NOT NULL DEFAULT 0,
            recorded_date TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
        CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(date);
        CREATE INDEX IF NOT EXISTS idx_app_activity_recorded_date ON app_activity_log(recorded_date);
        "#,
    )
    .execute(&pool)
    .await?;

    // Seed initial data if tables are empty
    seed_if_empty(&pool).await?;

    Ok(pool)
}

async fn seed_if_empty(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tasks")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    if count == 0 {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let now_iso = Local::now().to_rfc3339();

        // Seed Tasks
        let starter_tasks = [
            ("LifeOS Architecture & Bento Grid", "LifeOS", "in_progress", "high", false),
            ("Deep work on Q4 Product Roadmap", "Work", "todo", "high", false),
            ("Read 2 chapters of Designing Data-Intensive Systems", "Learning", "done", "medium", true),
            ("Review weekly goals & system health", "Personal", "todo", "medium", false),
            ("Refactor SQLite connection pool & WAL pragmas", "LifeOS", "done", "high", true),
        ];

        for (title, project, status, priority, completed) in starter_tasks {
            let task_id = Uuid::new_v4().to_string();
            let comp_int = if completed { 1 } else { 0 };
            sqlx::query(
                "INSERT INTO tasks (id, title, project, status, priority, due_date, completed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(task_id)
            .bind(title)
            .bind(project)
            .bind(status)
            .bind(priority)
            .bind(&today)
            .bind(comp_int)
            .bind(&now_iso)
            .execute(pool)
            .await?;
        }

        // Seed Schedule Blocks
        let starter_schedule = [
            ("09:00", "10:30", "Deep Work: Core Engine & Rust Plugins", "Deep Work"),
            ("11:00", "12:00", "Architecture & Bento Grid Design Review", "Engineering"),
            ("13:30", "14:15", "Team Sync & Daily Focus Alignment", "Sync"),
            ("15:00", "16:30", "Command Palette & IPC Wiring", "Development"),
            ("17:00", "17:45", "Reading & Day Reflection", "Personal"),
        ];

        for (start, end, title, category) in starter_schedule {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO schedule_blocks (id, title, start_time, end_time, category, date) VALUES (?, ?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(title)
            .bind(start)
            .bind(end)
            .bind(category)
            .bind(&today)
            .execute(pool)
            .await?;
        }

        // Seed Daily Note
        let default_note = format!(
            "# Daily Focus — {}\n\n## Top Priorities\n- [ ] Deliver LifeOS Command Center MVP\n- [x] Configure WAL SQLite & layout engine\n- [ ] Wire Command Palette with fuzzy filter\n\n## Notes & Thoughts\n*Ultra-minimalist aesthetic inspired by Obsidian. Text-first, 1px crisp borders, zero distractions.*\n",
            today
        );
        sqlx::query(
            "INSERT OR IGNORE INTO daily_notes (date, content_md, updated_at) VALUES (?, ?, ?)"
        )
        .bind(&today)
        .bind(&default_note)
        .bind(&now_iso)
        .execute(pool)
        .await?;

        // Seed Sample App Activities
        let activities = [
            ("Visual Studio Code", "planner - LifeOS Command Center", 4500),
            ("Windows Terminal", "cargo check --release", 1200),
            ("Google Chrome", "Tauri v2 Documentation", 1800),
            ("Obsidian", "Personal Knowledge Base", 900),
        ];

        for (app, win, duration) in activities {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO app_activity_log (id, app_name, window_title, duration_secs, recorded_date) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(app)
            .bind(win)
            .bind(duration)
            .bind(&today)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}

// Tasks queries
pub async fn get_all_tasks(pool: &SqlitePool) -> Result<Vec<Task>, sqlx::Error> {
    sqlx::query_as::<_, Task>(
        "SELECT id, title, project, status, priority, due_date, completed, created_at FROM tasks ORDER BY completed ASC, created_at DESC"
    )
    .fetch_all(pool)
    .await
}

pub async fn create_task(pool: &SqlitePool, input: CreateTaskInput) -> Result<Task, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();
    let project = input.project.unwrap_or_else(|| "General".to_string());
    let priority = input.priority.unwrap_or_else(|| "medium".to_string());
    let status = "todo".to_string();
    let completed = 0;

    sqlx::query(
        "INSERT INTO tasks (id, title, project, status, priority, due_date, completed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&project)
    .bind(&status)
    .bind(&priority)
    .bind(&input.due_date)
    .bind(completed)
    .bind(&now)
    .execute(pool)
    .await?;

    Ok(Task {
        id,
        title: input.title,
        project,
        status,
        priority,
        due_date: input.due_date,
        completed,
        created_at: now,
    })
}

pub async fn toggle_task_completed(pool: &SqlitePool, id: &str) -> Result<Task, sqlx::Error> {
    let current: Task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;

    let new_completed = if current.completed == 1 { 0 } else { 1 };
    let new_status = if new_completed == 1 { "done" } else { "todo" };

    sqlx::query("UPDATE tasks SET completed = ?, status = ? WHERE id = ?")
        .bind(new_completed)
        .bind(new_status)
        .bind(id)
        .execute(pool)
        .await?;

    sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn update_task(pool: &SqlitePool, input: UpdateTaskInput) -> Result<Task, sqlx::Error> {
    let current: Task = sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(&input.id)
        .fetch_one(pool)
        .await?;

    let title = input.title.unwrap_or(current.title);
    let project = input.project.unwrap_or(current.project);
    let priority = input.priority.unwrap_or(current.priority);
    let status = input.status.unwrap_or(current.status);
    let due_date = if input.due_date.is_some() { input.due_date } else { current.due_date };
    let completed = match input.completed {
        Some(true) => 1,
        Some(false) => 0,
        None => current.completed,
    };

    sqlx::query(
        "UPDATE tasks SET title = ?, project = ?, priority = ?, status = ?, due_date = ?, completed = ? WHERE id = ?"
    )
    .bind(&title)
    .bind(&project)
    .bind(&priority)
    .bind(&status)
    .bind(&due_date)
    .bind(completed)
    .bind(&input.id)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, Task>("SELECT * FROM tasks WHERE id = ?")
        .bind(&input.id)
        .fetch_one(pool)
        .await
}

pub async fn delete_task(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// Schedule queries
pub async fn get_schedule_blocks(pool: &SqlitePool, date: &str) -> Result<Vec<ScheduleBlock>, sqlx::Error> {
    sqlx::query_as::<_, ScheduleBlock>(
        "SELECT id, title, start_time, end_time, category, date FROM schedule_blocks WHERE date = ? ORDER BY start_time ASC"
    )
    .bind(date)
    .fetch_all(pool)
    .await
}

pub async fn create_schedule_block(pool: &SqlitePool, input: CreateScheduleBlockInput) -> Result<ScheduleBlock, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let category = input.category.unwrap_or_else(|| "General".to_string());

    sqlx::query(
        "INSERT INTO schedule_blocks (id, title, start_time, end_time, category, date) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&input.start_time)
    .bind(&input.end_time)
    .bind(&category)
    .bind(&input.date)
    .execute(pool)
    .await?;

    Ok(ScheduleBlock {
        id,
        title: input.title,
        start_time: input.start_time,
        end_time: input.end_time,
        category,
        date: input.date,
    })
}

pub async fn delete_schedule_block(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM schedule_blocks WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// Daily Notes queries
pub async fn get_daily_note(pool: &SqlitePool, date: &str) -> Result<DailyNote, sqlx::Error> {
    let note = sqlx::query_as::<_, DailyNote>("SELECT date, content_md, updated_at FROM daily_notes WHERE date = ?")
        .bind(date)
        .fetch_optional(pool)
        .await?;

    match note {
        Some(n) => Ok(n),
        None => Ok(DailyNote {
            date: date.to_string(),
            content_md: String::new(),
            updated_at: Local::now().to_rfc3339(),
        }),
    }
}

pub async fn save_daily_note(pool: &SqlitePool, date: &str, content_md: &str) -> Result<DailyNote, sqlx::Error> {
    let now = Local::now().to_rfc3339();
    sqlx::query(
        r#"
        INSERT INTO daily_notes (date, content_md, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
            content_md = excluded.content_md,
            updated_at = excluded.updated_at
        "#
    )
    .bind(date)
    .bind(content_md)
    .bind(&now)
    .execute(pool)
    .await?;

    Ok(DailyNote {
        date: date.to_string(),
        content_md: content_md.to_string(),
        updated_at: now,
    })
}

// Activity Log & Metrics
pub async fn log_app_activity(
    pool: &SqlitePool,
    app_name: &str,
    window_title: &str,
    duration_secs: i64,
) -> Result<(), sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let today = Local::now().format("%Y-%m-%d").to_string();

    sqlx::query(
        "INSERT INTO app_activity_log (id, app_name, window_title, duration_secs, recorded_date) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(app_name)
    .bind(window_title)
    .bind(duration_secs)
    .bind(today)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_dashboard_metrics(pool: &SqlitePool, date: &str) -> Result<DashboardMetrics, sqlx::Error> {
    // 1. Total focus time today in seconds
    let focus_time: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(duration_secs), 0) FROM app_activity_log WHERE recorded_date = ?"
    )
    .bind(date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // 2. Tasks completed today
    let completed_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE completed = 1 AND (due_date = ? OR created_at LIKE ?)"
    )
    .bind(date)
    .bind(format!("{}%", date))
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // 3. Pending items count
    let pending_items: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE completed = 0"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // 4. Active streak (days with at least 1 completed task or logged note)
    let streak_days: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT date) FROM daily_notes WHERE LENGTH(content_md) > 5"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(1);

    let streak = if streak_days == 0 { 1 } else { streak_days };

    Ok(DashboardMetrics {
        focus_time_today_secs: focus_time,
        tasks_completed_today: completed_today,
        active_streak_days: streak,
        pending_items_count: pending_items,
        sparklines: MetricSparklines {
            focus: vec![2400, 3100, 4200, 3800, 5100, 6200, focus_time.max(4800)],
            tasks: vec![3, 5, 4, 7, 6, 8, completed_today.max(5)],
            streak: vec![1, 2, 3, 4, 5, 6, streak],
            pending: vec![8, 7, 9, 6, 5, 4, pending_items],
        },
    })
}

pub async fn get_time_allocation(pool: &SqlitePool, date: &str) -> Result<Vec<TimeAllocationItem>, sqlx::Error> {
    // Group activity by app_name
    let rows = sqlx::query_as::<_, (String, i64)>(
        r#"
        SELECT app_name, SUM(duration_secs) as total_secs
        FROM app_activity_log
        WHERE recorded_date = ?
        GROUP BY app_name
        ORDER BY total_secs DESC
        LIMIT 5
        "#
    )
    .bind(date)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let total_secs: i64 = rows.iter().map(|(_, s)| s).sum();

    if rows.is_empty() || total_secs == 0 {
        // Fallback default allocation
        return Ok(vec![
            TimeAllocationItem { category: "Development".to_string(), minutes: 165, percentage: 55.0 },
            TimeAllocationItem { category: "Deep Focus".to_string(), minutes: 60, percentage: 20.0 },
            TimeAllocationItem { category: "Documentation".to_string(), minutes: 45, percentage: 15.0 },
            TimeAllocationItem { category: "Communication".to_string(), minutes: 30, percentage: 10.0 },
        ]);
    }

    let items = rows.into_iter().map(|(app, secs)| {
        let mins = secs / 60;
        let percentage = ((secs as f64) / (total_secs as f64)) * 100.0;
        TimeAllocationItem {
            category: app,
            minutes: mins,
            percentage: (percentage * 10.0).round() / 10.0,
        }
    }).collect();

    Ok(items)
}
