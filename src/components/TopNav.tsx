import React, { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  LayoutGrid,
  Search,
  RotateCcw,
  Sliders,
  Calendar,
} from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { useLayoutStore } from '../stores/layoutStore';
import { useCommandCenterStore } from '../stores/commandCenterStore';

export const TopNav: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const { isEditMode, toggleEditMode, resetLayout } = useLayoutStore();
  const { setCommandPaletteOpen, selectedDate } = useCommandCenterStore();
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const str = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setFormattedDate(str);
    } catch {
      setFormattedDate(selectedDate);
    }
  }, [selectedDate]);

  return (
    <header className="flex-shrink-0 w-full h-11 bg-surface border-b border-subtle px-3.5 flex items-center justify-between transition-colors duration-150 select-none">
      {/* Left: App Title & Date Readout */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-accent" />
          <h1 className="text-sm font-semibold tracking-tight text-tx-primary">
            Command Center
          </h1>
        </div>
        <span className="text-subtle text-xs">/</span>
        <div className="flex items-center space-x-1 text-xs text-tx-muted">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Center: Search / Command Trigger */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs rounded border border-subtle bg-canvas/70 hover:bg-canvas hover:border-tx-muted/40 transition-colors text-tx-muted group"
          title="Open Command Palette (Ctrl+K or Cmd+K)"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-tx-muted group-hover:text-tx-primary transition-colors" />
            <span className="font-normal">
              Search anything or type a command...
            </span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-elevated border border-subtle text-tx-muted">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Actions (Theme Toggle & Layout Customizer) */}
      <div className="flex items-center space-x-2">
        {isEditMode && (
          <button
            onClick={() => resetLayout()}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border border-subtle bg-canvas hover:bg-elevated text-tx-muted hover:text-tx-primary transition-colors"
            title="Reset layout to default"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}

        <button
          onClick={toggleEditMode}
          className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
            isEditMode
              ? 'bg-accent text-white border-accent'
              : 'border-subtle bg-canvas hover:bg-elevated text-tx-muted hover:text-tx-primary'
          }`}
          title="Customize dashboard layout"
        >
          {isEditMode ? (
            <Sliders className="w-3.5 h-3.5" />
          ) : (
            <LayoutGrid className="w-3.5 h-3.5" />
          )}
          <span>{isEditMode ? 'Done Editing' : 'Customize'}</span>
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded border border-subtle bg-canvas hover:bg-elevated text-tx-muted hover:text-tx-primary transition-colors"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>
      </div>
    </header>
  );
};
