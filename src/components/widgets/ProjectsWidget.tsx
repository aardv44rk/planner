import React from 'react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';

export const ProjectsWidget: React.FC = () => {
  const { tasks } = useCommandCenterStore();

  const projectStats = tasks.reduce<
    Record<string, { total: number; completed: number }>
  >((acc, task) => {
    const proj = task.project || 'General';
    if (!acc[proj]) {
      acc[proj] = { total: 0, completed: 0 };
    }
    acc[proj].total += 1;
    if (task.completed === 1) {
      acc[proj].completed += 1;
    }
    return acc;
  }, {});

  const projects = Object.entries(projectStats).map(([name, stat]) => ({
    name,
    total: stat.total,
    completed: stat.completed,
    percentage: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
  }));

  return (
    <div className="flex flex-col h-full w-full p-2.5 select-none min-h-0 overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between pb-1 border-b border-subtle/40 text-[10px] text-tx-muted font-mono">
        <span>Project Overview</span>
        <span>{projects.length} Active</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-subtle/30 mt-1 pr-1">
        {projects.length === 0 ? (
          <div className="h-full flex items-center justify-center text-tx-muted text-xs">
            No active projects found.
          </div>
        ) : (
          projects.map((proj) => (
            <div
              key={proj.name}
              className="py-1.5 px-1 hover:bg-elevated/40 rounded transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-tx-primary">
                  {proj.name}
                </span>
                <span className="text-[9px] font-mono text-tx-muted">
                  {proj.completed}/{proj.total} ({proj.percentage}%)
                </span>
              </div>

              <div className="w-full bg-canvas h-[2px] rounded-full overflow-hidden">
                <div
                  className="bg-accent h-full transition-all duration-300 rounded-full"
                  style={{ width: `${proj.percentage}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
