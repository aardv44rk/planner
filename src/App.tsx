import React, { useEffect, useState, useMemo, type ReactNode } from 'react';
import {
  createHashRouter,
  RouterProvider,
  Navigate,
  useParams,
  useNavigate,
} from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './platform/query-client';
import { PageErrorBoundary } from './app/PageErrorBoundary';
import { KeptPage } from './app/KeptPage';
import { ToastProvider } from './components/ui/Toast';
import { installInteractionTrace } from './app/interaction-trace';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { TodayWorkspace } from './components/workspaces/TodayWorkspace';
import { CoursesWorkspace } from './components/workspaces/CoursesWorkspace';
import { TasksView } from './components/views/TasksView';
import { ScheduleView } from './components/views/ScheduleView';
import { NotesView } from './components/views/NotesView';
import { HabitsView } from './components/views/HabitsView';
import { SettingsView } from './components/views/SettingsView';
import { CommandPalette } from './components/CommandPalette';
import { useLayoutStore } from './stores/layoutStore';
import { useCommandCenterStore } from './stores/commandCenterStore';
import { api } from './utils/ipc';
import { AppTab } from './types';

const VALID_TABS: readonly AppTab[] = [
  'today',
  'courses',
  'tasks',
  'schedule',
  'notes',
  'habits',
  'settings',
] as const;

const AppShell: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { activeTab, setActiveTab, fetchLayout } = useLayoutStore();
  const { refreshAll, fetchMetrics } = useCommandCenterStore();

  // Retain set of visited workspaces to prevent unmounting inactive views
  const [visitedTabs, setVisitedTabs] = useState<Set<AppTab>>(() => {
    const initial = tab && VALID_TABS.includes(tab as AppTab) ? (tab as AppTab) : activeTab;
    return new Set(['today', initial]);
  });

  // Sync route URL parameter with activeTab in layoutStore
  useEffect(() => {
    if (tab && VALID_TABS.includes(tab as AppTab)) {
      const targetTab = tab as AppTab;
      if (activeTab !== targetTab) {
        setActiveTab(targetTab);
      }
      setVisitedTabs((prev) => new Set(prev).add(targetTab));
    } else if (!tab) {
      navigate('/today', { replace: true });
    }
  }, [tab, activeTab, setActiveTab, navigate]);

  // Sync route whenever activeTab changes from UI actions (sidebar clicks, shortcuts)
  useEffect(() => {
    if (tab !== activeTab) {
      navigate(`/${activeTab}`, { replace: true });
    }
    setVisitedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab, tab, navigate]);

  // Startup lifecycle, metrics events, and LMS auto-sync
  useEffect(() => {
    installInteractionTrace();
    fetchLayout();
    refreshAll();

    // Check if user enabled auto-sync LMS on startup
    if (typeof window !== 'undefined' && localStorage.getItem('lifeos-auto-sync') === 'true') {
      api.syncLms()
        .then(() => refreshAll())
        .catch((err) => console.warn('LMS Auto-sync on startup encountered an issue:', err));
    }

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

  // Keep helper: mounts visited views into retained KeptPage layers with error boundaries
  const keep = (tabId: AppTab, component: ReactNode) => {
    if (!visitedTabs.has(tabId)) return null;
    return (
      <KeptPage visible={activeTab === tabId} key={tabId} name={tabId}>
        <PageErrorBoundary name={tabId}>{component}</PageErrorBoundary>
      </KeptPage>
    );
  };

  return (
    <div className="h-screen w-screen flex bg-canvas text-tx-primary selection:bg-accent/20 transition-colors duration-150 overflow-hidden font-sans">
      {/* 72px Reference Navigation Rail + Collapsible Sub-nav Drawer */}
      <Sidebar />

      {/* Main Domain Application Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <TopNav />
        <main
          className={`flex-1 w-full min-h-0 ${
            activeTab === 'today' || activeTab === 'courses'
              ? 'overflow-hidden flex flex-col'
              : 'overflow-y-auto custom-scrollbar px-3.5 pb-4 pt-2'
          }`}
        >
          {keep('today', <TodayWorkspace />)}
          {keep('courses', <CoursesWorkspace />)}
          {keep('tasks', <TasksView />)}
          {keep('schedule', <ScheduleView />)}
          {keep('notes', <NotesView />)}
          {keep('habits', <HabitsView />)}
          {keep('settings', <SettingsView />)}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette />
    </div>
  );
};

export const App: React.FC = () => {
  const router = useMemo(
    () =>
      createHashRouter([
        {
          path: '/',
          element: <AppShell />,
          children: [
            { index: true, element: <Navigate to="/today" replace /> },
            { path: ':tab', element: null },
          ],
        },
      ]),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <PageErrorBoundary name="AppShell">
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </PageErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;
