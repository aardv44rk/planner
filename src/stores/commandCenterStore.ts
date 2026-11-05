import { create } from 'zustand';
import {
  ActivitySummary,
  CreateScheduleBlockInput,
  CreateTaskInput,
  DailyNote,
  DashboardMetrics,
  HabitDay,
  ScheduleBlock,
  Task,
  TimeAllocationItem,
  UpdateTaskInput,
} from '../types';
import { api } from '../utils/ipc';

const getTodayString = () => new Date().toISOString().split('T')[0];

interface CommandCenterState {
  tasks: Task[];
  scheduleBlocks: ScheduleBlock[];
  dailyNote: DailyNote | null;
  metrics: DashboardMetrics | null;
  timeAllocation: TimeAllocationItem[];
  habitMatrix: HabitDay[];
  notesHistory: string[];
  activitySummary: ActivitySummary | null;
  selectedDate: string;
  isCommandPaletteOpen: boolean;
  isLoading: boolean;

  setSelectedDate: (date: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;

  // Tasks
  fetchTasks: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  updateTask: (input: UpdateTaskInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  // Schedule
  fetchSchedule: (date?: string) => Promise<void>;
  createScheduleBlock: (input: CreateScheduleBlockInput) => Promise<void>;
  deleteScheduleBlock: (id: string) => Promise<void>;
  importIcs: (content: string, targetDate?: string) => Promise<number>;

  // Daily Notes
  fetchDailyNote: (date?: string) => Promise<void>;
  saveDailyNote: (content: string) => Promise<void>;
  fetchNotesHistory: () => Promise<void>;

  // Metrics & Activity
  fetchMetrics: () => Promise<void>;
  fetchTimeAllocation: () => Promise<void>;
  fetchHabitMatrix: () => Promise<void>;
  toggleHabitDay: (habitId: string, date: string) => Promise<void>;
  createHabit: (name: string) => Promise<void>;

  // Full Refresh
  refreshAll: () => Promise<void>;
}

export const useCommandCenterStore = create<CommandCenterState>((set, get) => ({
  tasks: [],
  scheduleBlocks: [],
  dailyNote: null,
  metrics: null,
  timeAllocation: [],
  habitMatrix: [],
  notesHistory: [],
  activitySummary: null,
  selectedDate: getTodayString(),
  isCommandPaletteOpen: false,
  isLoading: false,

  setSelectedDate: (date: string) => {
    set({ selectedDate: date });
    get().fetchSchedule(date);
    get().fetchDailyNote(date);
    get().fetchMetrics();
    get().fetchTimeAllocation();
    get().fetchHabitMatrix();
  },

  setCommandPaletteOpen: (open: boolean) => set({ isCommandPaletteOpen: open }),

  fetchTasks: async () => {
    try {
      const tasks = await api.getTasks();
      set({ tasks });
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  },

  createTask: async (input: CreateTaskInput) => {
    try {
      await api.createTask({
        ...input,
        due_date: input.due_date || get().selectedDate,
      });
      await get().fetchTasks();
      await get().fetchMetrics();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  },

  toggleTask: async (id: string) => {
    try {
      await api.toggleTask(id);
      await get().fetchTasks();
      await get().fetchMetrics();
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  },

  updateTask: async (input: UpdateTaskInput) => {
    try {
      await api.updateTask(input);
      await get().fetchTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  },

  deleteTask: async (id: string) => {
    try {
      await api.deleteTask(id);
      await get().fetchTasks();
      await get().fetchMetrics();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  },

  fetchSchedule: async (date?: string) => {
    const targetDate = date || get().selectedDate;
    try {
      const scheduleBlocks = await api.getScheduleBlocks(targetDate);
      set({ scheduleBlocks });
    } catch (err) {
      console.error('Failed to fetch schedule blocks:', err);
    }
  },

  createScheduleBlock: async (input: CreateScheduleBlockInput) => {
    try {
      await api.createScheduleBlock(input);
      await get().fetchSchedule(input.date);
    } catch (err) {
      console.error('Failed to create schedule block:', err);
    }
  },

  deleteScheduleBlock: async (id: string) => {
    try {
      await api.deleteScheduleBlock(id);
      await get().fetchSchedule(get().selectedDate);
    } catch (err) {
      console.error('Failed to delete schedule block:', err);
    }
  },

  importIcs: async (content: string, targetDate?: string) => {
    try {
      const count = await api.importIcs(content, targetDate || get().selectedDate);
      await get().fetchSchedule(targetDate || get().selectedDate);
      return count;
    } catch (err) {
      console.error('Failed to import .ics file:', err);
      return 0;
    }
  },

  fetchDailyNote: async (date?: string) => {
    const targetDate = date || get().selectedDate;
    try {
      const dailyNote = await api.getDailyNote(targetDate);
      set({ dailyNote });
    } catch (err) {
      console.error('Failed to fetch daily note:', err);
    }
  },

  saveDailyNote: async (content: string) => {
    const date = get().selectedDate;
    try {
      const dailyNote = await api.saveDailyNote(date, content);
      set({ dailyNote });
      await get().fetchNotesHistory();
      await get().fetchMetrics();
    } catch (err) {
      console.error('Failed to save daily note:', err);
    }
  },

  fetchNotesHistory: async () => {
    try {
      const notesHistory = await api.getDailyNotesDates();
      set({ notesHistory });
    } catch (err) {
      console.error('Failed to fetch notes history:', err);
    }
  },

  fetchMetrics: async () => {
    try {
      const metrics = await api.getDashboardMetrics(get().selectedDate);
      set({ metrics });
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  },

  fetchTimeAllocation: async () => {
    try {
      const timeAllocation = await api.getTimeAllocation(get().selectedDate);
      set({ timeAllocation });
    } catch (err) {
      console.error('Failed to fetch time allocation:', err);
    }
  },

  fetchHabitMatrix: async () => {
    try {
      const habitMatrix = await api.getHabits(get().selectedDate);
      set({ habitMatrix });
    } catch (err) {
      console.error('Failed to fetch habit matrix:', err);
    }
  },

  toggleHabitDay: async (habitId: string, date: string) => {
    try {
      await api.toggleHabitDay(habitId, date);
      await get().fetchHabitMatrix();
    } catch (err) {
      console.error('Failed to toggle habit day:', err);
    }
  },

  createHabit: async (name: string) => {
    try {
      await api.createHabit(name);
      await get().fetchHabitMatrix();
    } catch (err) {
      console.error('Failed to create habit:', err);
    }
  },

  refreshAll: async () => {
    set({ isLoading: true });
    await Promise.all([
      get().fetchTasks(),
      get().fetchSchedule(get().selectedDate),
      get().fetchDailyNote(get().selectedDate),
      get().fetchNotesHistory(),
      get().fetchMetrics(),
      get().fetchTimeAllocation(),
      get().fetchHabitMatrix(),
    ]);
    set({ isLoading: false });
  },
}));
