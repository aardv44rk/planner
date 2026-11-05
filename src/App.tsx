import React, { useEffect } from 'react';
import { TopNav } from './components/TopNav';
import { BentoGrid } from './components/BentoGrid';
import { CommandPalette } from './components/CommandPalette';
import { useLayoutStore } from './stores/layoutStore';
import { useCommandCenterStore } from './stores/commandCenterStore';
import { api } from './utils/ipc';

export const App: React.FC = () => {
  const { fetchLayout } = useLayoutStore();
  const { refreshAll, fetchMetrics } = useCommandCenterStore();

  useEffect(() => {
    // Initial fetch of layout and all core SQLite data
    fetchLayout();
    refreshAll();

    // Listen for realtime metrics-updated event emitted by the Rust WindowTrackerPlugin
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
    <div className="h-screen w-screen flex flex-col bg-canvas text-tx-primary selection:bg-accent/20 transition-colors duration-150 overflow-hidden">
      <TopNav />
      <main className="flex-1 w-full min-h-0 overflow-hidden p-2.5">
        <BentoGrid />
      </main>
      <CommandPalette />
    </div>
  );
};

export default App;
