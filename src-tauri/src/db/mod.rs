use std::path::Path;
use chrono::{Datelike, Duration, Local, NaiveDate};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use uuid::Uuid;
use crate::models::{
    ActivitySummary, Assignment, Course, CreateScheduleBlockInput, CreateTaskInput, DailyNote,
    DashboardMetrics, Habit, HabitDay, MetricSparklines, ScheduleBlock, Task,
    TimeAllocationItem, UpdateTaskInput,
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
            created_at TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            external_id TEXT
        );

        CREATE TABLE IF NOT EXISTS schedule_blocks (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'General',
            date TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'manual',
            external_id TEXT
        );

        CREATE TABLE IF NOT EXISTS courses (
            id TEXT PRIMARY KEY NOT NULL,
            code TEXT NOT NULL,
            title TEXT NOT NULL,
            instructor TEXT NOT NULL DEFAULT '',
            schedule TEXT NOT NULL DEFAULT '',
            room TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '#2f5fd0',
            term TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assignments (
            id TEXT PRIMARY KEY NOT NULL,
            course_id TEXT NOT NULL,
            title TEXT NOT NULL,
            due_date TEXT NOT NULL,
            due_text TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            weight TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            handout_name TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL,
            instructions_html TEXT,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
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

        CREATE TABLE IF NOT EXISTS habits (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS habit_completions (
            habit_id TEXT NOT NULL,
            date TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (habit_id, date),
            FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sync_metadata (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS quick_notes (
            id TEXT PRIMARY KEY NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
        CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(date);
        CREATE INDEX IF NOT EXISTS idx_app_activity_recorded_date ON app_activity_log(recorded_date);
        CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON habit_completions(date);
        CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);
        CREATE INDEX IF NOT EXISTS idx_quick_notes_created_at ON quick_notes(created_at);
        "#,
    )
    .execute(&pool)
    .await?;

    // Safe column migrations for existing databases
    let _ = sqlx::query("ALTER TABLE tasks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'")
        .execute(&pool)
        .await;
    let _ = sqlx::query("ALTER TABLE tasks ADD COLUMN external_id TEXT")
        .execute(&pool)
        .await;
    let _ = sqlx::query("ALTER TABLE schedule_blocks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'")
        .execute(&pool)
        .await;
    let _ = sqlx::query("ALTER TABLE schedule_blocks ADD COLUMN external_id TEXT")
        .execute(&pool)
        .await;
    let _ = sqlx::query("ALTER TABLE assignments ADD COLUMN instructions_html TEXT")
        .execute(&pool)
        .await;

    // Seed initial data if tables are empty
    seed_if_empty(&pool).await?;

    Ok(pool)
}

async fn seed_if_empty(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM tasks")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    let today = Local::now().format("%Y-%m-%d").to_string();
    let now_iso = Local::now().to_rfc3339();

    if count == 0 {
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

    // Seed habits if empty
    let habit_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM habits")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    if habit_count == 0 {
        let starter_habits = [
            "Deep Focus (2h+)",
            "Morning Review",
            "Inbox Zero",
            "Read 20 pages",
            "Exercise / Walk",
        ];

        for name in starter_habits {
            let habit_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO habits (id, name, created_at) VALUES (?, ?, ?)")
                .bind(&habit_id)
                .bind(name)
                .bind(&now_iso)
                .execute(pool)
                .await?;

            // Mark completion for today and yesterday as initial streak
            sqlx::query("INSERT OR IGNORE INTO habit_completions (habit_id, date, completed) VALUES (?, ?, 1)")
                .bind(&habit_id)
                .bind(&today)
                .execute(pool)
                .await?;
        }
    }

    // Seed quick notes if empty
    let qn_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM quick_notes")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    if qn_count == 0 {
        let starter_notes = [
            "Review SQLite WAL mode checkpoint",
            "Verify zero scroll on Bento grid",
            "Obsidian text-first aesthetic",
        ];
        for note in starter_notes {
            let note_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO quick_notes (id, content, created_at) VALUES (?, ?, ?)")
                .bind(&note_id)
                .bind(note)
                .bind(&now_iso)
                .execute(pool)
                .await?;
        }
    }

    Ok(())
}

// Tasks queries
pub async fn get_all_tasks(pool: &SqlitePool) -> Result<Vec<Task>, sqlx::Error> {
    sqlx::query_as::<_, Task>(
        "SELECT id, title, project, status, priority, due_date, completed, created_at FROM tasks ORDER BY completed ASC, CASE WHEN due_date IS NULL OR due_date = '' THEN 1 ELSE 0 END ASC, due_date ASC, created_at DESC"
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
        source: Some("manual".to_string()),
        external_id: None,
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

pub async fn get_schedule_blocks_range(
    pool: &SqlitePool,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<ScheduleBlock>, sqlx::Error> {
    sqlx::query_as::<_, ScheduleBlock>(
        "SELECT id, title, start_time, end_time, category, date FROM schedule_blocks WHERE date >= ? AND date <= ? ORDER BY date ASC, start_time ASC"
    )
    .bind(start_date)
    .bind(end_date)
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
        source: Some("manual".to_string()),
        external_id: None,
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

pub async fn get_daily_notes_dates(pool: &SqlitePool) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String,)>(
        "SELECT date FROM daily_notes ORDER BY date DESC LIMIT 20"
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(d,)| d).collect())
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
    let focus_time: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(duration_secs), 0) FROM app_activity_log WHERE recorded_date = ?"
    )
    .bind(date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let completed_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE completed = 1 AND (due_date = ? OR created_at LIKE ?)"
    )
    .bind(date)
    .bind(format!("{}%", date))
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let pending_items: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE completed = 0"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

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
    let rows = sqlx::query_as::<_, (String, i64)>(
        r#"
        SELECT app_name, SUM(duration_secs) as total_secs
        FROM app_activity_log
        WHERE recorded_date = ?
        GROUP BY app_name
        ORDER BY total_secs DESC
        LIMIT 6
        "#
    )
    .bind(date)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let total_secs: i64 = rows.iter().map(|(_, s)| s).sum();

    if rows.is_empty() || total_secs == 0 {
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

pub async fn get_activity_summary(pool: &SqlitePool, date: &str) -> Result<ActivitySummary, sqlx::Error> {
    let focus_time: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(duration_secs), 0) FROM app_activity_log WHERE recorded_date = ?"
    )
    .bind(date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let completed_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE completed = 1 AND (due_date = ? OR created_at LIKE ?)"
    )
    .bind(date)
    .bind(format!("{}%", date))
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM tasks WHERE completed = 0"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let streak: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT date) FROM daily_notes WHERE LENGTH(content_md) > 5"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(1);

    let top_apps = get_time_allocation(pool, date).await.unwrap_or_default();

    Ok(ActivitySummary {
        total_focus_secs: focus_time,
        tasks_completed_today: completed_today,
        pending_tasks_count: pending,
        active_streak_days: streak.max(1),
        top_apps,
    })
}

// Habits queries & completions
pub async fn get_habits_with_days(pool: &SqlitePool, anchor_date: &str) -> Result<Vec<HabitDay>, sqlx::Error> {
    let habits = sqlx::query_as::<_, Habit>("SELECT id, name, created_at FROM habits ORDER BY created_at ASC")
        .fetch_all(pool)
        .await?;

    let parsed_anchor = NaiveDate::parse_from_str(anchor_date, "%Y-%m-%d")
        .unwrap_or_else(|_| Local::now().date_naive());

    // Compute the 7 days of the week containing anchor_date (Monday to Sunday)
    let weekday = parsed_anchor.weekday().num_days_from_monday();
    let monday = parsed_anchor - Duration::days(weekday as i64);

    let mut week_dates = Vec::with_capacity(7);
    for i in 0..7 {
        let d = monday + Duration::days(i);
        week_dates.push(d.format("%Y-%m-%d").to_string());
    }

    let mut result = Vec::new();

    for habit in habits {
        let mut days = Vec::with_capacity(7);
        for date_str in &week_dates {
            let completed_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM habit_completions WHERE habit_id = ? AND date = ? AND completed = 1"
            )
            .bind(&habit.id)
            .bind(date_str)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

            days.push(completed_count > 0);
        }

        result.push(HabitDay {
            id: habit.id,
            habit_name: habit.name,
            days,
        });
    }

    Ok(result)
}

pub async fn toggle_habit_day(pool: &SqlitePool, habit_id: &str, date: &str) -> Result<bool, sqlx::Error> {
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM habit_completions WHERE habit_id = ? AND date = ?"
    )
    .bind(habit_id)
    .bind(date)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    if exists > 0 {
        sqlx::query("DELETE FROM habit_completions WHERE habit_id = ? AND date = ?")
            .bind(habit_id)
            .bind(date)
            .execute(pool)
            .await?;
        Ok(false)
    } else {
        sqlx::query("INSERT INTO habit_completions (habit_id, date, completed) VALUES (?, ?, 1)")
            .bind(habit_id)
            .bind(date)
            .execute(pool)
            .await?;
        Ok(true)
    }
}

pub async fn create_habit(pool: &SqlitePool, name: &str) -> Result<Habit, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let now = Local::now().to_rfc3339();

    sqlx::query("INSERT INTO habits (id, name, created_at) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(name)
        .bind(&now)
        .execute(pool)
        .await?;

    Ok(Habit {
        id,
        name: name.to_string(),
        created_at: now,
    })
}

pub async fn get_courses(pool: &SqlitePool) -> Result<Vec<Course>, sqlx::Error> {
    let mut courses = sqlx::query_as::<_, Course>(
        "SELECT id, code, title, instructor, schedule, room, color, term, updated_at FROM courses ORDER BY code ASC"
    )
    .fetch_all(pool)
    .await?;

    for course in &mut courses {
        let assignments = sqlx::query_as::<_, Assignment>(
            "SELECT id, course_id, title, due_date, due_text, status, weight, description, handout_name, updated_at, instructions_html FROM assignments WHERE course_id = ? ORDER BY due_date ASC"
        )
        .bind(&course.id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        course.assignments = assignments;
    }

    Ok(courses)
}

// ==========================================
// Sync Metadata & Quick Notes Functions
// ==========================================

pub async fn set_sync_meta(pool: &SqlitePool, key: &str, value: &str) -> Result<(), sqlx::Error> {
    let now = chrono::Local::now().to_rfc3339();
    sqlx::query(
        r#"
        INSERT INTO sync_metadata (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        "#
    )
    .bind(key)
    .bind(value)
    .bind(&now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_sync_meta(pool: &SqlitePool, key: &str) -> Result<Option<String>, sqlx::Error> {
    let res: Option<(String,)> = sqlx::query_as("SELECT value FROM sync_metadata WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;
    Ok(res.map(|(v,)| v))
}

pub async fn get_all_quick_notes(pool: &SqlitePool) -> Result<Vec<crate::models::QuickNote>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::QuickNote>(
        "SELECT id, content, created_at FROM quick_notes ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await
}

pub async fn create_quick_note(pool: &SqlitePool, content: &str) -> Result<crate::models::QuickNote, sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Local::now().to_rfc3339();
    sqlx::query("INSERT INTO quick_notes (id, content, created_at) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(content)
        .bind(&now)
        .execute(pool)
        .await?;

    Ok(crate::models::QuickNote {
        id,
        content: content.to_string(),
        created_at: now,
    })
}

pub async fn delete_quick_note(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM quick_notes WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}


