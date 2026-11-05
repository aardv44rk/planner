import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('lifeos-theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  }
  return 'light'; // Light Warm Beige is default as specified in AGENTS.md
};

const applyThemeToDOM = (theme: Theme) => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('lifeos-theme', theme);
  }
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme();
  applyThemeToDOM(initial);

  return {
    theme: initial,
    toggleTheme: () => {
      const next = get().theme === 'light' ? 'dark' : 'light';
      applyThemeToDOM(next);
      set({ theme: next });
    },
    setTheme: (theme) => {
      applyThemeToDOM(theme);
      set({ theme });
    },
  };
});
