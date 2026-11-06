import { create } from 'zustand';
import { AppTab, GridSlot, LayoutConfig } from '../types';
import { api } from '../utils/ipc';

export const normalizeWidgetId = (id: string | null | undefined): string | null => {
  if (!id) return null;
  const clean = id.replace(/^widget-/, '');
  if (clean === 'kpis') return 'kpi_strip';
  if (clean === 'habit-matrix') return 'habit_matrix';
  if (clean === 'time-allocation') return 'time_allocation';
  if (clean === 'quick-notes') return 'quick_notes';
  return clean;
};

export const DEFAULT_SLOTS: GridSlot[] = [
  { id: 'slot-1', colSpan: 12, rowSpan: 1, widgetId: 'kpi_strip' },
  { id: 'slot-2', colSpan: 8, rowSpan: 2, widgetId: 'schedule' },
  { id: 'slot-3', colSpan: 4, rowSpan: 2, widgetId: 'tasks' },
  { id: 'slot-4', colSpan: 4, rowSpan: 2, widgetId: 'scratchpad' },
  { id: 'slot-5', colSpan: 4, rowSpan: 2, widgetId: 'projects' },
  { id: 'slot-6', colSpan: 4, rowSpan: 2, widgetId: 'time_allocation' },
  { id: 'slot-7', colSpan: 6, rowSpan: 2, widgetId: 'habit_matrix' },
  { id: 'slot-8', colSpan: 6, rowSpan: 2, widgetId: 'quick_notes' },
];

export const ALL_WIDGET_IDS = [
  'kpi_strip',
  'schedule',
  'tasks',
  'scratchpad',
  'projects',
  'time_allocation',
  'habit_matrix',
  'quick_notes',
] as const;

export const WIDGET_TITLES: Record<string, string> = {
  kpi_strip: 'Key Performance Indicators',
  schedule: 'Schedule & Agenda',
  tasks: "Today's Tasks",
  scratchpad: 'Daily Scratchpad',
  projects: 'Active Projects',
  time_allocation: 'Time Allocation',
  habit_matrix: 'Habit & Streak Grid',
  quick_notes: 'Quick Notes',
};

interface LayoutState {
  activeTab: AppTab;
  slots: GridSlot[];
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
  swapWidgetSlots: (activeWidgetId: string, overSlotId: string) => Promise<void>;
  reorderWidgets: (activeWidgetId: string, overSlotId: string) => Promise<void>;
  resizeSlot: (slotId: string, colSpan: number, rowSpan: number) => Promise<void>;
  isWidgetPinned: (id: string) => boolean;
  setWidgetPin: (id: string, pinned: boolean) => Promise<void>;
  toggleWidgetPin: (id: string) => Promise<void>;
  resetLayout: () => Promise<void>;
  persistSlots: (slots: GridSlot[]) => Promise<void>;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  activeTab: 'home',
  slots: DEFAULT_SLOTS,
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

  persistSlots: async (slots: GridSlot[]) => {
    const updatedLayout: LayoutConfig = {
      version: 6,
      active_workspace: 'home',
      slots,
      widgets: [],
    };
    set({ layout: updatedLayout });
    try {
      await api.saveLayout(updatedLayout);
    } catch (err) {
      console.error('Failed to persist slots layout:', err);
    }
  },

  fetchLayout: async () => {
    set({ isLoading: true });
    try {
      const layout = await api.getLayout();
      let resolvedSlots: GridSlot[];

      if (layout.slots && layout.slots.length > 0) {
        resolvedSlots = layout.slots;
      } else {
        resolvedSlots = DEFAULT_SLOTS;
      }

      set({
        layout: {
          ...layout,
          version: 6,
          active_workspace: 'home',
          slots: resolvedSlots,
        },
        slots: resolvedSlots,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to fetch layout:', err);
      set({
        layout: {
          version: 6,
          active_workspace: 'home',
          slots: DEFAULT_SLOTS,
        },
        slots: DEFAULT_SLOTS,
        isLoading: false,
      });
    }
  },

  swapWidgetSlots: async (activeWidgetId: string, overSlotId: string) => {
    const { slots } = get();
    const normActive = normalizeWidgetId(activeWidgetId);

    // Find sourceSlot where widgetId matches activeWidgetId
    const sourceIndex = slots.findIndex(
      (s) => s.widgetId && normalizeWidgetId(s.widgetId) === normActive
    );

    // Find targetSlot where id matches overSlotId (or widgetId matches overSlotId)
    const targetIndex = slots.findIndex(
      (s) => s.id === overSlotId || (s.widgetId && normalizeWidgetId(s.widgetId) === normalizeWidgetId(overSlotId))
    );

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    // Swap their widgetId values in the state array. Do not change slots' positions or dimensions.
    const newSlots = [...slots];
    const sourceWidget = newSlots[sourceIndex].widgetId;
    const targetWidget = newSlots[targetIndex].widgetId;

    newSlots[sourceIndex] = {
      ...newSlots[sourceIndex],
      widgetId: targetWidget,
    };
    newSlots[targetIndex] = {
      ...newSlots[targetIndex],
      widgetId: sourceWidget,
    };

    set({ slots: newSlots, selectedWidgetId: null });
    await get().persistSlots(newSlots);
  },

  reorderWidgets: async (activeWidgetId: string, overSlotId: string) => {
    await get().swapWidgetSlots(activeWidgetId, overSlotId);
  },

  resizeSlot: async (slotId: string, colSpan: number, rowSpan: number) => {
    const clampedCol = Math.max(3, Math.min(12, colSpan));
    const clampedRow = Math.max(1, Math.min(8, rowSpan));
    const { slots } = get();
    const newSlots = slots.map((s) =>
      s.id === slotId ? { ...s, colSpan: clampedCol, rowSpan: clampedRow } : s
    );
    set({ slots: newSlots });
    await get().persistSlots(newSlots);
  },

  isWidgetPinned: (id: string) => {
    const norm = normalizeWidgetId(id);
    const { slots } = get();
    return slots.some((s) => s.widgetId && normalizeWidgetId(s.widgetId) === norm);
  },

  setWidgetPin: async (id: string, pinned: boolean) => {
    const norm = normalizeWidgetId(id);
    if (!norm) return;
    const { slots } = get();

    if (!pinned) {
      // Unpin widget: set slot's widgetId to null
      const newSlots = slots.map((s) =>
        s.widgetId && normalizeWidgetId(s.widgetId) === norm ? { ...s, widgetId: null } : s
      );
      set({ slots: newSlots });
      await get().persistSlots(newSlots);
    } else {
      // Already pinned?
      if (slots.some((s) => s.widgetId && normalizeWidgetId(s.widgetId) === norm)) {
        return;
      }
      // Pin widget: find first empty slot or append
      const emptySlotIndex = slots.findIndex((s) => s.widgetId === null);
      let newSlots: GridSlot[];

      if (emptySlotIndex !== -1) {
        newSlots = [...slots];
        newSlots[emptySlotIndex] = {
          ...newSlots[emptySlotIndex],
          widgetId: norm,
        };
      } else {
        const newSlotId = `slot-${Date.now()}`;
        newSlots = [
          ...slots,
          { id: newSlotId, colSpan: 4, rowSpan: 2, widgetId: norm },
        ];
      }

      set({ slots: newSlots });
      await get().persistSlots(newSlots);
    }
  },

  toggleWidgetPin: async (id: string) => {
    const isPinned = get().isWidgetPinned(id);
    await get().setWidgetPin(id, !isPinned);
  },

  resetLayout: async () => {
    set({ isLoading: true });
    try {
      const reset = await api.resetLayout();
      const resetSlots = (reset.slots && reset.slots.length > 0)
        ? reset.slots
        : DEFAULT_SLOTS;

      set({
        layout: {
          version: 6,
          active_workspace: 'home',
          slots: resetSlots,
        },
        slots: resetSlots,
        isLoading: false,
        selectedWidgetId: null,
      });
      await get().persistSlots(resetSlots);
    } catch (err) {
      console.error('Failed to reset layout:', err);
      set({
        layout: {
          version: 6,
          active_workspace: 'home',
          slots: DEFAULT_SLOTS,
        },
        slots: DEFAULT_SLOTS,
        isLoading: false,
      });
    }
  },
}));
