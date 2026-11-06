import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  Calendar,
  Sliders,
  Plus,
  Check,
  LayoutGrid,
  Clock,
  FileText,
  CheckSquare,
  FolderKanban,
  PieChart,
  Sparkles,
  Bookmark,
  BarChart3,
  X,
} from 'lucide-react';
import { useLayoutStore, ALL_WIDGET_IDS, WIDGET_TITLES } from '../stores/layoutStore';
import { useCommandCenterStore } from '../stores/commandCenterStore';
import { AppTab } from '../types';

const tabTitles: Record<AppTab, string> = {
  today: 'Today Workspace',
  courses: 'Courses & LMS',
  tasks: 'Tasks & Projects',
  schedule: 'Calendar & Schedule',
  notes: 'Notes & Vault',
  habits: 'Habits & Metrics',
  settings: 'Institutions & Settings',
  home: 'Home Dashboard',
};

const widgetIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  kpi_strip: BarChart3,
  schedule: Clock,
  scratchpad: FileText,
  tasks: CheckSquare,
  projects: FolderKanban,
  time_allocation: PieChart,
  habit_matrix: Sparkles,
  quick_notes: Bookmark,
};

export const TopNav: React.FC = () => {
  const {
    activeTab,
    isEditMode,
    toggleEditMode,
    toggleWidgetPin,
    isWidgetPinned,
  } = useLayoutStore();

  const { setCommandPaletteOpen, selectedDate } = useCommandCenterStore();
  const [formattedDate, setFormattedDate] = useState<string>('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

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

  // Close add widget dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddMenuOpen]);


  return (
    <header className="flex-shrink-0 w-full h-[42px] bg-transparent px-3.5 flex items-center justify-between select-none border-b border-subtle">
      {/* Left: Domain Breadcrumb & Date */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="font-semibold text-tx-primary tracking-tight">
          LifeOS
        </span>
        <span className="text-muted text-xs">/</span>
        <span className="text-tx-primary font-medium text-xs">
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

      {/* Right: Home Controls ("+ Add Widget" Popover & "Customize Layout") */}
      <div className="flex items-center space-x-2 relative">
        {activeTab === 'home' && (
          <>
            {/* + Add Widget Dropdown Button */}
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-control)] border transition-colors shadow-subtle ${
                  isAddMenuOpen
                    ? 'bg-accent-soft border-accent text-accent'
                    : 'bg-surface border-subtle text-tx-primary hover:bg-elevated'
                }`}
                title="Add unpinned widgets to Home screen"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2]" />
                <span>+ Add Widget</span>
              </button>

              {/* Popover Dropdown */}
              {isAddMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-[var(--radius-surface)] bg-surface border border-subtle shadow-panel p-2 z-50 animate-scale-in">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-subtle px-1">
                    <span className="text-[11px] font-semibold text-tx-primary uppercase tracking-wider">
                      Add to Home Screen
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddMenuOpen(false)}
                      className="text-muted hover:text-tx-primary p-0.5 rounded-[var(--radius-chip)]"
                    >
                      <X className="w-3.5 h-3.5 stroke-[1.75]" />
                    </button>
                  </div>

                  <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                    {ALL_WIDGET_IDS.map((widgetId) => {
                      const Icon = widgetIconMap[widgetId] || LayoutGrid;
                      const isPinned = isWidgetPinned(widgetId);
                      const title = WIDGET_TITLES[widgetId] || widgetId;

                      return (
                        <div
                          key={widgetId}
                          onClick={() => toggleWidgetPin(widgetId)}
                          className="flex items-center justify-between p-2 rounded-[var(--radius-control)] hover:bg-elevated cursor-pointer transition-colors"
                        >
                          <div className="flex items-center space-x-2 min-w-0 pr-2">
                            <Icon className={`w-4 h-4 flex-shrink-0 stroke-[1.75] ${isPinned ? 'text-accent' : 'text-muted'}`} />
                            <span className="text-xs text-tx-primary truncate font-medium">
                              {title}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWidgetPin(widgetId);
                            }}
                            className={`flex items-center space-x-1 px-2 py-0.5 rounded-[var(--radius-chip)] text-[10px] font-semibold transition-colors ${
                              isPinned
                                ? 'bg-accent-soft text-accent border border-accent/20'
                                : 'bg-surface-3 text-muted border border-subtle hover:text-tx-primary'
                            }`}
                          >
                            {isPinned ? (
                              <>
                                <Check className="w-3 h-3 stroke-[2]" />
                                <span>Pinned</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3 stroke-[2]" />
                                <span>Add</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Customize Layout Toggle */}
            <button
              type="button"
              onClick={toggleEditMode}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-control)] transition-colors shadow-subtle ${
                isEditMode
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-subtle text-muted hover:text-tx-primary hover:bg-elevated'
              }`}
              title={isEditMode ? 'Finish customizing home layout' : 'Customize layout coordinates'}
            >
              <Sliders className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>{isEditMode ? 'Done Customizing' : 'Customize Layout'}</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
