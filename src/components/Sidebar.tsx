import React, { useEffect } from 'react';
import {
  Crosshair,
  LayoutGrid,
  BarChart3,
  SlidersHorizontal,
  FileText,
  Sliders,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  Check,
  RotateCcw,
  Clock,
  Sparkles,
  PieChart,
  FolderKanban,
  Bookmark,
  CheckSquare,
} from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';
import { useThemeStore } from '../stores/themeStore';
import { useCommandCenterStore } from '../stores/commandCenterStore';
import { WidgetType, WorkspaceType } from '../types';

const widgetIconMap: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
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
    layout,
    activeWorkspace,
    setWorkspace,
    isEditMode,
    toggleEditMode,
    isSidebarDrawerOpen,
    toggleSidebarDrawer,
    setSidebarDrawerOpen,
    activeDrawerTab,
    setActiveDrawerTab,
    toggleWidgetVisibility,
    resetLayout,
  } = useLayoutStore();

  const { theme, toggleTheme } = useThemeStore();
  const { notesHistory, selectedDate, setSelectedDate } = useCommandCenterStore();

  // Keyboard shortcut Ctrl+\ / Cmd+\ to toggle drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebarDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebarDrawer]);

  const workspaces: { id: WorkspaceType; name: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: 'focus',
      name: 'Focus View',
      desc: 'Top KPIs + 3-column Schedule, Scratchpad, Tasks',
      icon: Crosshair,
    },
    {
      id: 'full',
      name: 'Full Dashboard',
      desc: 'All 8 widgets across 4 balanced rows',
      icon: LayoutGrid,
    },
    {
      id: 'analytics',
      name: 'Analytics View',
      desc: 'Time tracking, habit matrix, metrics & projects',
      icon: BarChart3,
    },
  ];

  const handleTabClick = (tab: 'workspaces' | 'widgets' | 'history') => {
    if (isSidebarDrawerOpen && activeDrawerTab === tab) {
      setSidebarDrawerOpen(false);
    } else {
      setActiveDrawerTab(tab);
    }
  };

  return (
    <aside className="h-full flex flex-shrink-0 z-30 select-none border-r border-subtle transition-all duration-200">
      {/* 44px Icon Ribbon */}
      <div className="w-11 h-full bg-surface flex flex-col items-center justify-between py-2 border-r border-subtle/50">
        {/* Top: Workspaces & Drawers */}
        <div className="flex flex-col items-center space-y-1.5 w-full">
          {/* Logo Mark */}
          <div className="w-7 h-7 rounded flex items-center justify-center text-accent font-bold text-xs tracking-tighter mb-1 bg-elevated border border-subtle/80">
            CC
          </div>

          <div className="w-6 h-[1px] bg-subtle/60 my-0.5" />

          {/* Workspaces Shortcuts */}
          {workspaces.map((ws) => {
            const Icon = ws.icon;
            const isActive = activeWorkspace === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => setWorkspace(ws.id)}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors relative ${
                  isActive
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-tx-muted hover:text-tx-primary hover:bg-elevated'
                }`}
                title={`${ws.name} (Switch view)`}
              >
                <Icon className="w-4 h-4" />
                {isActive && (
                  <span className="absolute -left-1 top-2.5 w-0.5 h-3 bg-accent rounded-r" />
                )}
              </button>
            );
          })}

          <div className="w-6 h-[1px] bg-subtle/60 my-1" />

          {/* Widget Drawer Toggle */}
          <button
            onClick={() => handleTabClick('widgets')}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isSidebarDrawerOpen && activeDrawerTab === 'widgets'
                ? 'bg-elevated text-accent font-semibold border border-subtle'
                : 'text-tx-muted hover:text-tx-primary hover:bg-elevated'
            }`}
            title="Widget Library / Drawer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Daily Notes History */}
          <button
            onClick={() => handleTabClick('history')}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isSidebarDrawerOpen && activeDrawerTab === 'history'
                ? 'bg-elevated text-accent font-semibold border border-subtle'
                : 'text-tx-muted hover:text-tx-primary hover:bg-elevated'
            }`}
            title="Daily Notes History"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom: Settings, Theme, Expand */}
        <div className="flex flex-col items-center space-y-1.5 w-full">
          {/* Customization Toggle */}
          <button
            onClick={toggleEditMode}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              isEditMode
                ? 'bg-accent text-white'
                : 'text-tx-muted hover:text-tx-primary hover:bg-elevated'
            }`}
            title={isEditMode ? 'Exit Customization Mode' : 'Customize Layout (Drag & Resize)'}
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
            onClick={toggleSidebarDrawer}
            className="w-8 h-8 rounded flex items-center justify-center text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors"
            title={isSidebarDrawerOpen ? 'Collapse Drawer (Ctrl+\\)' : 'Expand Drawer (Ctrl+\\)'}
          >
            {isSidebarDrawerOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* 220px Expandable Drawer */}
      {isSidebarDrawerOpen && (
        <div className="w-56 h-full bg-surface border-r border-subtle flex flex-col min-h-0 overflow-hidden animate-slide-right">
          {/* Drawer Header with tabs */}
          <div className="flex-shrink-0 p-2.5 border-b border-subtle flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-tx-primary">
              {activeDrawerTab === 'workspaces' && 'Workspaces'}
              {activeDrawerTab === 'widgets' && 'Widget Library'}
              {activeDrawerTab === 'history' && 'Notes History'}
            </span>
            <span className="text-[10px] text-tx-muted font-mono">
              Ctrl+\
            </span>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 min-h-0 overflow-hidden p-2 space-y-2">
            {/* Tab 1: Workspaces */}
            {activeDrawerTab === 'workspaces' && (
              <div className="space-y-1.5">
                {workspaces.map((ws) => {
                  const Icon = ws.icon;
                  const isActive = activeWorkspace === ws.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => setWorkspace(ws.id)}
                      className={`w-full text-left p-2 rounded transition-colors border ${
                        isActive
                          ? 'bg-elevated border-accent/40 text-tx-primary'
                          : 'border-transparent hover:bg-elevated/60 text-tx-muted hover:text-tx-primary'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : ''}`} />
                        <span className="text-xs font-semibold">{ws.name}</span>
                        {isActive && <Check className="w-3 h-3 text-accent ml-auto" />}
                      </div>
                      <p className="text-[10px] text-tx-muted mt-0.5 leading-snug">
                        {ws.desc}
                      </p>
                    </button>
                  );
                })}

                <div className="pt-2 border-t border-subtle/50">
                  <button
                    onClick={() => resetLayout()}
                    className="w-full flex items-center space-x-1.5 px-2 py-1.5 text-xs text-tx-muted hover:text-tx-primary rounded hover:bg-elevated"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Layout to Default</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Widget Library (Toggle show/hide on canvas) */}
            {activeDrawerTab === 'widgets' && (
              <div className="space-y-1">
                <div className="text-[10px] text-tx-muted px-1 pb-1">
                  Toggle widgets to declutter the canvas:
                </div>
                {layout?.widgets.map((widget) => {
                  const Icon = widgetIconMap[widget.type] || LayoutGrid;
                  const isVisible = widget.visible !== false;
                  return (
                    <div
                      key={widget.id}
                      className="flex items-center justify-between p-1.5 rounded hover:bg-elevated/70 transition-colors border border-transparent hover:border-subtle/40"
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-1">
                        <Icon className="w-3.5 h-3.5 text-tx-muted flex-shrink-0" />
                        <span className={`text-[11px] truncate ${isVisible ? 'text-tx-primary font-medium' : 'text-tx-muted line-through'}`}>
                          {widget.title}
                        </span>
                      </div>

                      <button
                        onClick={() => toggleWidgetVisibility(widget.id)}
                        className={`p-1 rounded transition-colors ${
                          isVisible
                            ? 'text-accent hover:bg-accent/10'
                            : 'text-tx-muted hover:text-tx-primary hover:bg-canvas'
                        }`}
                        title={isVisible ? 'Hide from canvas' : 'Show on canvas'}
                      >
                        {isVisible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 3: Daily Notes History */}
            {activeDrawerTab === 'history' && (
              <div className="space-y-1">
                <div className="text-[10px] text-tx-muted px-1 pb-1">
                  Click a date to load its scratchpad:
                </div>
                {notesHistory.length === 0 ? (
                  <div className="text-xs text-tx-muted py-4 text-center">
                    No notes recorded yet.
                  </div>
                ) : (
                  notesHistory.map((dateStr) => {
                    const isSelected = dateStr === selectedDate;
                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-accent text-white font-medium'
                            : 'text-tx-primary hover:bg-elevated'
                        }`}
                      >
                        <span className="font-mono text-[11px]">{dateStr}</span>
                        {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
