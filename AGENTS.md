# LifeOS Command Center - AI Developer Guidelines

## 1. Project Overview
A lightweight, native desktop personal command center tracking tasks, schedules, notes, and system metrics. Built with Tauri v2 (Rust backend) and a pure Vite + React + TypeScript SPA frontend. Strictly NO Next.js, NO SSR, and NO Electron.

## 2. Tech Stack & Architecture
*   **Backend:** Rust (2021 Edition) + Tauri v2.
*   **Async Runtime:** `tokio` for background worker threads and plugin polling.
*   **Local Database:** `SQLite` via `sqlx` (WAL mode enabled, local file stored in OS AppData/Config directory, migrations run on startup).
*   **Frontend:** Vite + React 18+ (TypeScript), strictly SPA.
*   **State Management:** `Zustand` for reactive UI state, synced with Rust via Tauri v2 `invoke` commands and `emit` events.
*   **Styling & Primitives:** Tailwind CSS + CSS Custom Properties for theming. `cmdk` (or Radix UI primitives) for the Command Palette, `lucide-react` for minimalist iconography.

## 3. Core Design & Layout Architecture
*   **Visual Aesthetic:** Ultra-minimalist, text-first Bento Grid layout inspired by Obsidian. Crisp `1px` borders, subtle hover states, zero heavy drop shadows.
*   **Dual Theme Engine:** Semantic CSS variables (`--bg-canvas`, `--bg-surface`, `--bg-elevated`, `--border-subtle`, `--text-primary`, `--text-muted`, `--accent`).
    *   *Light Mode (Default):* Warm paper/beige aesthetic (`#F5F4F0` canvas, `#ECEAE4` cards, `#DCD9D0` borders, `#1C1B18` ink text)[cite: 1].
    *   *Dark Mode:* Deep Obsidian slate (`#111214` canvas, `#18191C` cards, `#26282D` borders, `#E5E7EB` text).
*   **Layout-as-Data:** The 12-column CSS Bento Grid reads widget coordinates (`id`, `type`, `x`, `y`, `w`, `h`) from a local `layout.json` managed by Rust. No hardcoded layout positions.
*   **Plugin Trait System:** All background trackers implement a standard Rust `BackgroundPlugin` trait (`init`, `tick`, `shutdown`) so future modules (e.g., per-app desktop time tracking) can be registered without modifying core application state.

## 4. Coding Constraints
*   **Strict Separation:** Zero SQL or filesystem logic in React. All persistence, `.ics` parsing, and config loading happen in Rust.
*   **Error Handling:** Use `thiserror` / `anyhow` in Rust; serialize errors cleanly to strings/JSON for Tauri IPC responses. Never `.unwrap()` on user data or I/O operations.
*   **Tauri v2 Compliance:** Use `@tauri-apps/api/core` for `invoke` and configure permissions properly inside `src-tauri/capabilities/default.json`.