import React, { useEffect, useState } from 'react';
import { Search, Calendar } from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';
import { useCommandCenterStore } from '../stores/commandCenterStore';
import { AppTab } from '../types';

const tabTitles: Record<AppTab, string> = {
  today: 'Today',
  courses: 'Courses',
  tasks: 'Tasks',
  schedule: 'Schedule',
  notes: 'Notes',
  habits: 'Habits',
  settings: 'Settings',
};

export const TopNav: React.FC = () => {
  const { activeTab } = useLayoutStore();
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

  return (
    <header className="flex-shrink-0 w-full h-[42px] bg-transparent px-3.5 flex items-center justify-between select-none border-b border-subtle">
      {/* Left: Domain Breadcrumb & Date */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="text-tx-primary font-semibold text-xs tracking-tight">
          {tabTitles[activeTab]}
        </span>
        <span className="text-muted text-xs">·</span>
        <div className="flex items-center space-x-1.5 text-muted text-[11px]">
          <Calendar className="w-3.5 h-3.5 stroke-[1.75]" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Center: Slim Search / Command trigger */}
      <div className="flex-1 max-w-sm mx-4">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1 text-xs rounded-[var(--radius-control)] border border-subtle bg-surface hover:border-[var(--line-strong)] transition-colors text-muted group shadow-subtle"
          title="Open Command Palette (Ctrl+K)"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 stroke-[1.75] text-muted group-hover:text-tx-primary transition-colors" />
            <span className="text-[12px]">
              Search or type a command...
            </span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded-[var(--radius-chip)] bg-surface-3 border border-subtle text-muted">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right spacer for alignment */}
      <div className="w-8" />
    </header>
  );
};
