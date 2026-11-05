import React, { useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
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
    fetchLayout();
    refreshAll();

    let unlisten: (() => void) | undefined;
    api.onMetricsUpdated(() => {
      fetchMetrics();
    }).then((unsub) => {
      unlisten = unsub;
    });

    // Enforce completely static viewport - suppress any accidental wheel scrolling
    const preventWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-scrollable="true"]')) {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('wheel', preventWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', preventWheel);
      if (unlisten) unlisten();
    };
  }, [fetchLayout, refreshAll, fetchMetrics]);

  return (
    <div className="h-screen w-screen flex bg-canvas text-tx-primary selection:bg-accent/20 transition-colors duration-150 overflow-hidden font-sans">
      {/* Left Collapsible Obsidian Sidebar */}
      <Sidebar />

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 w-full min-h-0 overflow-hidden px-2.5 pb-2.5 pt-0.5">
          <BentoGrid />
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette />
    </div>
  );
};

export default App;
