import React, { useState } from 'react';
import {
  CheckSquare,
  Sparkles,
  FileText,
  Clock,
  Radio,
} from 'lucide-react';
import { ResizableWorkspace } from '../ResizableWorkspace';
import { ScheduleWidget } from '../widgets/ScheduleWidget';
import { TasksWidget } from '../widgets/TasksWidget';
import { HabitMatrixWidget } from '../widgets/HabitMatrixWidget';
import { ScratchpadWidget } from '../widgets/ScratchpadWidget';
import { Tag } from '../ui/controls';
import { useCommandCenterStore } from '../../stores/commandCenterStore';

export const TodayWorkspace: React.FC = () => {
  const { selectedDate } = useCommandCenterStore();
  const [activeRightTab, setActiveRightTab] = useState<'tasks' | 'scratchpad' | 'habits'>('tasks');

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden p-2 bg-canvas">
      <ResizableWorkspace
        id="today"
        firstSize="38%"
        secondSize="62%"
        firstMin="320px"
        secondMin="420px"
      >
        {/* Left Pane: Daily Agenda & Schedule (Science Tokyo Portal Placeholder) */}
        <section className="workspacePane w-full h-full flex flex-col overflow-hidden rounded-[var(--radius-surface)] bg-surface-2 border border-subtle shadow-panel">
          {/* Header */}
          <header className="workspaceToolPanel h-[42px] px-3 flex items-center justify-between border-b border-subtle bg-surface-3 flex-shrink-0 select-none">
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <Clock className="w-4 h-4 stroke-[1.75] text-accent flex-shrink-0" />
              <span className="text-[12px] font-semibold text-tx-primary truncate tracking-tight">
                Daily Schedule & Agenda
              </span>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <Tag tone="accent" variant="soft" className="hidden sm:inline-flex items-center gap-1">
                <Radio className="w-3 h-3 text-accent animate-pulse stroke-[2]" />
                <span>Tokyo Portal Sync</span>
              </Tag>
            </div>
          </header>

          {/* Science Tokyo Calendar Integration Banner */}
          <div className="px-3 py-2 bg-surface border-b border-subtle flex items-center justify-between text-xs flex-shrink-0">
            <div className="flex items-center space-x-2 text-[11px] text-muted">
              <span className="w-2 h-2 rounded-full bg-ok" />
              <span>Science Tokyo (Tokyo Tech) Calendar</span>
            </div>
            <span className="text-[10px] font-mono text-muted bg-surface-3 px-1.5 py-0.5 rounded-[var(--radius-chip)] border border-subtle">
              {selectedDate}
            </span>
          </div>

          {/* Main Schedule Content */}
          <div className="flex-1 min-h-0 overflow-hidden bg-surface">
            <ScheduleWidget fullScreen={false} />
          </div>
        </section>

        {/* Right Pane: Active Tasks, Daily Scratchpad & Habit Matrix */}
        <section className="workspacePane w-full h-full flex flex-col overflow-hidden rounded-[var(--radius-surface)] bg-surface-2 border border-subtle shadow-panel">
          {/* Header with Segmented Workspace Switcher */}
          <header className="workspaceToolPanel h-[42px] px-3 flex items-center justify-between border-b border-subtle bg-surface-3 flex-shrink-0 select-none">
            {/* Segmented Control */}
            <div className="flex items-center space-x-1 bg-surface p-0.5 rounded-[var(--radius-chip)] border border-subtle">
              <button
                type="button"
                onClick={() => setActiveRightTab('tasks')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-colors ${
                  activeRightTab === 'tasks'
                    ? 'bg-accent text-white shadow-subtle'
                    : 'text-muted hover:text-tx-primary hover:bg-surface-2'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Today's Tasks</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab('scratchpad')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-colors ${
                  activeRightTab === 'scratchpad'
                    ? 'bg-accent text-white shadow-subtle'
                    : 'text-muted hover:text-tx-primary hover:bg-surface-2'
                }`}
              >
                <FileText className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Daily Scratchpad</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab('habits')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-colors ${
                  activeRightTab === 'habits'
                    ? 'bg-accent text-white shadow-subtle'
                    : 'text-muted hover:text-tx-primary hover:bg-surface-2'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                <span>Habits & Streaks</span>
              </button>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-[11px] font-mono text-muted">
                {activeRightTab.toUpperCase()}
              </span>
            </div>
          </header>

          {/* Right Workspace Content Viewport */}
          <div className="flex-1 min-h-0 overflow-hidden bg-surface">
            {activeRightTab === 'tasks' && <TasksWidget />}
            {activeRightTab === 'scratchpad' && <ScratchpadWidget />}
            {activeRightTab === 'habits' && <HabitMatrixWidget />}
          </div>
        </section>
      </ResizableWorkspace>
    </div>
  );
};

export default TodayWorkspace;
