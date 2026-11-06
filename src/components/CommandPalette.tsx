import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  PlusCircle,
  Calendar,
  Sun,
  Moon,
  RotateCcw,
  Sliders,
  CheckSquare,
  Clock,
  ArrowRight,
  LayoutGrid,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useCommandCenterStore } from '../stores/commandCenterStore';
import { useThemeStore } from '../stores/themeStore';
import { useLayoutStore } from '../stores/layoutStore';

interface CommandItem {
  id: string;
  title: string;
  category: 'Actions' | 'Navigation' | 'System';
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void | Promise<void>;
}

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    createTask,
    createScheduleBlock,
    setSelectedDate,
  } = useCommandCenterStore();

  const { theme, toggleTheme } = useThemeStore();
  const { toggleEditMode, resetLayout, setActiveTab } = useLayoutStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [subMode, setSubMode] = useState<'none' | 'create_task' | 'create_block' | 'jump_date'>('none');
  const [inputValue, setInputValue] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        e.preventDefault();
        if (subMode !== 'none') {
          setSubMode('none');
          setInputValue('');
        } else {
          setCommandPaletteOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, subMode, setCommandPaletteOpen]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSubMode('none');
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    if (subMode !== 'none') {
      setTimeout(() => subInputRef.current?.focus(), 50);
    }
  }, [subMode]);

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const commands: CommandItem[] = [
    {
      id: 'nav-home',
      title: 'Go to Home Dashboard',
      category: 'Navigation',
      icon: LayoutGrid,
      shortcut: '1',
      action: () => {
        setActiveTab('home');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-tasks',
      title: 'Go to Tasks & Projects',
      category: 'Navigation',
      icon: CheckSquare,
      shortcut: '2',
      action: () => {
        setActiveTab('tasks');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-schedule',
      title: 'Go to Calendar & Schedule',
      category: 'Navigation',
      icon: Clock,
      shortcut: '3',
      action: () => {
        setActiveTab('schedule');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-notes',
      title: 'Go to Notes & Vault',
      category: 'Navigation',
      icon: FileText,
      shortcut: '4',
      action: () => {
        setActiveTab('notes');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-habits',
      title: 'Go to Habits & Metrics',
      category: 'Navigation',
      icon: Sparkles,
      shortcut: '5',
      action: () => {
        setActiveTab('habits');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'create-task',
      title: 'Create new task...',
      category: 'Actions',
      icon: PlusCircle,
      shortcut: 'T',
      action: () => {
        setSubMode('create_task');
        setInputValue('');
      },
    },
    {
      id: 'log-schedule',
      title: 'Log schedule block...',
      category: 'Actions',
      icon: Clock,
      shortcut: 'S',
      action: () => {
        setSubMode('create_block');
        setInputValue('');
      },
    },
    {
      id: 'jump-today',
      title: 'Jump to today',
      category: 'Navigation',
      icon: Calendar,
      action: () => {
        setSelectedDate(todayStr);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'jump-tomorrow',
      title: 'Jump to tomorrow',
      category: 'Navigation',
      icon: Calendar,
      action: () => {
        setSelectedDate(tomorrowStr);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'jump-yesterday',
      title: 'Jump to yesterday',
      category: 'Navigation',
      icon: Calendar,
      action: () => {
        setSelectedDate(yesterdayStr);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'toggle-theme',
      title: `Toggle theme (${theme === 'light' ? 'Dark' : 'Light'})`,
      category: 'System',
      icon: theme === 'light' ? Moon : Sun,
      shortcut: 'M',
      action: () => {
        toggleTheme();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'customize-layout',
      title: 'Toggle layout customize edit-mode',
      category: 'System',
      icon: Sliders,
      action: () => {
        toggleEditMode();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'reset-layout',
      title: 'Reset layout to default',
      category: 'System',
      icon: RotateCcw,
      action: async () => {
        await resetLayout();
        setCommandPaletteOpen(false);
      },
    },
  ];

  const filteredCommands = commands.filter((cmd) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  const handleKeyDownNav = (e: React.KeyboardEvent) => {
    if (subMode !== 'none') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        selected.action();
      }
    }
  };

  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (subMode === 'create_task') {
      await createTask({
        title: inputValue.trim(),
        project: 'General',
        priority: 'medium',
      });
      setCommandPaletteOpen(false);
    } else if (subMode === 'create_block') {
      await createScheduleBlock({
        title: inputValue.trim(),
        start_time: '10:00',
        end_time: '11:00',
        category: 'Deep Work',
        date: todayStr,
      });
      setCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/40 backdrop-blur-sm transition-opacity"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-surface border border-subtle rounded-lg shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Search View */}
        {subMode === 'none' ? (
          <div>
            <div className="flex items-center px-3.5 py-3 border-b border-subtle">
              <Search className="w-4 h-4 text-tx-muted mr-2.5 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDownNav}
                placeholder="Type a command or search..."
                className="w-full bg-transparent text-sm text-tx-primary placeholder:text-tx-muted/60 focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-elevated border border-subtle text-tx-muted ml-2">
                Esc
              </kbd>
            </div>

            {/* Commands List */}
            <div data-scrollable="true" className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-xs text-tx-muted">
                  No commands match "{query}"
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors text-left ${
                        isSelected
                          ? 'bg-elevated text-tx-primary font-medium'
                          : 'text-tx-primary hover:bg-elevated/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className="w-4 h-4 text-tx-muted" />
                        <span>{cmd.title}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-tx-muted font-mono uppercase">
                          {cmd.category}
                        </span>
                        {cmd.shortcut && (
                          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-canvas border border-subtle text-tx-muted">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer shortcuts badge */}
            <div className="px-3.5 py-2 border-t border-subtle bg-canvas/60 flex items-center justify-between text-[11px] text-tx-muted">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <kbd className="px-1 rounded bg-elevated border border-subtle text-[10px] font-mono">↑↓</kbd>
                  <span>Navigate</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1 rounded bg-elevated border border-subtle text-[10px] font-mono">↵</kbd>
                  <span>Select</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1 rounded bg-elevated border border-subtle text-[10px] font-mono">Esc</kbd>
                  <span>Close</span>
                </span>
              </div>
              <span className="text-[10px] text-tx-muted">LifeOS Command Center</span>
            </div>
          </div>
        ) : (
          /* Sub-mode form (e.g. inline Task or Schedule Creation) */
          <form onSubmit={handleSubSubmit} className="p-4 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-tx-primary">
              {subMode === 'create_task' ? (
                <>
                  <CheckSquare className="w-4 h-4 text-accent" />
                  <span>Create New Task</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-accent" />
                  <span>Log Schedule Block</span>
                </>
              )}
            </div>

            <input
              ref={subInputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                subMode === 'create_task'
                  ? 'Task title (e.g. Prepare system demo)...'
                  : 'Block title (e.g. Focus Sprint)...'
              }
              className="w-full px-3 py-2 rounded bg-canvas border border-subtle text-sm text-tx-primary focus:outline-none focus:border-accent"
              autoFocus
            />

            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={() => setSubMode('none')}
                className="px-2.5 py-1 rounded text-tx-muted hover:bg-elevated"
              >
                ← Back
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-3 py-1 rounded bg-accent text-white font-medium hover:opacity-90"
              >
                <span>Save</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
