import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type ThemePreset = 'default' | 'cool' | 'paper' | 'mist' | 'moss';
export type UiScale = 'compact' | 'default' | 'comfortable';

interface ThemeState {
  theme: Theme;
  preset: ThemePreset;
  uiScale: UiScale;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setPreset: (preset: ThemePreset) => void;
  setUiScale: (scale: UiScale) => void;
  setThemeAndPreset: (theme: Theme, preset: ThemePreset) => void;
}

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lifeos-theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  }
  return 'light';
};

const getInitialPreset = (): ThemePreset => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lifeos-preset');
    if (saved === 'default' || saved === 'cool' || saved === 'paper' || saved === 'mist' || saved === 'moss') {
      return saved;
    }
  }
  return 'default';
};

const getInitialScale = (): UiScale => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lifeos-scale');
    if (saved === 'compact' || saved === 'default' || saved === 'comfortable') {
      return saved;
    }
  }
  return 'default';
};

const applyAllToDOM = (theme: Theme, preset: ThemePreset, scale: UiScale) => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;

    // Appearance
    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-appearance', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-appearance', 'light');
    }

    // Palette Preset
    root.setAttribute('data-theme', preset);

    // Font Scale
    if (scale === 'compact') {
      root.style.fontSize = '13px';
    } else if (scale === 'comfortable') {
      root.style.fontSize = '15px';
    } else {
      root.style.fontSize = '14px';
    }

    localStorage.setItem('lifeos-theme', theme);
    localStorage.setItem('lifeos-preset', preset);
    localStorage.setItem('lifeos-scale', scale);
  }
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme = getInitialTheme();
  const initialPreset = getInitialPreset();
  const initialScale = getInitialScale();

  applyAllToDOM(initialTheme, initialPreset, initialScale);

  return {
    theme: initialTheme,
    preset: initialPreset,
    uiScale: initialScale,
    toggleTheme: () => {
      const nextTheme = get().theme === 'light' ? 'dark' : 'light';
      applyAllToDOM(nextTheme, get().preset, get().uiScale);
      set({ theme: nextTheme });
    },
    setTheme: (theme) => {
      applyAllToDOM(theme, get().preset, get().uiScale);
      set({ theme });
    },
    setPreset: (preset) => {
      applyAllToDOM(get().theme, preset, get().uiScale);
      set({ preset });
    },
    setUiScale: (uiScale) => {
      applyAllToDOM(get().theme, get().preset, uiScale);
      set({ uiScale });
    },
    setThemeAndPreset: (theme, preset) => {
      applyAllToDOM(theme, preset, get().uiScale);
      set({ theme, preset });
    },
  };
});
