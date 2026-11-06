import { create } from 'zustand';
import { AppTab, LayoutConfig, WidgetConfig, WidgetType } from '../types';
import { api } from '../utils/ipc';

export const DEFAULT_HOME_WIDGETS: WidgetConfig[] = [
  { id: 'widget-kpis', type: 'kpi_strip', title: 'Key Performance Indicators', x: 0, y: 0, w: 12, h: 1, visible: true, workspace: 'home' },
  { id: 'widget-schedule', type: 'schedule', title: 'Schedule & Agenda', x: 0, y: 1, w: 4, h: 2, visible: true, workspace: 'home' },
  { id: 'widget-scratchpad', type: 'scratchpad', title: 'Daily Scratchpad', x: 4, y: 1, w: 4, h: 2, visible: true, workspace: 'home' },
  { id: 'widget-tasks', type: 'tasks', title: "Today's Tasks", x: 8, y: 1, w: 4, h: 2, visible: true, workspace: 'home' },
  { id: 'widget-projects', type: 'projects', title: 'Active Projects', x: 0, y: 3, w: 4, h: 2, visible: false, workspace: 'home' },
  { id: 'widget-time-allocation', type: 'time_allocation', title: 'Time Allocation', x: 4, y: 3, w: 4, h: 2, visible: false, workspace: 'home' },
  { id: 'widget-habit-matrix', type: 'habit_matrix', title: 'Habit & Streak Grid', x: 8, y: 3, w: 4, h: 2, visible: false, workspace: 'home' },
  { id: 'widget-quick-notes', type: 'quick_notes', title: 'Quick Notes', x: 0, y: 5, w: 4, h: 2, visible: false, workspace: 'home' },
];

interface LayoutState {
  activeTab: AppTab;
  layout: LayoutConfig | null;
  isLoading: boolean;
  isEditMode: boolean;
  selectedWidgetId: string | null;
  isSidebarExpanded: boolean;

  setActiveTab: (tab: AppTab) => void;
  toggleEditMode: () => void;
  setEditMode: (val: boolean) => void;
  toggleSidebar: () => void;
  setSidebarExpanded: (val: boolean) => void;
  setSelectedWidgetId: (id: string | null) => void;

  fetchLayout: () => Promise<void>;
  swapWidgets: (idA: string, idB: string) => Promise<void>;
  updateWidgetPosition: (id: string, updates: Partial<WidgetConfig>) => Promise<void>;
  toggleWidgetVisibility: (id: string) => Promise<void>;
  setWidgetVisibility: (id: string, visible: boolean) => Promise<void>;
  isWidgetPinned: (typeOrId: WidgetType | string) => boolean;
  toggleWidgetPin: (typeOrId: WidgetType | string) => Promise<void>;
  setWidgetPin: (typeOrId: WidgetType | string, pinned: boolean) => Promise<void>;
  resizeWidget: (id: string, w: number, h: number) => Promise<void>;
  resetLayout: () => Promise<void>;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  activeTab: 'home',
  layout: null,
  isLoading: false,
  isEditMode: false,
  selectedWidgetId: null,
  isSidebarExpanded: false,

  setActiveTab: (tab: AppTab) => set({ activeTab: tab }),

  toggleEditMode: () => {
    set((state) => ({
      isEditMode: !state.isEditMode,
      selectedWidgetId: null,
    }));
  },

  setEditMode: (val) => set({ isEditMode: val, selectedWidgetId: null }),
  toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
  setSidebarExpanded: (val) => set({ isSidebarExpanded: val }),
  setSelectedWidgetId: (id) => set({ selectedWidgetId: id }),

  fetchLayout: async () => {
    set({ isLoading: true });
    try {
      const layout = await api.getLayout();

      // Ensure all 8 standard widgets exist in the home layout
      const existingWidgets = layout.widgets || [];
      const mergedWidgets: WidgetConfig[] = [...existingWidgets];

      for (const defWidget of DEFAULT_HOME_WIDGETS) {
        const found = mergedWidgets.find(
          (w) => w.id === defWidget.id || w.type === defWidget.type
        );
        if (!found) {
          mergedWidgets.push(defWidget);
        }
      }

      // Ensure each widget has workspace: 'home'
      const normalizedWidgets = mergedWidgets.map((w) => ({
        ...w,
        workspace: 'home',
      }));

      const normalizedLayout: LayoutConfig = {
        ...layout,
        version: 5,
        active_workspace: 'home',
        widgets: normalizedWidgets,
      };

      set({
        layout: normalizedLayout,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to fetch layout:', err);
      set({
        layout: {
          version: 5,
          active_workspace: 'home',
          widgets: DEFAULT_HOME_WIDGETS,
        },
        isLoading: false,
      });
    }
  },

  isWidgetPinned: (typeOrId: WidgetType | string) => {
    const { layout } = get();
    if (!layout) return false;
    const widget = layout.widgets.find((w) => w.id === typeOrId || w.type === typeOrId);
    return widget ? widget.visible !== false : false;
  },

  setWidgetPin: async (typeOrId: WidgetType | string, pinned: boolean) => {
    const { layout } = get();
    if (!layout) return;

    let targetFound = false;
    const newWidgets = layout.widgets.map((w) => {
      if (w.id === typeOrId || w.type === typeOrId) {
        targetFound = true;
        return { ...w, visible: pinned };
      }
      return w;
    });

    if (!targetFound) {
      const def = DEFAULT_HOME_WIDGETS.find((w) => w.id === typeOrId || w.type === typeOrId);
      if (def) {
        newWidgets.push({ ...def, visible: pinned });
      }
    }

    const updatedLayout: LayoutConfig = {
      ...layout,
      widgets: newWidgets,
    };

    set({ layout: updatedLayout });
    try {
      await api.saveLayout(updatedLayout);
    } catch (err) {
      console.error('Failed to persist widget pin:', err);
    }
  },

  toggleWidgetPin: async (typeOrId: WidgetType | string) => {
    const isPinned = get().isWidgetPinned(typeOrId);
    await get().setWidgetPin(typeOrId, !isPinned);
  },

  toggleWidgetVisibility: async (id: string) => {
    await get().toggleWidgetPin(id);
  },

  setWidgetVisibility: async (id: string, visible: boolean) => {
    await get().setWidgetPin(id, visible);
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

  resizeWidget: async (id: string, w: number, h: number) => {
    const clampedW = Math.max(3, Math.min(12, w));
    const clampedH = Math.max(1, Math.min(10, h));
    await get().updateWidgetPosition(id, { w: clampedW, h: clampedH });
  },

  resetLayout: async () => {
    set({ isLoading: true });
    try {
      const reset = await api.resetLayout();
      const resetWidgets = (reset.widgets && reset.widgets.length > 0)
        ? reset.widgets
        : DEFAULT_HOME_WIDGETS;

      const updatedLayout: LayoutConfig = {
        version: 5,
        active_workspace: 'home',
        widgets: resetWidgets,
      };

      set({
        layout: updatedLayout,
        isLoading: false,
        selectedWidgetId: null,
      });
      await api.saveLayout(updatedLayout);
    } catch (err) {
      console.error('Failed to reset layout:', err);
      set({
        layout: {
          version: 5,
          active_workspace: 'home',
          widgets: DEFAULT_HOME_WIDGETS,
        },
        isLoading: false,
      });
    }
  },
}));
