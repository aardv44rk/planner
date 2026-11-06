import React from 'react';
import { PieChart } from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';

export const TimeAllocationWidget: React.FC = () => {
  const { timeAllocation } = useCommandCenterStore();

  const colors = ['#A85A32', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899'];

  return (
    <div className="flex flex-col h-full w-full bg-surface rounded border border-subtle p-2.5 select-none min-h-0 overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between pb-1 border-b border-subtle/50">
        <div className="flex items-center space-x-1.5">
          <PieChart className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-tx-muted">
            Time Allocation
          </h2>
        </div>
        <span className="text-[9px] text-tx-muted font-mono">Today</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-subtle/30 mt-1 pr-1">
        {timeAllocation.length === 0 ? (
          <div className="h-full flex items-center justify-center text-tx-muted text-xs">
            No activity tracked yet.
          </div>
        ) : (
          timeAllocation.map((item, index) => {
            const color = colors[index % colors.length];
            return (
              <div key={item.category} className="py-1.5 px-1 hover:bg-elevated/40 rounded transition-colors">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-tx-primary font-medium text-[11px]">
                      {item.category}
                    </span>
                  </div>
                  <span className="text-[9px] text-tx-muted font-mono">
                    {item.minutes}m ({item.percentage}%)
                  </span>
                </div>

                <div className="w-full bg-canvas h-[2px] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(item.percentage, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
