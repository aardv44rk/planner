import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '../../src/stores/layoutStore';
import { AppTab } from '../../src/types';

describe('Layout store & Navigation stability', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      activeTab: 'today',
      isSidebarExpanded: false,
    });
  });

  it('updates activeTab synchronously without intermediate oscillation', () => {
    const tabs: AppTab[] = ['courses', 'tasks', 'schedule', 'notes', 'habits', 'settings', 'today'];

    for (const targetTab of tabs) {
      useLayoutStore.getState().setActiveTab(targetTab);
      expect(useLayoutStore.getState().activeTab).toBe(targetTab);
    }
  });

  it('preserves single-direction state mutation on rapid navigation switches', () => {
    const store = useLayoutStore.getState();

    store.setActiveTab('courses');
    expect(useLayoutStore.getState().activeTab).toBe('courses');

    store.setActiveTab('tasks');
    expect(useLayoutStore.getState().activeTab).toBe('tasks');

    store.setActiveTab('settings');
    expect(useLayoutStore.getState().activeTab).toBe('settings');
  });
});
