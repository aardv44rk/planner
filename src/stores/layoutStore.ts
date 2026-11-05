import { create } from 'zustand';
import { LayoutConfig, WidgetConfig } from '../types';
import { api } from '../utils/ipc';

interface LayoutState {
  layout: LayoutConfig | null;
  isLoading: boolean;
  isEditMode: boolean;
  selectedWidgetId: string | null;
  toggleEditMode: () => void;
  setSelectedWidgetId: (id: string | null) => void;
  fetchLayout: () => Promise<void>;
  swapWidgets: (idA: string, idB: string) => Promise<void>;
  updateWidgetPosition: (id: string, updates: Partial<WidgetConfig>) => Promise<void>;
  toggleWidgetVisibility: (id: string) => Promise<void>;
  resetLayout: () => Promise<void>;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  layout: null,
  isLoading: false,
  isEditMode: false,
  selectedWidgetId: null,

  toggleEditMode: () => {
    set((state) => ({
      isEditMode: !state.isEditMode,
      selectedWidgetId: null,
    }));
  },

  setSelectedWidgetId: (id) => set({ selectedWidgetId: id }),

  fetchLayout: async () => {
    set({ isLoading: true });
    try {
      const layout = await api.getLayout();
      set({ layout, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch layout:', err);
      set({ isLoading: false });
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

    // Swap x, y, and order
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

    const newWidgets = layout.widgets.map((w) =>
      w.id === id ? { ...w, visible: !w.visible } : w
    );

    const updatedLayout: LayoutConfig = {
      ...layout,
      widgets: newWidgets,
    };

    set({ layout: updatedLayout });
    try {
      await api.saveLayout(updatedLayout);
    } catch (err) {
      console.error('Failed to toggle widget visibility:', err);
    }
  },

  resetLayout: async () => {
    set({ isLoading: true });
    try {
      const layout = await api.resetLayout();
      set({ layout, isLoading: false, selectedWidgetId: null });
    } catch (err) {
      console.error('Failed to reset layout:', err);
      set({ isLoading: false });
    }
  },
}));
