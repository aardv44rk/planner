import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Tag,
} from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';
import { TaskPriority } from '../../types';

export const TasksWidget: React.FC = () => {
  const { tasks, toggleTask, deleteTask, createTask, selectedDate } = useCommandCenterStore();
  const [newTitle, setNewTitle] = useState('');
  const [selectedProject, setSelectedProject] = useState('LifeOS');
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('medium');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'active') return t.completed === 0;
    if (filter === 'done') return t.completed === 1;
    return true;
  });

  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed === 1).length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

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
  };

  const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'medium':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'low':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface rounded border border-subtle p-2.5 select-none min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-1.5 border-b border-subtle">
        <div className="flex items-center space-x-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-primary">
            Today's Tasks
          </h2>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-elevated text-tx-muted font-mono">
            {completed}/{total}
          </span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center space-x-1 text-[10px]">
          {(['all', 'active', 'done'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-1.5 py-0.2 rounded capitalize transition-colors ${
                filter === tab
                  ? 'bg-elevated font-medium text-tx-primary border border-subtle'
                  : 'text-tx-muted hover:text-tx-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex-shrink-0 w-full bg-canvas h-1 rounded-full overflow-hidden my-1.5 border border-subtle/50">
        <div
          className="bg-accent h-full transition-all duration-300 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Quick Add Inline Form */}
      <form onSubmit={handleCreate} className="flex-shrink-0 mb-1.5">
        <div className="flex items-center space-x-1 p-0.5 rounded bg-canvas border border-subtle focus-within:border-accent transition-colors">
          <input
            type="text"
            placeholder="Add task and press Enter..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 px-1.5 py-0.5 bg-transparent text-[11px] text-tx-primary placeholder:text-tx-muted/60 focus:outline-none"
          />

          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-1 py-0.5 text-[9px] rounded bg-surface border border-subtle text-tx-muted focus:outline-none"
          >
            <option value="LifeOS">LifeOS</option>
            <option value="Work">Work</option>
            <option value="Learning">Learning</option>
            <option value="Personal">Personal</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as TaskPriority)}
            className="px-1 py-0.5 text-[9px] rounded bg-surface border border-subtle text-tx-muted focus:outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Med</option>
            <option value="high">High</option>
          </select>

          <button
            type="submit"
            className="p-1 rounded bg-accent text-white hover:opacity-90 transition-opacity"
            title="Create Task"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </form>

      {/* Task List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
        {filteredTasks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-tx-muted text-xs">
            No tasks match the filter.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.completed === 1;
            return (
              <div
                key={task.id}
                className={`group flex items-center justify-between p-1.5 rounded bg-canvas border border-subtle transition-all ${
                  isDone ? 'opacity-60 bg-canvas/40' : 'hover:border-tx-muted/30'
                }`}
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="text-tx-muted hover:text-accent transition-colors flex-shrink-0"
                  >
                    {isDone ? (
                      <CheckSquare className="w-3.5 h-3.5 text-accent" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <span
                    className={`text-[11px] truncate text-tx-primary ${
                      isDone ? 'line-through text-tx-muted' : ''
                    }`}
                  >
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 flex-shrink-0 ml-1.5">
                  <span className="flex items-center space-x-0.5 text-[9px] px-1 py-0 rounded bg-elevated text-tx-muted font-mono">
                    <Tag className="w-2 h-2" />
                    <span>{task.project}</span>
                  </span>

                  <span
                    className={`text-[8px] uppercase font-bold px-1 py-0 rounded border ${getPriorityColor(
                      task.priority
                    )}`}
                  >
                    {task.priority}
                  </span>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded transition-opacity"
                    title="Delete task"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
