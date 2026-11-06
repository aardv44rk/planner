# AGENTS.md — Antigravity & Gemini 3.8 Flash Operating Rules

## 1. Model & Latency Optimization (Gemini 3.8 Flash)

PS THE BELOW LINES WRAPPED IN PARENTHESES ARE ONLY TO BE USED BY GEMINI 3.8 FLASH
(
You are running inside Antigravity on Gemini 3.8 Flash. Latency and context bloat are your primary constraints. Follow these rules strictly:

- **Zero Preamble / Postamble:** Never start responses with greetings, summaries of what you are about to do, or closing recaps. Start immediately with the first file edit or tool call.
- **Targeted Search Over Full-File Reads:** Never read `package-lock.json`, `Cargo.lock`, `src-tauri/gen/**`, or `dist/**`. Use targeted line-range reads or symbol searches before loading a file.
- **Surgical Diffs Only:** When modifying files >80 lines, use targeted search/replace blocks rather than regenerating the entire file.
- **Batch Tool Calls:** If you need to inspect 3 files, issue all 3 read calls in a single turn rather than sequentially across 3 turns.
- **One Phase Per Turn:** Never attempt to implement more than 3-4 files in a single generation turn unless explicitly instructed. Stop and ask for verification after completing a logical unit.
)

## 2. Architecture & Data Flow Rules

- **No Raw `invoke()` in UI:** Components under `src/components/**` or `src/pages/**` MUST NEVER import `invoke` from `@tauri-apps/api/core`. All IPC calls must go through `src/app/traced-tauri-core.ts` -> `src/utils/ipc.ts` -> TanStack Query hooks in `src/platform/*-query.ts`.
- **State Separation:**
  - **Server / SQLite / LMS State:** Managed exclusively by `@tanstack/react-query` (`src/platform/query-client.ts`). Do NOT mirror SQLite rows inside Zustand stores.
  - **Ephemeral UI State:** Managed by Zustand (`layoutStore.ts`, `themeStore.ts`) — e.g., active tab, sidebar collapse, split-pane ratios, command palette visibility.
- **Tab Preservation:** Top-level workspace views must be rendered inside `<KeptPage active={...}>` so inactive tabs stay mounted (`hidden`) and preserve scroll/editor state.
- **Heavy Assets via Custom Protocol:** Never send PDFs, images, or large course files across Tauri IPC as `Vec<u8>` or Base64 strings. Serve them via the Rust custom URI protocol (`lms://`) and pass only the URI to the frontend.

## 3. Styling & Design Token Discipline

- **Semantic Tokens Only:** Never use raw Tailwind palette classes (`bg-zinc-900`, `text-slate-400`, `#1e1e2e`) in new or refactored components. Use semantic CSS variables defined in `src/generated/design/tokens.css` (e.g., `var(--surface-primary)`, `var(--text-muted)`, `var(--border-subtle)`).
- **Zero Layout Shift:** Every async data region must render a geometry-matched `<Skeleton />` while `isLoading` is true, and an `<EmptyState />` when `data.length === 0`.
- **Error Isolation:** Every top-level route and independent widget must be wrapped in `<PageErrorBoundary>`.

## 4. Rust (`src-tauri`) Standards

- **Structured Errors:** All `#[tauri::command]` functions must return `Result<T, CommandError>` (from `crate::command_error::CommandError`), never `Result<T, String>`.
- **No Blocking on Async Runtime:** Wrap synchronous SQLite (`rusqlite`) or heavy file I/O operations properly, keep mutex lock scopes tight (drop `MutexGuard` before `.await` points), and use `tokio::sync::Mutex` only when holding locks across `.await` is unavoidable.
- **SQLite Performance:** Ensure WAL mode (`PRAGMA journal_mode = WAL;`) and `PRAGMA synchronous = NORMAL;` are enabled on connection initialization, and wrap batch sync inserts in explicit transactions (`tx.execute(...)`).

## 5. Verification & Testing Gate

Before marking any task complete, run the smallest verification command that proves correctness:

- **Frontend Typecheck:** `npx tsc --noEmit`
- **Frontend Unit/Integration Tests:** `npm test -- --run <path-to-test>`
- **Rust Check (Fastest):** `cargo check --manifest-path src-tauri/Cargo.toml`
- **Rust Unit Tests:** `cargo test --manifest-path src-tauri/Cargo.toml`
*(Never run `npm run tauri build` to test code changes; use `tsc` and `cargo check` to save compilation time.)*

## 6. Reusable Skills Workflow (`.claude/skills/` or `.agents/skills/`)

When asked to perform recurring tasks, follow these deterministic workflows:

### Skill: `add-ipc-command`

1. Define request/response structs in `src-tauri/src/models/mod.rs` with `#[derive(Serialize, Deserialize)]`.
2. Implement the command in `src-tauri/src/commands/mod.rs` returning `Result<T, CommandError>`.
3. Register the command in `tauri::generate_handler![...]` inside `src-tauri/src/lib.rs`.
4. Add TypeScript types in `src/types/index.ts`.
5. Add the traced wrapper in `src/utils/ipc.ts` using `tracedInvoke`.
6. Expose a `useQuery` or `useMutation` hook in `src/platform/core-query.ts`.
7. Add a mock handler in `tests/harness/core.ts`.

### Skill: `new-workspace-view`

1. Create view in `src/components/views/<Name>View.tsx`.
2. Wrap root in `<PageErrorBoundary pageName="<Name>">`.
3. Handle
