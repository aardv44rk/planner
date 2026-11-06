import React from 'react';
import { Clock, CheckCircle2, Flame, AlertCircle } from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';

interface SparklineProps {
  data: number[];
  strokeColor?: string;
}

const Sparkline: React.FC<SparklineProps> = ({ data, strokeColor = 'var(--accent)' }) => {
  if (!data || data.length < 2) return null;

  const width = 56;
  const height = 18;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 4) + 2;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible flex-shrink-0">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export interface MetricStripProps {
  colSpan?: number;
}

export const MetricStrip: React.FC<MetricStripProps> = ({ colSpan }) => {
  const { metrics, tasks } = useCommandCenterStore();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed === 1).length;
  const pendingTasks = totalTasks - completedTasks;

  const focusSecs = metrics?.focus_time_today_secs ?? 9600;
  const hours = Math.floor(focusSecs / 3600);
  const mins = Math.floor((focusSecs % 3600) / 60);
  const focusTimeDisplay = `${hours}h ${mins}m`;

  const streakDays = metrics?.active_streak_days ?? 7;

  const cards = [
    {
      label: 'Focus Today',
      value: focusTimeDisplay,
      subtitle: '+12% vs avg',
      icon: Clock,
      sparkline: metrics?.sparklines.focus || [2400, 3100, 4200, 3800, 5100, 6200, focusSecs],
      color: 'var(--accent)',
    },
    {
      label: 'Tasks Done',
      value: `${completedTasks} / ${totalTasks}`,
      subtitle: `${totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}% done`,
      icon: CheckCircle2,
      sparkline: metrics?.sparklines.tasks || [3, 5, 4, 7, 6, 8, completedTasks],
      color: '#10B981',
    },
    {
      label: 'Active Streak',
      value: `${streakDays} Days`,
      subtitle: 'Consistent flow',
      icon: Flame,
      sparkline: metrics?.sparklines.streak || [1, 2, 3, 4, 5, 6, streakDays],
      color: '#F59E0B',
    },
    {
      label: 'Pending',
      value: `${pendingTasks} Tasks`,
      subtitle: 'Ready to tackle',
      icon: AlertCircle,
      sparkline: metrics?.sparklines.pending || [8, 7, 9, 6, 5, 4, pendingTasks],
      color: '#6366F1',
    },
  ];

  // Responsive grid columns based on colSpan prop or CSS container queries
  const getGridColsClass = () => {
    if (colSpan !== undefined) {
      if (colSpan >= 10) return 'grid-cols-4';
      if (colSpan >= 6) return 'grid-cols-2';
      return 'grid-cols-1';
    }
    return 'grid-cols-1 @[360px]:grid-cols-2 @[720px]:grid-cols-4';
  };

  return (
    <div className="@container w-full h-full p-2.5 min-h-0 overflow-y-auto custom-scrollbar select-none">
      <div className={`grid ${getGridColsClass()} gap-2.5 w-full h-full min-h-0 items-stretch`}>
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 rounded bg-surface/80 border border-subtle/80 hover:border-tx-muted/30 transition-colors min-h-[64px] min-w-0 overflow-hidden"
            >
              <div className="flex flex-col justify-center min-w-0 pr-2 flex-1">
                <div className="flex items-center space-x-1.5 text-tx-muted mb-0.5 min-w-0">
                  <Icon className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-tx-muted truncate">
                    {card.label}
                  </span>
                </div>
                <div className="flex items-baseline space-x-1.5 min-w-0 flex-wrap">
                  <span className="text-base font-bold tracking-tight text-tx-primary leading-tight font-mono truncate">
                    {card.value}
                  </span>
                  <span className="text-[9px] text-tx-muted truncate min-w-0">
                    {card.subtitle}
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0">
                <Sparkline data={card.sparkline} strokeColor={card.color} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
