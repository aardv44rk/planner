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
}

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
        const hashTab = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '').split('?')[0] : '';
        const validTabs: AppTab[] = ['today', 'courses', 'tasks', 'schedule', 'notes', 'habits', 'settings'];
        const activeTab = validTabs.includes(hashTab as AppTab)
          ? (hashTab as AppTab)
          : (layout.active_workspace as AppTab) || 'today';

        set({
          activeTab,
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
