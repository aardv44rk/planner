import React, { useState } from 'react';
import {
  CheckSquare,
  Sparkles,
  FileText,
  Clock,
} from 'lucide-react';
import { ResizableWorkspace } from '../ResizableWorkspace';
import { ScheduleWidget } from '../widgets/ScheduleWidget';
import { TasksWidget } from '../widgets/TasksWidget';
import { HabitMatrixWidget } from '../widgets/HabitMatrixWidget';
import { ScratchpadWidget } from '../widgets/ScratchpadWidget';
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
        {/* Left Pane: Daily Schedule */}
        <section className="workspacePane w-full h-full flex flex-col overflow-hidden rounded-[var(--radius-surface)] bg-surface-2 border border-subtle shadow-panel">
          {/* Header */}
          <header className="workspaceToolPanel h-[42px] px-3 flex items-center justify-between border-b border-subtle bg-surface-3 flex-shrink-0 select-none">
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <Clock className="w-4 h-4 stroke-[1.75] text-accent flex-shrink-0" />
              <span className="text-[12px] font-semibold text-tx-primary truncate tracking-tight">
                Schedule
              </span>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <span className="text-[10px] font-mono text-muted bg-surface px-1.5 py-0.5 rounded-[var(--radius-chip)] border border-subtle">
                {selectedDate}
              </span>
            </div>
          </header>

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
                <span>Tasks</span>
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
                <span>Scratchpad</span>
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
                <span>Habits</span>
              </button>
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
