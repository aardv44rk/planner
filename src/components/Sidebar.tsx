import React, { useEffect } from 'react';
import {
  CalendarDays,
  BookOpen,
  CheckSquare,
  Clock,
  FileText,
  Sparkles,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Calendar,
  FolderKanban,
  Check,
  KeyRound,
} from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';
import { useThemeStore } from '../stores/themeStore';
import { useCommandCenterStore } from '../stores/commandCenterStore';
import { courseMatchesQuarter, sortCoursesForDisplay, getAvailableAcademicYears } from '../utils/academic';
import { AppTab } from '../types';

interface NavItem {
  id: AppTab;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navTabs: NavItem[] = [
  {
    id: 'today',
    label: 'Today',
    shortDesc: 'Daily agenda & active focus',
    icon: CalendarDays,
  },
  {
    id: 'courses',
    label: 'Courses',
    shortDesc: 'Course outlines & tasks',
    icon: BookOpen,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    shortDesc: 'Task manager & project tracking',
    icon: CheckSquare,
  },
  {
    id: 'schedule',
    label: 'Schedule',
    shortDesc: 'Timeline & agenda',
    icon: Clock,
  },
  {
    id: 'notes',
    label: 'Notes',
    shortDesc: 'Daily scratchpads & Markdown',
    icon: FileText,
  },
  {
    id: 'habits',
    label: 'Habits',
    shortDesc: 'Streak matrix & time analytics',
    icon: Sparkles,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortDesc: 'University Auth & OS Vault',
    icon: KeyRound,
  },
];

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isSidebarExpanded,
    toggleSidebar,
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
    courses,
    selectedQuarter,
    setSelectedQuarter,
    selectedAcademicYear,
    setSelectedAcademicYear,
    currentAcademicYear,
    currentQuarter,
    fetchCourses,
  } = useCommandCenterStore();

  useEffect(() => {
    fetchCourses();
  }, []);

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

  // Academic year and quarter courses filtered properly
  const availableAcademicYears = getAvailableAcademicYears(courses);
  const activeYearCourses = courses.filter((c) =>
    courseMatchesQuarter(c.term, selectedQuarter, selectedAcademicYear)
  );
  const sortedSidebarCourses = sortCoursesForDisplay(activeYearCourses);

  return (
    <aside className="h-full flex flex-shrink-0 z-30 select-none">
      {/* 72px Reference Navigation Rail (.rail) */}
      <div className="w-[72px] h-full flex flex-col items-center justify-between p-[14px_8px] border-r border-subtle bg-[color-mix(in_srgb,var(--surface)_70%,var(--bg))] flex-shrink-0 select-none">
        {/* Top: Brand Logo & Navigation Tabs */}
        <div className="flex flex-col items-center w-full gap-1">
          {/* Brand Mark */}
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className="w-10 h-10 rounded-[10px] flex items-center justify-center text-accent font-bold text-xs tracking-tight mb-2 bg-surface-2 border border-subtle hover:border-accent hover:bg-elevated transition-all cursor-pointer shadow-subtle select-none"
            title="LifeOS Command Center"
          >
            CC
          </button>

          {/* Primary Navigation Tabs */}
          <nav className="grid gap-1 w-full" aria-label="Main Navigation">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full border-0 rounded-[9px] grid justify-items-center gap-1 py-2 px-0 transition-colors select-none ${
                    isActive
                      ? 'bg-accent-soft text-accent'
                      : 'text-muted hover:bg-elevated hover:text-tx-primary'
                  }`}
                  title={`${tab.label} (${tab.shortDesc})`}
                >
                  <Icon className="w-5 h-5 stroke-[1.75]" />
                  <span className="text-[11px] font-semibold leading-none text-center">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Utility Items (.railUtility) */}
        <div className="flex flex-col items-center w-full gap-1 mt-auto pt-2 border-t border-subtle/50">
          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full border-0 rounded-[9px] grid justify-items-center gap-1 py-2 px-0 text-muted hover:bg-elevated hover:text-tx-primary transition-colors select-none"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 stroke-[1.75]" />
            ) : (
              <Sun className="w-5 h-5 stroke-[1.75] text-amber-500" />
            )}
            <span className="text-[11px] font-semibold leading-none">
              {theme === 'light' ? 'Dark' : 'Light'}
            </span>
          </button>

          {/* Sub-navigation Drawer Toggle */}
          <button
            type="button"
            onClick={toggleSidebar}
            className={`w-full border-0 rounded-[9px] grid justify-items-center gap-1 py-2 px-0 transition-colors select-none ${
              isSidebarExpanded
                ? 'bg-surface-3 text-tx-primary'
                : 'text-muted hover:bg-elevated hover:text-tx-primary'
            }`}
            title={isSidebarExpanded ? 'Collapse Sub-navigation (Ctrl+\\)' : 'Expand Sub-navigation (Ctrl+\\)'}
          >
            {isSidebarExpanded ? (
              <ChevronLeft className="w-5 h-5 stroke-[1.75]" />
            ) : (
              <ChevronRight className="w-5 h-5 stroke-[1.75]" />
            )}
            <span className="text-[11px] font-semibold leading-none">
              {isSidebarExpanded ? 'Collapse' : 'Expand'}
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible Sub-navigation Drawer */}
      <div
        className={`h-full bg-surface-2 flex flex-col min-h-0 overflow-hidden transition-[width,opacity] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
          isSidebarExpanded
            ? 'w-[230px] opacity-100 border-r border-subtle pointer-events-auto'
            : 'w-0 opacity-0 border-r-0 pointer-events-none'
        }`}
      >
        <div className="w-[230px] h-full flex flex-col min-h-0">
          {/* Header showing Active Domain Tab title */}
          <div className="flex-shrink-0 h-[42px] px-3 bg-surface-3 border-b border-subtle flex items-center justify-between">
            <span className="text-[12px] font-semibold text-tx-primary truncate pr-1">
              {navTabs.find((t) => t.id === activeTab)?.label ?? 'Workspace'}
            </span>
            <span className="text-[10px] text-muted font-mono px-1.5 py-0.5 rounded-[6px] bg-surface border border-subtle flex-shrink-0">
              Ctrl+\
            </span>
          </div>

          {/* Contextual Sub-navigation Content */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {/* SUB-NAV 1: TODAY (Daily Focus & Portal Info) */}
            {activeTab === 'today' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted block">
                    Today's Focus
                  </span>

                  <div className="p-2.5 rounded-[10px] bg-surface border border-subtle space-y-1.5 text-xs shadow-subtle">
                    <div className="text-[10px] text-muted">Selected Date:</div>
                    <div className="font-mono text-tx-primary text-xs font-semibold">
                      {selectedDate}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className="mt-1 text-[11px] text-accent hover:underline flex items-center space-x-1"
                    >
                      <Calendar className="w-3 h-3 stroke-[1.75]" />
                      <span>Jump to Today</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between p-2 rounded-[10px] bg-surface border border-subtle text-xs">
                    <span className="text-muted text-[11px]">Daily Schedule</span>
                    <span className="font-mono font-semibold text-accent text-[11px]">
                      {scheduleBlocks.length} Blocks
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-[10px] bg-surface border border-subtle text-xs">
                    <span className="text-muted text-[11px]">Tasks Due</span>
                    <span className="font-mono font-semibold text-tx-primary text-[11px]">
                      {tasks.filter((t) => t.completed === 0).length} Open
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-[10px] bg-surface border border-subtle text-xs">
                    <span className="text-muted text-[11px]">Active Streak</span>
                    <span className="font-mono font-semibold text-ok text-[11px]">
                      {metrics?.active_streak_days ?? 7} Days
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-NAV 2: COURSES & LMS */}
            {activeTab === 'courses' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted">
                    Enrolled Classes
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[6px] bg-surface-3 text-accent font-semibold">
                    {sortedSidebarCourses.length} Active
                  </span>
                </div>

                {/* Academic Year Switcher (Active vs Archive) */}
                {availableAcademicYears.length > 1 && (
                  <div className="flex items-center gap-1 bg-surface-3 p-0.5 rounded-[var(--radius-control)]">
                    {availableAcademicYears.map((yr) => {
                      const isSel = selectedAcademicYear === yr;
                      const isCurrent = Number(yr) === currentAcademicYear;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setSelectedAcademicYear(yr)}
                          className={`flex-1 text-[10px] py-0.5 rounded-[var(--radius-chip)] font-mono transition-colors cursor-pointer text-center ${
                            isSel
                              ? 'bg-surface text-tx-primary font-semibold shadow-xs'
                              : 'text-muted hover:text-tx-primary'
                          }`}
                        >
                          {yr} {isCurrent ? 'AY' : 'Arc'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Quarter Filter Chips in Sidebar */}
                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
                  {['3Q', '4Q', '1Q', '2Q', 'All'].map((q) => {
                    const isSel = selectedQuarter === q;
                    const isNow = q === currentQuarter && Number(selectedAcademicYear) === currentAcademicYear;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setSelectedQuarter(q)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono transition-colors cursor-pointer flex items-center space-x-1 ${
                          isSel
                            ? 'bg-accent text-white font-semibold shadow-xs'
                            : 'bg-surface text-muted hover:text-tx-primary hover:bg-surface-3'
                        }`}
                      >
                        <span>{q}</span>
                        {isNow && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                  {sortedSidebarCourses.map((c) => (
                    <div
                      key={c.id}
                      className="p-2 rounded-[10px] bg-surface border border-subtle text-xs flex items-center justify-between hover:border-accent/40 transition-colors"
                    >
                      <div className="min-w-0 pr-1">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: c.color || 'var(--accent)' }}
                          />
                          <span className="font-mono font-bold text-accent text-[11px] truncate">
                            {c.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-tx-primary truncate max-w-[130px] mt-0.5" title={c.title}>
                          {c.title}
                        </div>
                      </div>
                      <span className="text-[9px] text-muted font-mono flex-shrink-0">
                        {c.assignments?.length ? `${c.assignments.length} Tasks` : 'Active'}
                      </span>
                    </div>
                  ))}
                  {sortedSidebarCourses.length === 0 && (
                    <div className="text-center py-4 text-[11px] text-muted">
                      No courses found for {selectedAcademicYear} {selectedQuarter}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-NAV 3: TASKS (Project Filters & Stats) */}
            {activeTab === 'tasks' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted">
                    Project Breakdown
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[6px] bg-surface-3 text-muted">
                    {tasks.length} Total
                  </span>
                </div>

                <div className="space-y-1">
                  {Object.entries(projectCounts).map(([projName, count]) => (
                    <div
                      key={projName}
                      className="flex items-center justify-between p-2 rounded-[10px] hover:bg-elevated text-xs transition-colors"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <FolderKanban className="w-3.5 h-3.5 text-accent flex-shrink-0 stroke-[1.75]" />
                        <span className="truncate text-tx-primary text-[12px]">{projName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted px-1.5 py-0.5 rounded-[6px] bg-surface-3">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-NAV 4: SCHEDULE */}
            {activeTab === 'schedule' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted">
                    Schedule Info
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[6px] bg-surface-3 text-muted">
                    {scheduleBlocks.length} Events
                  </span>
                </div>

                <div className="p-2.5 rounded-[10px] bg-surface border border-subtle space-y-1.5 text-xs">
                  <div className="text-[10px] text-muted">Selected Date:</div>
                  <div className="font-mono text-tx-primary text-xs font-semibold">
                    {selectedDate}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayStr)}
                    className="mt-1 text-[11px] text-accent hover:underline flex items-center space-x-1"
                  >
                    <Calendar className="w-3 h-3 stroke-[1.75]" />
                    <span>Jump to Today</span>
                  </button>
                </div>
              </div>
            )}

            {/* SUB-NAV 5: NOTES (Daily Notes History Tree) */}
            {activeTab === 'notes' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted">
                    Daily Notes
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[6px] bg-surface-3 text-muted">
                    {notesHistory.length} Recorded
                  </span>
                </div>

                <div className="space-y-1">
                  {notesHistory.length === 0 ? (
                    <div className="text-xs text-muted py-2 text-center">
                      No archived notes yet.
                    </div>
                  ) : (
                    notesHistory.slice(0, 10).map((dStr) => {
                      const isSelected = dStr === selectedDate;
                      return (
                        <button
                          type="button"
                          key={dStr}
                          onClick={() => setSelectedDate(dStr)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-[10px] text-xs transition-colors flex items-center justify-between ${
                            isSelected
                              ? 'bg-accent-soft text-accent font-semibold border border-accent/20'
                              : 'text-tx-primary hover:bg-elevated'
                          }`}
                        >
                          <span className="font-mono text-[11px]">{dStr}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2]" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SUB-NAV 6: HABITS */}
            {activeTab === 'habits' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted">
                    Habits & Streaks
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[6px] bg-accent-soft text-accent font-semibold">
                    {metrics?.active_streak_days ?? 7}d streak
                  </span>
                </div>

                <div className="space-y-1">
                  {habitMatrix.map((habit) => {
                    const completedCount = habit.days.filter(Boolean).length;
                    return (
                      <div
                        key={habit.id}
                        className="flex items-center justify-between p-2 rounded-[10px] hover:bg-elevated text-xs transition-colors"
                      >
                        <span className="truncate text-[12px] text-tx-primary flex-1 pr-1 font-medium">
                          {habit.habit_name}
                        </span>
                        <span className="text-[10px] font-mono text-muted px-1.5 py-0.5 rounded-[6px] bg-surface-3">
                          {completedCount}/7
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUB-NAV 7: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="space-y-3">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted block">
                  Security & Accounts
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
