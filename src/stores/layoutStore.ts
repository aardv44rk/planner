import { create } from 'zustand';
import { LayoutConfig, WidgetConfig, WorkspaceType } from '../types';
import { api } from '../utils/ipc';

interface LayoutState {
  layout: LayoutConfig | null;
  isLoading: boolean;
  isEditMode: boolean;
  activeWorkspace: WorkspaceType;
  selectedWidgetId: string | null;
  isSidebarDrawerOpen: boolean;
  activeDrawerTab: 'workspaces' | 'widgets' | 'history';

  toggleEditMode: () => void;
  setEditMode: (val: boolean) => void;
  toggleSidebarDrawer: () => void;
  setSidebarDrawerOpen: (val: boolean) => void;
  setActiveDrawerTab: (tab: 'workspaces' | 'widgets' | 'history') => void;
  setSelectedWidgetId: (id: string | null) => void;

  fetchLayout: () => Promise<void>;
  setWorkspace: (ws: WorkspaceType) => Promise<void>;
  swapWidgets: (idA: string, idB: string) => Promise<void>;
  updateWidgetPosition: (id: string, updates: Partial<WidgetConfig>) => Promise<void>;
  toggleWidgetVisibility: (id: string) => Promise<void>;
  setWidgetVisibility: (id: string, visible: boolean) => Promise<void>;
  resizeWidget: (id: string, w: number, h: number) => Promise<void>;
  resetLayout: () => Promise<void>;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  layout: null,
  isLoading: false,
  isEditMode: false,
  activeWorkspace: 'focus',
  selectedWidgetId: null,
  isSidebarDrawerOpen: false,
  activeDrawerTab: 'workspaces',

  toggleEditMode: () => {
    set((state) => ({
      isEditMode: !state.isEditMode,
      selectedWidgetId: null,
    }));
  },

  setEditMode: (val) => set({ isEditMode: val, selectedWidgetId: null }),
  toggleSidebarDrawer: () => set((state) => ({ isSidebarDrawerOpen: !state.isSidebarDrawerOpen })),
  setSidebarDrawerOpen: (val) => set({ isSidebarDrawerOpen: val }),
  setActiveDrawerTab: (tab) => set({ activeDrawerTab: tab, isSidebarDrawerOpen: true }),
  setSelectedWidgetId: (id) => set({ selectedWidgetId: id }),

  fetchLayout: async () => {
    set({ isLoading: true });
    try {
      const layout = await api.getLayout();
      const ws = (layout.active_workspace as WorkspaceType) || 'focus';
      set({ layout, activeWorkspace: ws, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch layout:', err);
      set({ isLoading: false });
    }
  },

  setWorkspace: async (ws: WorkspaceType) => {
    const { layout } = get();
    if (!layout) return;

    let updatedWidgets = [...layout.widgets];

    if (ws === 'focus') {
      // 4 core widgets: KPI strip (12), Schedule (4), Scratchpad (4), Tasks (4)
      updatedWidgets = updatedWidgets.map((w) => {
        if (w.type === 'kpi_strip') {
          return { ...w, visible: true, x: 0, y: 0, w: 12, h: 1 };
        }
        if (w.type === 'schedule') {
          return { ...w, visible: true, x: 0, y: 1, w: 4, h: 1 };
        }
        if (w.type === 'scratchpad') {
          return { ...w, visible: true, x: 4, y: 1, w: 4, h: 1 };
        }
        if (w.type === 'tasks') {
          return { ...w, visible: true, x: 8, y: 1, w: 4, h: 1 };
        }
        return { ...w, visible: false };
      });
    } else if (ws === 'full') {
      // Show all 8 widgets in balanced 4-row layout
      updatedWidgets = updatedWidgets.map((w) => {
        switch (w.type) {
          case 'kpi_strip':
            return { ...w, visible: true, x: 0, y: 0, w: 12, h: 1 };
          case 'schedule':
            return { ...w, visible: true, x: 0, y: 1, w: 3, h: 2 };
          case 'scratchpad':
            return { ...w, visible: true, x: 3, y: 1, w: 5, h: 1 };
          case 'projects':
            return { ...w, visible: true, x: 3, y: 2, w: 5, h: 1 };
          case 'tasks':
            return { ...w, visible: true, x: 8, y: 1, w: 4, h: 2 };
          case 'time_allocation':
            return { ...w, visible: true, x: 0, y: 3, w: 4, h: 1 };
          case 'habit_matrix':
            return { ...w, visible: true, x: 4, y: 3, w: 5, h: 1 };
          case 'quick_notes':
            return { ...w, visible: true, x: 9, y: 3, w: 3, h: 1 };
          default:
            return { ...w, visible: true };
        }
      });
    } else if (ws === 'analytics') {
      // Analytics view: KPI (12), Time Allocation (6), Habit Matrix (6), Tasks (6), Projects (6)
      updatedWidgets = updatedWidgets.map((w) => {
        switch (w.type) {
          case 'kpi_strip':
            return { ...w, visible: true, x: 0, y: 0, w: 12, h: 1 };
          case 'time_allocation':
            return { ...w, visible: true, x: 0, y: 1, w: 6, h: 1 };
          case 'habit_matrix':
            return { ...w, visible: true, x: 6, y: 1, w: 6, h: 1 };
          case 'tasks':
            return { ...w, visible: true, x: 0, y: 2, w: 6, h: 1 };
          case 'projects':
            return { ...w, visible: true, x: 6, y: 2, w: 6, h: 1 };
          default:
            return { ...w, visible: false };
        }
      });
    }

    const updatedLayout: LayoutConfig = {
      ...layout,
      active_workspace: ws,
      widgets: updatedWidgets,
    };

    set({ layout: updatedLayout, activeWorkspace: ws });
    try {
      await api.saveLayout(updatedLayout);
    } catch (err) {
      console.error('Failed to persist workspace layout:', err);
    }
  },

  swapWidgets: async (idA: string, idB: string) => {
    const { layout } = get();
    if (!layout) return;

    const idxA = layout.widgets.findIndex((w) => w.id === idA);
    const idxB = layout.widgets.findIndex((w) => w.id === idB);
    if (idxA === -1 || idxB === -1) return;

    const wA = { ...layout.widgets[idxA] };
    const wB = { ...layout.widgets[idxB] };

    const tempX = wA.x;
    const tempY = wA.y;
    const tempW = wA.w;
    const tempH = wA.h;

    wA.x = wB.x;
    wA.y = wB.y;
    wA.w = wB.w;
    wA.h = wB.h;

    wB.x = tempX;
    wB.y = tempY;
    wB.w = tempW;
    wB.h = tempH;

    const newWidgets = [...layout.widgets];
    newWidgets[idxA] = wA;
    newWidgets[idxB] = wB;

    const updatedLayout: LayoutConfig = {
      ...layout,
      widgets: newWidgets,
    };

    set({ layout: updatedLayout, selectedWidgetId: null });
    try {
      await api.saveLayout(updatedLayout);
    } catch (err) {
      console.error('Failed to persist swapped layout:', err);
    }
  },

  updateWidgetPosition: async (id: string, updates: Partial<WidgetConfig>) => {
    const { layout } = get();
    if (!layout) return;

    const newWidgets = layout.widgets.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    );

    const updatedLayout: LayoutConfig = {
      ...layout,
      widgets: newWidgets,
    };

    set({ layout: updatedLayout });
    try {
      await api.saveLayout(updatedLayout);
    } catch (err) {
      console.error('Failed to persist layout update:', err);
    }
  },

  toggleWidgetVisibility: async (id: string) => {
    const { layout } = get();
    if (!layout) return;

    const target = layout.widgets.find((w) => w.id === id);
    if (!target) return;

    await get().setWidgetVisibility(id, !target.visible);
  },

  setWidgetVisibility: async (id: string, visible: boolean) => {
    const { layout } = get();
    if (!layout) return;

    const newWidgets = layout.widgets.map((w) =>
      w.id === id ? { ...w, visible } : w
    );

    const updatedLayout: LayoutConfig = {
      ...layout,
      widgets: newWidgets,
    };

    set({ layout: updatedLayout });
    try {
      await api.saveLayout(updatedLayout);
    } catch (err) {
      console.error('Failed to set widget visibility:', err);
    }
  },

  resizeWidget: async (id: string, w: number, h: number) => {
    const clampedW = Math.max(3, Math.min(12, w));
    const clampedH = Math.max(1, Math.min(4, h));
    await get().updateWidgetPosition(id, { w: clampedW, h: clampedH });
  },

  resetLayout: async () => {
    set({ isLoading: true });
    try {
      const layout = await api.resetLayout();
      set({
        layout,
        activeWorkspace: 'focus',
        isLoading: false,
        selectedWidgetId: null,
      });
    } catch (err) {
      console.error('Failed to reset layout:', err);
      set({ isLoading: false });
    }
  },
}));
