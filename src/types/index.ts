export type WidgetType =
  | 'kpi_strip'
  | 'schedule'
  | 'scratchpad'
  | 'projects'
  | 'tasks'
  | 'time_allocation'
  | 'habit_matrix'
  | 'quick_notes';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

export interface LayoutConfig {
  version: number;
  widgets: WidgetConfig[];
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  project: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed: number;
  created_at: string;
}

export interface CreateTaskInput {
  title: string;
  project?: string;
  priority?: TaskPriority;
  due_date?: string;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  project?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  completed?: boolean;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  category: string;
  date: string;
}

export interface CreateScheduleBlockInput {
  title: string;
  start_time: string;
  end_time: string;
  category?: string;
  date: string;
}

export interface DailyNote {
  date: string;
  content_md: string;
  updated_at: string;
}

export interface MetricSparklines {
  focus: number[];
  tasks: number[];
  streak: number[];
  pending: number[];
}

export interface DashboardMetrics {
  focus_time_today_secs: number;
  tasks_completed_today: number;
  active_streak_days: number;
  pending_items_count: number;
  sparklines: MetricSparklines;
}

export interface TimeAllocationItem {
  category: string;
  minutes: number;
  percentage: number;
}

export interface HabitDay {
  habit_name: string;
  days: boolean[];
}
