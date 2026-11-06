import React, { useEffect } from 'react';
import {
  LayoutGrid,
  CheckSquare,
  Clock,
  FileText,
  Sparkles,
  Sliders,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  Calendar,
  FolderKanban,
  PieChart,
  BarChart3,
  Bookmark,
  Pin,
} from 'lucide-react';
import { useLayoutStore, ALL_WIDGET_IDS, WIDGET_TITLES } from '../stores/layoutStore';
import { useThemeStore } from '../stores/themeStore';
import { useCommandCenterStore } from '../stores/commandCenterStore';
import { AppTab } from '../types';

interface NavItem {
  id: AppTab;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navTabs: NavItem[] = [
  {
    id: 'home',
    label: 'Home Dashboard',
    shortDesc: 'Customizable Bento Grid',
    icon: LayoutGrid,
  },
  {
    id: 'tasks',
    label: 'Tasks & Projects',
    shortDesc: 'Task manager & project tracking',
    icon: CheckSquare,
  },
  {
    id: 'schedule',
    label: 'Calendar & Schedule',
    shortDesc: 'Timeline & agenda',
    icon: Clock,
  },
  {
    id: 'notes',
    label: 'Notes & Vault',
    shortDesc: 'Daily scratchpads & Markdown',
    icon: FileText,
  },
  {
    id: 'habits',
    label: 'Habits & Metrics',
    shortDesc: 'Streak matrix & time analytics',
    icon: Sparkles,
  },
];

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

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    slots,
    isEditMode,
    toggleEditMode,
    isSidebarExpanded,
    toggleSidebar,
    toggleWidgetPin,
    resetLayout,
    isWidgetPinned,
  } = useLayoutStore();

  const { theme, toggleTheme } = useThemeStore();
  const {
    tasks,
    notesHistory,
    selectedDate,
    setSelectedDate,
    habitMatrix,
    metrics,
    scheduleBlocks,
  } = useCommandCenterStore();

  // Keyboard shortcut Ctrl+\ / Cmd+\ to toggle expanded sub-navigation drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Project breakdown for tasks sub-nav
  const projectCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    const proj = t.project || 'General';
    acc[proj] = (acc[proj] || 0) + 1;
    return acc;
  }, {});

  return (
    <aside className="h-full flex flex-shrink-0 z-30 select-none border-r border-subtle transition-all duration-200">
      {/* 44px Icon Rail */}
      <div className="w-11 h-full bg-surface flex flex-col items-center justify-between py-2 border-r border-subtle/50">
        {/* Top: Brand Logo & 5 Domain Navigation Tabs */}
        <div className="flex flex-col items-center space-y-1.5 w-full">
          {/* Logo Mark */}
          <div
            onClick={() => setActiveTab('home')}
            className="w-7 h-7 rounded flex items-center justify-center text-accent font-bold text-xs tracking-tighter mb-1 bg-elevated border border-subtle/80 cursor-pointer hover:border-accent/50 transition-colors"
            title="LifeOS Command Center"
          >
            CC
          </div>

          <div className="w-6 h-[1px] bg-subtle/60 my-0.5" />

          {/* 5 Primary Application Tabs */}
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-8 h-8 rounded flex items-center justify-center transition-all relative ${
                  isActive
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-tx-muted hover:text-tx-primary hover:bg-elevated'
                }`}
                title={`${tab.label} (${tab.shortDesc})`}
              >
                <Icon className="w-4 h-4" />
                {isActive && (
                  <span className="absolute -left-1 top-2.5 w-0.5 h-3 bg-accent rounded-r" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom: Customization, Theme Switcher, Expand Drawer Toggle */}
        <div className="flex flex-col items-center space-y-1.5 w-full">
          {/* Customization Toggle */}
          <button
            onClick={toggleEditMode}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isEditMode
                ? 'bg-accent text-white'
                : 'text-tx-muted hover:text-tx-primary hover:bg-elevated'
            }`}
            title={isEditMode ? 'Exit Customization Mode' : 'Customize Home Layout (Drag & Resize)'}
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded flex items-center justify-center text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors"
            title={`Switch to ${theme === 'light' ? 'Obsidian Dark' : 'Warm Beige'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {/* Expand / Collapse Drawer Toggle */}
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 rounded flex items-center justify-center text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors"
            title={isSidebarExpanded ? 'Collapse Sub-navigation (Ctrl+\\)' : 'Expand Sub-navigation (Ctrl+\\)'}
          >
            {isSidebarExpanded ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* 230px Contextual Collapsible Panel */}
      {isSidebarExpanded && (
        <div className="w-56 h-full bg-surface border-r border-subtle flex flex-col min-h-0 overflow-hidden animate-slide-right">
          {/* Header showing Active Domain Tab title */}
          <div className="flex-shrink-0 p-2.5 border-b border-subtle flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-tx-primary truncate pr-1">
              {navTabs.find((t) => t.id === activeTab)?.label}
            </span>
            <span className="text-[10px] text-tx-muted font-mono flex-shrink-0">
              Ctrl+\
            </span>
          </div>

          {/* Contextual Sub-navigation Content */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2.5 space-y-3">
            {/* SUB-NAV 1: HOME (Pinned Widgets list + quick pin toggles) */}
            {activeTab === 'home' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-muted">
                    Pinned to Home
                  </span>
                  <span className="text-[10px] font-mono text-accent">
                    {slots.filter((s) => s.widgetId !== null).length}/
                    {ALL_WIDGET_IDS.length}
                  </span>
                </div>

                <div className="space-y-1">
                  {ALL_WIDGET_IDS.map((widgetId) => {
                    const Icon = widgetIconMap[widgetId] || LayoutGrid;
                    const isPinned = isWidgetPinned(widgetId);
                    const title = WIDGET_TITLES[widgetId] || widgetId;

                    return (
                      <div
                        key={widgetId}
                        onClick={() => toggleWidgetPin(widgetId)}
                        className={`flex items-center justify-between p-1.5 rounded transition-colors cursor-pointer border ${
                          isPinned
                            ? 'bg-elevated/70 border-subtle/50 text-tx-primary'
                            : 'bg-transparent border-transparent text-tx-muted hover:bg-elevated/40'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0 pr-1">
                          <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isPinned ? 'text-accent' : 'text-tx-muted'}`} />
                          <span className={`text-[11px] truncate ${isPinned ? 'font-medium' : 'line-through text-tx-muted/60'}`}>
                            {title}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWidgetPin(widgetId);
                          }}
                          className={`p-1 rounded transition-colors ${
                            isPinned
                              ? 'text-accent hover:bg-accent/10'
                              : 'text-tx-muted hover:text-tx-primary hover:bg-canvas'
                          }`}
                          title={isPinned ? 'Unpin from Home' : 'Pin to Home'}
                        >
                          {isPinned ? (
                            <Eye className="w-3 h-3 text-accent" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-tx-muted" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-subtle/50 space-y-1">
                  <button
                    onClick={toggleEditMode}
                    className={`w-full flex items-center space-x-2 px-2 py-1.5 text-xs rounded transition-colors ${
                      isEditMode
                        ? 'bg-accent text-white font-medium'
                        : 'text-tx-muted hover:text-tx-primary hover:bg-elevated'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{isEditMode ? 'Finish Customizing' : 'Customize Layout'}</span>
                  </button>

                  <button
                    onClick={() => resetLayout()}
                    className="w-full flex items-center space-x-2 px-2 py-1.5 text-xs text-tx-muted hover:text-tx-primary rounded hover:bg-elevated transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Home Layout</span>
                  </button>
                </div>
              </div>
            )}

            {/* SUB-NAV 2: TASKS (Project Filters & Stats) */}
            {activeTab === 'tasks' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-muted">
                    Project Breakdown
                  </span>
                  <span className="text-[10px] font-mono text-tx-muted">
                    {tasks.length} Total
                  </span>
                </div>

                <div className="space-y-1">
                  {Object.entries(projectCounts).map(([projName, count]) => (
                    <div
                      key={projName}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-elevated/60 text-xs transition-colors"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <FolderKanban className="w-3 h-3 text-accent flex-shrink-0" />
                        <span className="truncate text-tx-primary text-[11px]">{projName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-tx-muted px-1.5 py-0.2 rounded bg-elevated">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-subtle/50 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-muted block mb-1">
                    Home Screen Pins
                  </span>
                  <button
                    onClick={() => toggleWidgetPin('widget-tasks')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded bg-elevated/40 hover:bg-elevated border border-subtle/40 text-tx-primary"
                  >
                    <span className="text-[11px]">Tasks Widget</span>
                    {isWidgetPinned('widget-tasks') ? (
                      <Check className="w-3 h-3 text-accent" />
                    ) : (
                      <Pin className="w-3 h-3 text-tx-muted" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleWidgetPin('widget-projects')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded bg-elevated/40 hover:bg-elevated border border-subtle/40 text-tx-primary"
                  >
                    <span className="text-[11px]">Projects Widget</span>
                    {isWidgetPinned('widget-projects') ? (
                      <Check className="w-3 h-3 text-accent" />
                    ) : (
                      <Pin className="w-3 h-3 text-tx-muted" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* SUB-NAV 3: SCHEDULE (Date quick selection & today summary) */}
            {activeTab === 'schedule' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-muted">
                    Schedule Info
                  </span>
                  <span className="text-[10px] font-mono text-tx-muted">
                    {scheduleBlocks.length} Events
                  </span>
                </div>

                <div className="p-2 rounded bg-elevated/40 border border-subtle/50 space-y-1 text-xs">
                  <div className="text-[10px] text-tx-muted">Selected Date:</div>
                  <div className="font-mono text-tx-primary text-xs font-semibold">
                    {selectedDate}
                  </div>
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    className="mt-1 text-[10px] text-accent hover:underline flex items-center space-x-1"
                  >
                    <Calendar className="w-2.5 h-2.5" />
                    <span>Jump to Today</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-subtle/50">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-muted block mb-1">
                    Home Screen Pin
                  </span>
                  <button
                    onClick={() => toggleWidgetPin('widget-schedule')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded bg-elevated/40 hover:bg-elevated border border-subtle/40 text-tx-primary"
                  >
                    <span className="text-[11px]">Schedule Widget</span>
                    {isWidgetPinned('widget-schedule') ? (
                      <Check className="w-3 h-3 text-accent" />
                    ) : (
                      <Pin className="w-3 h-3 text-tx-muted" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* SUB-NAV 4: NOTES (Daily Notes History Tree) */}
            {activeTab === 'notes' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-muted">
                    Daily Notes
                  </span>
                  <span className="text-[10px] font-mono text-tx-muted">
                    {notesHistory.length} Recorded
                  </span>
                </div>

                <div className="space-y-1">
                  {notesHistory.length === 0 ? (
                    <div className="text-xs text-tx-muted py-2 text-center">
                      No archived notes yet.
                    </div>
                  ) : (
                    notesHistory.slice(0, 10).map((dStr) => {
                      const isSelected = dStr === selectedDate;
                      return (
                        <button
                          key={dStr}
                          onClick={() => setSelectedDate(dStr)}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                            isSelected
                              ? 'bg-accent text-white font-medium shadow-xs'
                              : 'text-tx-primary hover:bg-elevated'
                          }`}
                        >
                          <span className="font-mono text-[11px]">{dStr}</span>
                          {isSelected && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="pt-2 border-t border-subtle/50 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-muted block mb-1">
                    Home Screen Pins
                  </span>
                  <button
                    onClick={() => toggleWidgetPin('widget-scratchpad')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded bg-elevated/40 hover:bg-elevated border border-subtle/40 text-tx-primary"
                  >
                    <span className="text-[11px]">Daily Scratchpad</span>
                    {isWidgetPinned('widget-scratchpad') ? (
                      <Check className="w-3 h-3 text-accent" />
                    ) : (
                      <Pin className="w-3 h-3 text-tx-muted" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleWidgetPin('widget-quick-notes')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded bg-elevated/40 hover:bg-elevated border border-subtle/40 text-tx-primary"
                  >
                    <span className="text-[11px]">Quick Notes</span>
                    {isWidgetPinned('widget-quick-notes') ? (
                      <Check className="w-3 h-3 text-accent" />
                    ) : (
                      <Pin className="w-3 h-3 text-tx-muted" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* SUB-NAV 5: HABITS (Habits Overview & Streaks) */}
            {activeTab === 'habits' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-muted">
                    Habits & Streaks
                  </span>
                  <span className="text-[10px] font-mono text-accent">
                    {metrics?.active_streak_days ?? 7}d streak
                  </span>
                </div>

                <div className="space-y-1">
                  {habitMatrix.map((habit) => {
                    const completedCount = habit.days.filter(Boolean).length;
                    return (
                      <div
                        key={habit.id}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-elevated/60 text-xs transition-colors"
                      >
                        <span className="truncate text-[11px] text-tx-primary flex-1 pr-1">
                          {habit.habit_name}
                        </span>
                        <span className="text-[9px] font-mono text-tx-muted px-1.5 py-0.2 rounded bg-elevated">
                          {completedCount}/7
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-subtle/50 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-tx-muted block mb-1">
                    Home Screen Pins
                  </span>
                  <button
                    onClick={() => toggleWidgetPin('widget-habit-matrix')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded bg-elevated/40 hover:bg-elevated border border-subtle/40 text-tx-primary"
                  >
                    <span className="text-[11px]">Habit Matrix</span>
                    {isWidgetPinned('widget-habit-matrix') ? (
                      <Check className="w-3 h-3 text-accent" />
                    ) : (
                      <Pin className="w-3 h-3 text-tx-muted" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleWidgetPin('widget-time-allocation')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded bg-elevated/40 hover:bg-elevated border border-subtle/40 text-tx-primary"
                  >
                    <span className="text-[11px]">Time Allocation</span>
                    {isWidgetPinned('widget-time-allocation') ? (
                      <Check className="w-3 h-3 text-accent" />
                    ) : (
                      <Pin className="w-3 h-3 text-tx-muted" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleWidgetPin('widget-kpis')}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded bg-elevated/40 hover:bg-elevated border border-subtle/40 text-tx-primary"
                  >
                    <span className="text-[11px]">Key Performance Strip</span>
                    {isWidgetPinned('widget-kpis') ? (
                      <Check className="w-3 h-3 text-accent" />
                    ) : (
                      <Pin className="w-3 h-3 text-tx-muted" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
