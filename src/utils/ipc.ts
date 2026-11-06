import { invoke } from '../app/traced-tauri-core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  ActivitySummary,
  Course,
  CreateScheduleBlockInput,
  CreateTaskInput,
  CredentialStatus,
  DailyNote,
  DashboardMetrics,
  HabitDay,
  LayoutConfig,
  LmsSyncState,
  PickedFileResult,
  QuickNote,
  ScheduleBlock,
  Task,
  TimeAllocationItem,
  TotpCodeResult,
  UpdateTaskInput,
  UploadResult,
} from '../types';

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

// Fallback in-memory storage for non-Tauri browser preview
const fallbackDate = new Date().toISOString().split('T')[0];
const fallbackLayout: LayoutConfig = {
  version: 4,
  active_workspace: 'focus',
  widgets: [
    { id: 'widget-kpis', type: 'kpi_strip', title: 'Key Performance Indicators', x: 0, y: 0, w: 12, h: 1, visible: true, workspace: 'focus' },
    { id: 'widget-schedule', type: 'schedule', title: 'Schedule & Agenda', x: 0, y: 1, w: 4, h: 5, visible: true, workspace: 'focus' },
    { id: 'widget-scratchpad', type: 'scratchpad', title: 'Daily Scratchpad', x: 4, y: 1, w: 4, h: 5, visible: true, workspace: 'focus' },
    { id: 'widget-tasks', type: 'tasks', title: "Today's Tasks", x: 8, y: 1, w: 4, h: 5, visible: true, workspace: 'focus' },
    { id: 'widget-projects', type: 'projects', title: 'Active Projects', x: 0, y: 6, w: 4, h: 3, visible: false, workspace: 'full' },
    { id: 'widget-time-allocation', type: 'time_allocation', title: 'Time Allocation', x: 4, y: 6, w: 4, h: 3, visible: false, workspace: 'analytics' },
    { id: 'widget-habit-matrix', type: 'habit_matrix', title: 'Habit & Streak Grid', x: 8, y: 6, w: 4, h: 3, visible: false, workspace: 'analytics' },
    { id: 'widget-quick-notes', type: 'quick_notes', title: 'Quick Notes', x: 0, y: 9, w: 4, h: 3, visible: false, workspace: 'full' },
  ],
};

let memoryLayout = { ...fallbackLayout };
let memoryTasks: Task[] = [
  { id: '1', title: 'LifeOS Architecture & Bento Grid', project: 'LifeOS', status: 'in_progress', priority: 'high', due_date: fallbackDate, completed: 0, created_at: new Date().toISOString() },
  { id: '2', title: 'Deep work on Q4 Product Roadmap', project: 'Work', status: 'todo', priority: 'high', due_date: fallbackDate, completed: 0, created_at: new Date().toISOString() },
  { id: '3', title: 'Read 2 chapters of Designing Data-Intensive Systems', project: 'Learning', status: 'done', priority: 'medium', due_date: fallbackDate, completed: 1, created_at: new Date().toISOString() },
  { id: '4', title: 'Review weekly goals & system health', project: 'Personal', status: 'todo', priority: 'medium', due_date: fallbackDate, completed: 0, created_at: new Date().toISOString() },
  { id: '5', title: 'Refactor SQLite connection pool & WAL pragmas', project: 'LifeOS', status: 'done', priority: 'high', due_date: fallbackDate, completed: 1, created_at: new Date().toISOString() },
];
let memorySchedule: ScheduleBlock[] = [
  { id: 's1', title: 'Deep Work: Core Engine & Rust Plugins', start_time: '09:00', end_time: '10:30', category: 'Deep Work', date: fallbackDate },
  { id: 's2', title: 'Architecture & Bento Grid Design Review', start_time: '11:00', end_time: '12:00', category: 'Engineering', date: fallbackDate },
  { id: 's3', title: 'Team Sync & Daily Focus Alignment', start_time: '13:30', end_time: '14:15', category: 'Sync', date: fallbackDate },
  { id: 's4', title: 'Command Palette & IPC Wiring', start_time: '15:00', end_time: '16:30', category: 'Development', date: fallbackDate },
  { id: 's5', title: 'Reading & Day Reflection', start_time: '17:00', end_time: '17:45', category: 'Personal', date: fallbackDate },
];
let memoryNotes: Record<string, DailyNote> = {
  [fallbackDate]: {
    date: fallbackDate,
    content_md: `# Daily Focus — ${fallbackDate}\n\n## Top Priorities\n- [ ] Deliver LifeOS Command Center MVP\n- [x] Configure WAL SQLite & layout engine\n- [ ] Wire Command Palette with fuzzy filter\n\n## Notes & Thoughts\n*Ultra-minimalist aesthetic inspired by Obsidian. Text-first, 1px crisp borders, zero distractions.*`,
    updated_at: new Date().toISOString(),
  },
};
let memoryHabits: HabitDay[] = [
  { id: 'h1', habit_name: 'Deep Focus (2h+)', days: [true, true, true, false, true, true, true] },
  { id: 'h2', habit_name: 'Morning Review', days: [true, true, true, true, true, false, true] },
  { id: 'h3', habit_name: 'Inbox Zero', days: [false, true, true, true, true, false, false] },
  { id: 'h4', habit_name: 'Read 20 pages', days: [true, true, false, true, true, true, true] },
  { id: 'h5', habit_name: 'Exercise / Walk', days: [true, false, true, true, false, true, false] },
];
let memoryQuickNotes: QuickNote[] = [
  { id: 'qn-1', content: 'LMS sync state: check action events', created_at: new Date().toISOString() },
  { id: 'qn-2', content: 'Tokyo Tech matrix authentication verified', created_at: new Date().toISOString() },
];
let memoryLmsSyncState: LmsSyncState = {
  active_academic_year: '2026',
  active_quarter: '4Q',
  last_synced_at: null,
};

export const api = {
  // Layout
  getLayout: async (): Promise<LayoutConfig> => {
    if (isTauri()) return await invoke<LayoutConfig>('get_layout');
    return memoryLayout;
  },
  saveLayout: async (layout: LayoutConfig): Promise<void> => {
    if (isTauri()) return await invoke<void>('save_layout', { layout });
    memoryLayout = layout;
  },
  resetLayout: async (): Promise<LayoutConfig> => {
    if (isTauri()) return await invoke<LayoutConfig>('reset_layout');
    memoryLayout = { ...fallbackLayout };
    return memoryLayout;
  },

  // Tasks
  getTasks: async (): Promise<Task[]> => {
    if (isTauri()) return await invoke<Task[]>('get_tasks');
    return memoryTasks;
  },
  createTask: async (input: CreateTaskInput): Promise<Task> => {
    if (isTauri()) return await invoke<Task>('create_task', { input });
    const newTask: Task = {
      id: Math.random().toString(36).substring(2, 9),
      title: input.title,
      project: input.project || 'General',
      priority: input.priority || 'medium',
      status: 'todo',
      due_date: input.due_date || fallbackDate,
      completed: 0,
      created_at: new Date().toISOString(),
    };
    memoryTasks = [newTask, ...memoryTasks];
    return newTask;
  },
  toggleTask: async (id: string): Promise<Task> => {
    if (isTauri()) return await invoke<Task>('toggle_task', { id });
    const task = memoryTasks.find((t) => t.id === id);
    if (!task) throw new Error('Task not found');
    task.completed = task.completed ? 0 : 1;
    task.status = task.completed ? 'done' : 'todo';
    return { ...task };
  },
  updateTask: async (input: UpdateTaskInput): Promise<Task> => {
    if (isTauri()) return await invoke<Task>('update_task', { input });
    const task = memoryTasks.find((t) => t.id === input.id);
    if (!task) throw new Error('Task not found');
    if (input.title !== undefined) task.title = input.title;
    if (input.project !== undefined) task.project = input.project;
    if (input.status !== undefined) task.status = input.status;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.due_date !== undefined) task.due_date = input.due_date;
    if (input.completed !== undefined) {
      task.completed = input.completed ? 1 : 0;
      task.status = input.completed ? 'done' : 'todo';
    }
    return { ...task };
  },
  deleteTask: async (id: string): Promise<void> => {
    if (isTauri()) return await invoke<void>('delete_task', { id });
    memoryTasks = memoryTasks.filter((t) => t.id !== id);
  },

  // Schedule
  getScheduleBlocks: async (date: string): Promise<ScheduleBlock[]> => {
    if (isTauri()) return await invoke<ScheduleBlock[]>('get_schedule_blocks', { date });
    return memorySchedule.filter((b) => b.date === date);
  },
  getScheduleBlocksRange: async (startDate: string, endDate: string): Promise<ScheduleBlock[]> => {
    if (isTauri()) return await invoke<ScheduleBlock[]>('get_schedule_blocks_range', { startDate, endDate });
    return memorySchedule.filter((b) => b.date >= startDate && b.date <= endDate);
  },
  createScheduleBlock: async (input: CreateScheduleBlockInput): Promise<ScheduleBlock> => {
    if (isTauri()) return await invoke<ScheduleBlock>('create_schedule_block', { input });
    const block: ScheduleBlock = {
      id: Math.random().toString(36).substring(2, 9),
      title: input.title,
      start_time: input.start_time,
      end_time: input.end_time,
      category: input.category || 'General',
      date: input.date,
    };
    memorySchedule = [...memorySchedule, block];
    return block;
  },
  deleteScheduleBlock: async (id: string): Promise<void> => {
    if (isTauri()) return await invoke<void>('delete_schedule_block', { id });
    memorySchedule = memorySchedule.filter((s) => s.id !== id);
  },
  importIcs: async (icsContent: string, targetDate?: string): Promise<number> => {
    if (isTauri()) return await invoke<number>('import_ics', { icsContent, targetDate });
    return 1;
  },

  // Daily Notes
  getDailyNote: async (date: string): Promise<DailyNote> => {
    if (isTauri()) return await invoke<DailyNote>('get_daily_note', { date });
    return (
      memoryNotes[date] || {
        date,
        content_md: '',
        updated_at: new Date().toISOString(),
      }
    );
  },
  saveDailyNote: async (date: string, contentMd: string): Promise<DailyNote> => {
    if (isTauri()) return await invoke<DailyNote>('save_daily_note', { date, contentMd });
    const updated: DailyNote = {
      date,
      content_md: contentMd,
      updated_at: new Date().toISOString(),
    };
    memoryNotes[date] = updated;
    return updated;
  },
  getDailyNotesDates: async (): Promise<string[]> => {
    if (isTauri()) return await invoke<string[]>('get_daily_notes_dates');
    return Object.keys(memoryNotes);
  },

  // Analytics & Metrics
  getDashboardMetrics: async (date: string): Promise<DashboardMetrics> => {
    if (isTauri()) return await invoke<DashboardMetrics>('get_dashboard_metrics', { date });
    return {
      focus_time_today_secs: 14400,
      tasks_completed_today: 4,
      active_streak_days: 7,
      pending_items_count: 3,
      sparklines: {
        focus: [2400, 3100, 4200, 3800, 5100, 6200, 14400],
        tasks: [3, 5, 4, 7, 6, 8, 4],
        streak: [1, 2, 3, 4, 5, 6, 7],
        pending: [8, 7, 9, 6, 5, 4, 3],
      },
    };
  },
  getTimeAllocation: async (date: string): Promise<TimeAllocationItem[]> => {
    if (isTauri()) return await invoke<TimeAllocationItem[]>('get_time_allocation', { date });
    return [
      { category: 'Development', minutes: 165, percentage: 55.0 },
      { category: 'Deep Focus', minutes: 60, percentage: 20.0 },
      { category: 'Documentation', minutes: 45, percentage: 15.0 },
      { category: 'Communication', minutes: 30, percentage: 10.0 },
    ];
  },
  getActivitySummary: async (date: string): Promise<ActivitySummary> => {
    if (isTauri()) return await invoke<ActivitySummary>('get_activity_summary', { date });
    return {
      total_focus_secs: 14400,
      tasks_completed_today: 4,
      pending_tasks_count: 3,
      active_streak_days: 7,
      top_apps: [
        { category: 'Visual Studio Code', minutes: 165, percentage: 55.0 },
        { category: 'Chrome', minutes: 60, percentage: 20.0 },
        { category: 'Terminal', minutes: 45, percentage: 15.0 },
      ],
    };
  },

  // Habits with SQLite Persistence
  getHabits: async (startDate: string): Promise<HabitDay[]> => {
    if (isTauri()) return await invoke<HabitDay[]>('get_habits', { startDate });
    return memoryHabits;
  },
  toggleHabitDay: async (habitId: string, date: string): Promise<boolean> => {
    if (isTauri()) return await invoke<boolean>('toggle_habit_day', { habitId, date });
    const habit = memoryHabits.find((h) => h.id === habitId);
    if (habit) {
      habit.days[0] = !habit.days[0];
      return habit.days[0];
    }
    return true;
  },
  createHabit: async (name: string): Promise<void> => {
    if (isTauri()) return await invoke<void>('create_habit', { input: { name } });
    memoryHabits.push({
      id: Math.random().toString(36).substring(2, 9),
      habit_name: name,
      days: [false, false, false, false, false, false, false],
    });
  },

  // University LMS & Secure Vault Auth
  saveCredentials: async (
    username?: string,
    password?: string,
    totpSeed?: string,
    matrixCard?: string
  ): Promise<void> => {
    if (isTauri()) {
      return await invoke<void>('save_credentials', {
        username: username || '',
        password: password || '',
        totpSeed: totpSeed || '',
        matrixCard: matrixCard || '',
      });
    }
  },
  saveScienceCredentials: async (
    username?: string,
    password?: string,
    totpSeed?: string
  ): Promise<void> => {
    if (isTauri()) {
      return await invoke<void>('save_science_credentials', {
        username: username || '',
        password: password || '',
        totpSeed: totpSeed || '',
      });
    }
  },
  saveTitechCredentials: async (
    username?: string,
    password?: string,
    matrixCard?: string
  ): Promise<void> => {
    if (isTauri()) {
      return await invoke<void>('save_titech_credentials', {
        username: username || '',
        password: password || '',
        matrixCard: matrixCard || '',
      });
    }
  },
  clearScienceCredentials: async (): Promise<void> => {
    if (isTauri()) {
      return await invoke<void>('clear_science_credentials');
    }
  },
  clearTitechCredentials: async (): Promise<void> => {
    if (isTauri()) {
      return await invoke<void>('clear_titech_credentials');
    }
  },
  saveMatrixCard: async (matrix: string): Promise<void> => {
    if (isTauri()) {
      return await invoke<void>('save_matrix_card', { matrix });
    }
  },
  openUrl: async (url: string): Promise<void> => {
    if (isTauri()) {
      try {
        await invoke<void>('open_url', { url });
        return;
      } catch (err) {
        console.warn('Failed to invoke open_url, falling back to window.open', err);
      }
    }
    window.open(url, '_blank');
  },
  loginTitech: async (): Promise<string> => {
    if (isTauri()) {
      return await invoke<string>('login_titech');
    }
    return 'Tokyo Tech portal login successful (Preview mode)';
  },
  getCredentialStatus: async (): Promise<CredentialStatus> => {
    if (isTauri()) {
      return await invoke<CredentialStatus>('get_credential_status');
    }
    return {
      configured: false,
      username: null,
      has_username: false,
      has_password: false,
      has_totp: false,
      has_matrix: false,
      session_cached: false,
    };
  },
  getLmsSyncState: async (): Promise<LmsSyncState> => {
    if (isTauri()) {
      return await invoke<LmsSyncState>('get_lms_sync_state');
    }
    return memoryLmsSyncState;
  },
  pickAssignmentFile: async (): Promise<PickedFileResult> => {
    if (isTauri()) {
      return await invoke<PickedFileResult>('pick_assignment_file');
    }
    return {
      path: '/mock/path/submission.pdf',
      name: 'submission.pdf',
      size: 1024 * 1024,
    };
  },
  pickAndUploadAssignment: async (assignmentId: string): Promise<UploadResult> => {
    if (isTauri()) {
      return await invoke<UploadResult>('pick_and_upload_assignment', { assignmentId });
    }
    return {
      success: true,
      message: `Simulated submission for assignment ${assignmentId}`,
      assignment_id: assignmentId,
      filename: 'submission.pdf',
    };
  },
  clearCredentials: async (): Promise<void> => {
    if (isTauri()) {
      return await invoke<void>('clear_credentials');
    }
  },
  syncLms: async (): Promise<string> => {
    if (isTauri()) {
      return await invoke<string>('sync_lms');
    }
    return 'Synced courses and tasks (Preview mode)';
  },
  getCourses: async (): Promise<Course[]> => {
    if (isTauri()) {
      return await invoke<Course[]>('get_courses');
    }
    return [];
  },
  uploadAssignment: async (filePath: string, assignmentId: string): Promise<UploadResult> => {
    if (isTauri()) {
      return await invoke<UploadResult>('upload_assignment', { filePath, assignmentId });
    }
    return {
      success: true,
      message: `Simulated submission for assignment ${assignmentId}`,
      assignment_id: assignmentId,
      filename: filePath.split(/[\\/]/).pop() || 'submission.pdf',
    };
  },
  checkCampusWifi: async (): Promise<boolean> => {
    if (isTauri()) {
      return await invoke<boolean>('check_campus_wifi');
    }
    return false;
  },
  loginCampusWifi: async (): Promise<string> => {
    if (isTauri()) {
      return await invoke<string>('login_campus_wifi');
    }
    return 'Preview: Campus Wi-Fi signed in successfully';
  },
  triggerTestNotification: async (title: string, body: string): Promise<void> => {
    if (isTauri()) {
      return await invoke<void>('trigger_test_notification', { title, body });
    }
    console.log(`[Notification Preview] ${title}: ${body}`);
  },
  getCurrentTotp: async (): Promise<TotpCodeResult> => {
    if (isTauri()) {
      return await invoke<TotpCodeResult>('get_current_totp');
    }
    return { code: '123456', seconds_remaining: 30 };
  },
  verifyTotpSeed: async (seed: string): Promise<TotpCodeResult> => {
    if (isTauri()) {
      return await invoke<TotpCodeResult>('verify_totp_seed', { seed });
    }
    return { code: '123456', seconds_remaining: 30 };
  },
  saveTotpSeed: async (seed: string): Promise<TotpCodeResult> => {
    if (isTauri()) {
      return await invoke<TotpCodeResult>('save_totp_seed', { seed });
    }
    return { code: '123456', seconds_remaining: 30 };
  },

  // Quick Notes (SQLite persistence)
  getQuickNotes: async (): Promise<QuickNote[]> => {
    if (isTauri()) {
      return await invoke<QuickNote[]>('get_quick_notes');
    }
    return [...memoryQuickNotes];
  },
  createQuickNote: async (content: string): Promise<QuickNote> => {
    if (isTauri()) {
      return await invoke<QuickNote>('create_quick_note', { content });
    }
    const newNote: QuickNote = {
      id: Math.random().toString(36).substring(2, 9),
      content,
      created_at: new Date().toISOString(),
    };
    memoryQuickNotes = [newNote, ...memoryQuickNotes];
    return newNote;
  },
  deleteQuickNote: async (id: string): Promise<void> => {
    if (isTauri()) {
      return await invoke<void>('delete_quick_note', { id });
    }
    memoryQuickNotes = memoryQuickNotes.filter((n) => n.id !== id);
  },

  // In-app LMS Asset Streaming (lms:// protocol)
  getLmsFileUrl: async (filePath: string): Promise<string> => {
    if (isTauri()) {
      return await invoke<string>('get_lms_file_url', { filePath });
    }
    return `lms://localhost/file?path=${encodeURIComponent(filePath)}`;
  },
  getMaterialsRoot: async (): Promise<string> => {
    if (isTauri()) {
      return await invoke<string>('get_materials_root');
    }
    return '';
  },

  // Event listener
  onMetricsUpdated: async (callback: () => void): Promise<UnlistenFn> => {
    if (isTauri()) {
      return await listen('metrics-updated', () => callback());
    }
    return () => {};
  },
};
