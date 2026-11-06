# AGENTS.md

Rules for any coding agent (Antigravity / Gemini 3.8 Flash, Claude Code, Codex) working in `planner`.

## 1. Execution & Token Economy (Gemini 3.8 Flash Optimization)

Latency and context window are your tightest constraints.

- **Zero Preamble / Postamble:** Start immediately with tool calls or code edits. Do not narrate what you are about to do or summarize what you just did.
- **Batch Reads & Surgical Diffs:** Batch multiple file reads into a single turn. Never read `package-lock.json`, `Cargo.lock`, `dist/`, or `src-tauri/gen/`. Use targeted search-and-replace blocks rather than rewriting whole files.
- **One Phase Per Turn:** Implement at most 3–5 files per turn, run the fastest verification check, and stop.

## 2. Use Existing Libraries Before Writing Your Own

If an existing dependency or well-maintained library solves the problem, use it instead of hand-rolling an equivalent:
- Server/IPC state & caching: `@tanstack/react-query`
- Routing: `react-router`
- Notifications/Toasts & Overlays: Radix UI primitives
- Page keep-alive: React's `<Activity>` (inside `KeptPage.tsx`)

Write custom code only when no suitable library exists, and state why in a one-line comment.

## 3. Core Decides, Shells Render

`src-tauri` owns domain decisions, SQLite mutations, LMS sync orchestration, and read models. The React frontend renders read models, forwards user intents, and manages strictly ephemeral UI layout state (`layoutStore.ts`, `themeStore.ts`).

- **No Parallel State Machines:** Do not copy SQLite rows into Zustand stores or re-implement domain filtering/sorting in TypeScript when Rust can return the read model directly.
- **Single IPC Gateway:** UI components must never import `invoke` from `@tauri-apps/api/core`. All calls go through `traced-tauri-core.ts` -> TanStack Query hooks in `src/platform/`.
- **Typed Errors, Zero Panics:** All `#[tauri::command]` functions return `Result<T, CommandError>`. Do not use `.unwrap()`, `.expect()`, or `panic!()` in non-test Rust code. Enable `clippy::unwrap_used` and `clippy::expect_used` denies on migrated modules.
- **Stream Heavy Assets:** Serve PDFs and course attachments via a custom Tauri URI protocol (`lms://`), never as base64 or `Vec<u8>` over IPC.

## 4. Isolate Native Differences at Compile Time

Separate OS-specific behaviour at build time, never with runtime heuristics:
- Use Rust `#[cfg(target_os = "...")]` and per-platform modules for OS integrations (keychain, filesystem paths, webkit/webview tweaks).
- Never inspect `navigator.userAgent`, `navigator.platform`, or walk candidate file paths across OSes at runtime. If a required platform resource is missing, fail with a clear `CommandError` instead of guessing.
- Responsive CSS/pane sizing (`ResizableWorkspace`) is a layout decision and is allowed.

## 5. Extract Shared Logic Behind One Interface

When two views or widgets (`TodayWorkspace` and `TasksView`, `ScheduleWidget` and `ScheduleView`) need the same formatting, deadline calculation, or mutation behaviour, put it in one module with one interface. Do not copy-paste component or hook logic.

## 6. Keep Every Test in One Place & Pick the Right Layer

- **Frontend Tests (`tests/`):** All TS/JS tests live under `tests/`, grouped by behaviour—never `*.test.ts(x)` next to source files.
  - `tests/unit/` tests pure functions/utilities and **never** mounts a React component.
  - `tests/e2e/` mounts the real application shell over the scripted IPC harness (`tests/harness/`).
- **Rust Tests (`src-tauri/src/tests/`):** All Rust test files live in `src-tauri/src/tests/`, declared as child modules of the code they test so private items stay reachable.
- **Real Over Mock:** Use the shared IPC harness or an in-memory SQLite DB (`Connection::open_in_memory()`) instead of mocking internal functions.
- **Every Test Must Earn Its Place:** Do not write trivial getter/literal assertions. Before adding a test, name the bug it catches; if an existing test covers that path, extend it instead of adding a sibling.

## 7. Fast Verification Gate

Run the lightest check that proves your change before finishing a turn:
- Frontend types: `npx tsc --noEmit`
- Frontend tests: `npm test -- --run`
- Rust compilation & lints: `cargo check --manifest-path src-tauri/Cargo.toml`
- Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml`
*(Do not run full `tauri build` bundles during iterative development.)*