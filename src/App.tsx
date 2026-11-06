import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { BentoGrid } from './components/BentoGrid';
import { TasksView } from './components/views/TasksView';
import { ScheduleView } from './components/views/ScheduleView';
import { NotesView } from './components/views/NotesView';
import { HabitsView } from './components/views/HabitsView';
import { CommandPalette } from './components/CommandPalette';
import { useLayoutStore } from './stores/layoutStore';
import { useCommandCenterStore } from './stores/commandCenterStore';
import { api } from './utils/ipc';

export const App: React.FC = () => {
  const { activeTab, fetchLayout } = useLayoutStore();
  const { refreshAll, fetchMetrics } = useCommandCenterStore();

  useEffect(() => {
    fetchLayout();
    refreshAll();

    let unlisten: (() => void) | undefined;
    api.onMetricsUpdated(() => {
      fetchMetrics();
    }).then((unsub) => {
      unlisten = unsub;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [fetchLayout, refreshAll, fetchMetrics]);

  return (
    <div className="h-screen w-screen flex bg-canvas text-tx-primary selection:bg-accent/20 transition-colors duration-150 overflow-hidden font-sans">
      {/* Obsidian-Style Navigation Rail + Collapsible Sub-nav Drawer */}
      <Sidebar />

      {/* Main Domain Application Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 w-full min-h-0 overflow-y-auto custom-scrollbar px-3.5 pb-4 pt-2">
          {activeTab === 'home' && <BentoGrid />}
          {activeTab === 'tasks' && <TasksView />}
          {activeTab === 'schedule' && <ScheduleView />}
          {activeTab === 'notes' && <NotesView />}
          {activeTab === 'habits' && <HabitsView />}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette />
    </div>
  );
};

export default App;
