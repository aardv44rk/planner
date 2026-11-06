import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  FolderKanban,
  Filter,
  ArrowUpDown,
  Calendar,
} from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';
import { TaskPriority } from '../../types';

export const TasksView: React.FC = () => {
  const {
    tasks,
    toggleTask,
    deleteTask,
    createTask,
    selectedDate,
  } = useCommandCenterStore();

  const [newTitle, setNewTitle] = useState('');
  const [selectedProject, setSelectedProject] = useState('LifeOS');
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('medium');
  const [activeProjectFilter, setActiveProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'done'>('active');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'created' | 'priority' | 'project'>('due_date');
  const [isAdding, setIsAdding] = useState(false);

  // Compute Project statistics
  const projectStats = tasks.reduce<Record<string, { total: number; completed: number }>>(
    (acc, task) => {
      const proj = task.project || 'General';
      if (!acc[proj]) {
        acc[proj] = { total: 0, completed: 0 };
      }
      acc[proj].total += 1;
      if (task.completed === 1) {
        acc[proj].completed += 1;
      }
      return acc;
    },
    {}
  );

  const projectList = Object.entries(projectStats).map(([name, stat]) => ({
    name,
    total: stat.total,
    completed: stat.completed,
    percentage: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
  }));

  const allProjects = Array.from(new Set(['LifeOS', 'Work', 'Learning', 'Personal', ...Object.keys(projectStats)]));

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (activeProjectFilter !== 'all' && t.project !== activeProjectFilter) return false;
    if (statusFilter === 'active' && t.completed === 1) return false;
    if (statusFilter === 'done' && t.completed === 0) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'due_date') {
      if (!a.due_date && !b.due_date) return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    }
    if (sortBy === 'priority') {
      const weight: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
      return (weight[b.priority] || 0) - (weight[a.priority] || 0);
    }
    if (sortBy === 'project') {
      return (a.project || '').localeCompare(b.project || '');
    }
    return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed === 1).length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await createTask({
      title: newTitle.trim(),
      project: selectedProject,
      priority: selectedPriority,
      due_date: selectedDate,
    });
    setNewTitle('');
    setIsAdding(false);
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return (
          <span className="flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>High</span>
          </span>
        );
      case 'medium':
        return (
          <span className="flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Med</span>
          </span>
        );
      case 'low':
        return (
          <span className="flex items-center space-x-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Low</span>
          </span>
        );
    }
  };

  return (
    <div className="workspacePane h-full w-full flex flex-col p-4 bg-surface rounded-[var(--radius-surface)] border border-subtle shadow-panel select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-subtle/50">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-semibold tracking-tight text-tx-primary">
                Tasks & Projects
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-elevated border border-subtle text-tx-muted font-mono">
                {completedTasks}/{totalTasks} Completed ({progressPct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Add Task button */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-accent text-white text-xs font-medium hover:opacity-90 shadow-xs transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex-shrink-0 w-full bg-canvas h-1.5 rounded-full overflow-hidden my-3 border border-subtle/40">
        <div
          className="bg-accent h-full transition-all duration-300 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Main Body: 2-column or split area */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4 overflow-hidden">
        {/* Left Column: Projects Overview & Filter Cards (col-span-4) */}
        <div className="col-span-4 flex flex-col min-h-0 bg-canvas/60 rounded border border-subtle p-3 overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between pb-2 border-b border-subtle/50">
            <div className="flex items-center space-x-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-accent" />
              <h3 className="text-xs font-semibold text-tx-primary">Active Projects</h3>
            </div>
            <span className="text-[10px] text-tx-muted font-mono">
              {projectList.length} Active
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-2 space-y-1.5 pr-1">
            {/* "All Projects" row */}
            <button
              onClick={() => setActiveProjectFilter('all')}
              className={`w-full text-left p-2 rounded transition-colors border ${
                activeProjectFilter === 'all'
                  ? 'bg-elevated border-accent/40 text-tx-primary font-medium shadow-xs'
                  : 'bg-surface/50 border-subtle/50 text-tx-muted hover:text-tx-primary hover:bg-elevated'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span>All Projects</span>
                <span className="text-[10px] font-mono">{tasks.length} tasks</span>
              </div>
            </button>

            {projectList.map((proj) => {
              const isSelected = activeProjectFilter === proj.name;
              return (
                <button
                  key={proj.name}
                  onClick={() => setActiveProjectFilter(proj.name)}
                  className={`w-full text-left p-2 rounded transition-colors border ${
                    isSelected
                      ? 'bg-elevated border-accent/40 text-tx-primary font-medium shadow-xs'
                      : 'bg-surface/50 border-subtle/50 text-tx-muted hover:text-tx-primary hover:bg-elevated'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="truncate">{proj.name}</span>
                    <span className="text-[10px] font-mono text-tx-muted">
                      {proj.completed}/{proj.total} ({proj.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-canvas h-1 rounded-full overflow-hidden">
                    <div
                      className="bg-accent h-full rounded-full transition-all duration-300"
                      style={{ width: `${proj.percentage}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Tasks List & Controls (col-span-8) */}
        <div className="col-span-8 flex flex-col min-h-0 bg-canvas/30 rounded border border-subtle p-3 overflow-hidden">
          {/* Controls Bar: Search / Filters / Sorters */}
          <div className="flex-shrink-0 flex items-center justify-between pb-2 border-b border-subtle/50 flex-wrap gap-2">
            {/* Status Filter */}
            <div className="flex items-center bg-surface border border-subtle/80 rounded p-0.5 space-x-0.5 text-xs">
              {(['all', 'active', 'done'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2 py-0.5 rounded capitalize transition-colors ${
                    statusFilter === tab
                      ? 'bg-accent text-white font-medium shadow-xs'
                      : 'text-tx-muted hover:text-tx-primary'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Filter by Priority */}
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center space-x-1 text-tx-muted">
                <Filter className="w-3 h-3" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-surface border border-subtle rounded px-2 py-0.5 text-xs text-tx-primary focus:outline-none"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center space-x-1 text-tx-muted">
                <ArrowUpDown className="w-3 h-3" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-surface border border-subtle rounded px-2 py-0.5 text-xs text-tx-primary focus:outline-none"
                >
                  <option value="due_date">Sort by Due Date</option>
                  <option value="created">Sort by Created Date</option>
                  <option value="priority">Sort by Priority</option>
                  <option value="project">Sort by Project</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Task Creation Panel */}
          {isAdding && (
            <form
              onSubmit={handleCreate}
              className="flex-shrink-0 my-2 p-2.5 rounded bg-surface border border-subtle space-y-2 animate-scale-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-tx-primary">Add New Task</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-tx-muted hover:text-tx-primary text-xs"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                placeholder="What needs to be done?..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-canvas border border-subtle text-xs text-tx-primary placeholder:text-tx-muted/60 focus:outline-none focus:border-accent"
                autoFocus
              />
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs">
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="px-2 py-1 rounded bg-canvas border border-subtle text-tx-primary text-xs focus:outline-none"
                  >
                    {allProjects.map((proj) => (
                      <option key={proj} value={proj}>
                        {proj}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value as TaskPriority)}
                    className="px-2 py-1 rounded bg-canvas border border-subtle text-tx-primary text-xs focus:outline-none"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-2.5 py-1 text-xs rounded text-tx-muted hover:bg-elevated"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs rounded bg-accent text-white font-medium hover:opacity-90 shadow-xs"
                  >
                    Create Task
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Tasks List */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2 divide-y divide-subtle/30 pr-1">
            {sortedTasks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-tx-muted text-xs p-8">
                <CheckSquare className="w-8 h-8 mb-2 opacity-30" />
                <span>No tasks matching the selected filters.</span>
              </div>
            ) : (
              sortedTasks.map((task) => {
                const isDone = task.completed === 1;
                return (
                  <div
                    key={task.id}
                    className="group/item flex items-center justify-between py-2.5 px-2 hover:bg-surface rounded transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0 pr-3">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className="text-tx-muted hover:text-accent transition-colors flex-shrink-0"
                      >
                        {isDone ? (
                          <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-xs text-tx-primary font-medium truncate ${
                            isDone ? 'line-through text-tx-muted/60' : ''
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.due_date && (
                          <span className="flex items-center space-x-1 text-[10px] text-tx-muted font-mono mt-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            <span>{task.due_date}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5 flex-shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-elevated text-tx-muted font-mono border border-subtle/50">
                        {task.project}
                      </span>

                      {getPriorityBadge(task.priority)}

                      <button
                        onClick={() => deleteTask(task.id)}
                        className="opacity-0 group-hover/item:opacity-100 p-1 text-tx-muted hover:text-red-500 rounded transition-opacity"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
