import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';
import { TaskPriority } from '../../types';

export const TasksWidget: React.FC = () => {
  const { tasks, toggleTask, deleteTask, createTask, selectedDate } = useCommandCenterStore();
  const [newTitle, setNewTitle] = useState('');
  const [selectedProject, setSelectedProject] = useState('LifeOS');
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('medium');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [isAdding, setIsAdding] = useState(false);

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
    setIsAdding(false);
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="High Priority" />;
      case 'medium':
        return <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Medium Priority" />;
      case 'low':
        return <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Low Priority" />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full p-2.5 select-none min-h-0 overflow-hidden">
      {/* Sub Toolbar: Status & Filters */}
      <div className="flex-shrink-0 flex items-center justify-between pb-1 border-b border-subtle/40">
        <span className="text-[10px] text-tx-muted font-mono">
          {completed}/{total} ({progressPct}%)
        </span>

        <div className="flex items-center space-x-1">
          {/* Filter tabs */}
          <div className="flex items-center space-x-0.5 text-[9px] mr-1 bg-canvas/60 rounded p-0.5 border border-subtle/40">
            {(['all', 'active', 'done'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-1.5 py-0.2 rounded capitalize transition-colors ${
                  filter === tab
                    ? 'bg-elevated font-semibold text-tx-primary'
                    : 'text-tx-muted hover:text-tx-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="p-0.5 rounded text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors"
            title="New Task"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Thin Progress line */}
      <div className="flex-shrink-0 w-full bg-canvas h-[2px] rounded-full overflow-hidden my-1.5">
        <div
          className="bg-accent h-full transition-all duration-300 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Inline Quick Add Form */}
      {isAdding && (
        <form onSubmit={handleCreate} className="flex-shrink-0 mb-1.5 p-1 rounded bg-canvas border border-subtle">
          <div className="flex items-center space-x-1">
            <input
              type="text"
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 px-1.5 py-0.5 bg-transparent text-[11px] text-tx-primary placeholder:text-tx-muted/60 focus:outline-none"
              autoFocus
            />

            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-1 py-0.2 text-[9px] rounded bg-surface border border-subtle text-tx-muted focus:outline-none"
            >
              <option value="LifeOS">LifeOS</option>
              <option value="Work">Work</option>
              <option value="Learning">Learning</option>
              <option value="Personal">Personal</option>
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as TaskPriority)}
              className="px-1 py-0.2 text-[9px] rounded bg-surface border border-subtle text-tx-muted focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Med</option>
              <option value="high">High</option>
            </select>

            <button
              type="submit"
              className="px-1.5 py-0.5 rounded bg-accent text-white text-[10px] font-medium hover:opacity-90"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {/* Tasks List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-subtle/30 pr-1">
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
                className="group/item flex items-center justify-between py-1.5 px-1 hover:bg-elevated/40 rounded transition-colors"
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
                      isDone ? 'line-through text-tx-muted/60' : ''
                    }`}
                  >
                    {task.title}
                  </span>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0 ml-1.5">
                  <span className="text-[9px] px-1 py-0 rounded bg-elevated/80 text-tx-muted font-mono">
                    {task.project}
                  </span>

                  {getPriorityBadge(task.priority)}

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded transition-opacity"
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
