import React, { useEffect, useState } from 'react';
import {
  Search,
  Calendar,
  Sliders,
} from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';
import { useCommandCenterStore } from '../stores/commandCenterStore';

export const TopNav: React.FC = () => {
  const { activeWorkspace, isEditMode, toggleEditMode } = useLayoutStore();
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
      });
      setFormattedDate(str);
    } catch {
      setFormattedDate(selectedDate);
    }
  }, [selectedDate]);

  const workspaceNames = {
    focus: 'Focus View',
    full: 'Full Dashboard',
    analytics: 'Analytics View',
  };

  return (
    <header className="flex-shrink-0 w-full h-10 bg-transparent px-3 flex items-center justify-between select-none">
      {/* Left: Workspace breadcrumb & date */}
      <div className="flex items-center space-x-2.5 text-xs">
        <span className="font-semibold text-tx-primary tracking-tight">
          LifeOS
        </span>
        <span className="text-subtle text-xs">/</span>
        <span className="text-tx-muted font-medium text-[11px] capitalize">
          {workspaceNames[activeWorkspace] || activeWorkspace}
        </span>
        <span className="text-subtle text-xs">·</span>
        <div className="flex items-center space-x-1 text-tx-muted text-[11px]">
          <Calendar className="w-3 h-3 text-tx-muted" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Center: Slim Search / Command trigger */}
      <div className="flex-1 max-w-sm mx-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-2.5 py-1 text-xs rounded border border-subtle/80 bg-surface/60 hover:bg-surface hover:border-tx-muted/40 transition-colors text-tx-muted group"
          title="Open Command Palette (Ctrl+K)"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3 h-3 text-tx-muted group-hover:text-tx-primary transition-colors" />
            <span className="text-[11px]">
              Search or type a command...
            </span>
          </div>
          <kbd className="px-1 py-0.2 text-[9px] font-mono rounded bg-elevated border border-subtle text-tx-muted">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Customization Indicator */}
      <div className="flex items-center space-x-2">
        {isEditMode && (
          <button
            onClick={toggleEditMode}
            className="flex items-center space-x-1 px-2 py-0.5 text-[10px] rounded bg-accent text-white font-medium"
          >
            <Sliders className="w-3 h-3" />
            <span>Editing Layout</span>
          </button>
        )}
      </div>
    </header>
  );
};
