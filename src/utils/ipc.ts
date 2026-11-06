import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  ActivitySummary,
  CreateScheduleBlockInput,
  CreateTaskInput,
  DailyNote,
  DashboardMetrics,
  HabitDay,
  LayoutConfig,
  ScheduleBlock,
  Task,
  TimeAllocationItem,
  UpdateTaskInput,
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

  // Event listener
  onMetricsUpdated: async (callback: () => void): Promise<UnlistenFn> => {
    if (isTauri()) {
      return await listen('metrics-updated', () => callback());
    }
    return () => {};
  },
};
