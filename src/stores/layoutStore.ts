import { create } from 'zustand';
import { AppTab, LayoutConfig } from '../types';
import { api } from '../utils/ipc';

interface LayoutState {
  activeTab: AppTab;
  isSidebarExpanded: boolean;
  paneSizes: Record<string, number>;
  isLoading: boolean;
  isEditMode: boolean;

  setActiveTab: (tab: AppTab) => void;
  toggleSidebar: () => void;
  setSidebarExpanded: (val: boolean) => void;
  setPaneSize: (id: string, size: number) => void;
  toggleEditMode: () => void;
  fetchLayout: () => Promise<void>;
  saveLayoutState: () => Promise<void>;
  resetLayout: () => Promise<void>;

  // Backwards compatibility stubs for UI elements
  widgets: Array<{ id: string; title: string; visible: boolean }>;
  isWidgetPinned: (id: string) => boolean;
  toggleWidgetPin: (id: string) => Promise<void>;
  setWidgetPin: (id: string, pinned: boolean) => Promise<void>;
}

export const ALL_WIDGET_IDS = [
  'schedule',
  'tasks',
  'scratchpad',
  'projects',
  'habit_matrix',
  'quick_notes',
];

export const WIDGET_TITLES: Record<string, string> = {
  schedule: 'Schedule & Agenda',
  tasks: "Today's Tasks",
  scratchpad: 'Daily Scratchpad',
  projects: 'Active Projects',
  habit_matrix: 'Habit & Streak Grid',
  quick_notes: 'Quick Notes',
};

export const useLayoutStore = create<LayoutState>((set, get) => ({
  activeTab: 'today',
  isSidebarExpanded: false,
  paneSizes: {
    'today-first': 38,
    'today-second': 62,
    'courses-first': 32,
    'courses-second': 68,
  },
  isLoading: false,
  isEditMode: false,

  widgets: ALL_WIDGET_IDS.map((id) => ({
    id,
    title: WIDGET_TITLES[id] || id,
    visible: true,
  })),

  setActiveTab: (tab: AppTab) => {
    set({ activeTab: tab });
    void get().saveLayoutState();
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded }));
    void get().saveLayoutState();
  },

  setSidebarExpanded: (val: boolean) => {
    set({ isSidebarExpanded: val });
    void get().saveLayoutState();
  },

  setPaneSize: (id: string, size: number) => {
    set((state) => ({
      paneSizes: {
        ...state.paneSizes,
        [id]: size,
      },
    }));
    void get().saveLayoutState();
  },

  toggleEditMode: () => {
    set((state) => ({ isEditMode: !state.isEditMode }));
  },

  isWidgetPinned: (_id: string) => true,
  toggleWidgetPin: async (_id: string) => {},
  setWidgetPin: async (_id: string, _pinned: boolean) => {},

  saveLayoutState: async () => {
    const { activeTab, isSidebarExpanded, paneSizes } = get();
    const config: LayoutConfig = {
      version: 8,
      active_workspace: activeTab,
      sidebar_collapsed: !isSidebarExpanded,
      pane_sizes: paneSizes,
    };
    try {
      await api.saveLayout(config);
    } catch (err) {
      console.warn('Failed to persist layout to Rust/disk:', err);
    }
  },

  fetchLayout: async () => {
    set({ isLoading: true });
    try {
      const layout = await api.getLayout();
      if (layout) {
        set({
          activeTab: (layout.active_workspace as AppTab) || 'today',
          isSidebarExpanded: layout.sidebar_collapsed === false,
          paneSizes: layout.pane_sizes || get().paneSizes,
          isLoading: false,
        });
      }
    } catch (err) {
      console.warn('Failed to fetch layout from Rust:', err);
      set({ isLoading: false });
    }
  },

  resetLayout: async () => {
    try {
      const def = await api.resetLayout();
      set({
        activeTab: 'today',
        isSidebarExpanded: false,
        paneSizes: def.pane_sizes || {
          'today-first': 38,
          'today-second': 62,
          'courses-first': 32,
          'courses-second': 68,
        },
      });
    } catch (err) {
      console.warn('Failed to reset layout:', err);
    }
  },
}));
