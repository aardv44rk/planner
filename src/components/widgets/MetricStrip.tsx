import React from 'react';
import { Clock, CheckCircle2, Flame, AlertCircle } from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';

interface SparklineProps {
  data: number[];
  strokeColor?: string;
}

const Sparkline: React.FC<SparklineProps> = ({ data, strokeColor = 'var(--accent)' }) => {
  if (!data || data.length < 2) return null;

  const width = 72;
  const height = 22;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - 4) + 2;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
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

export const MetricStrip: React.FC = () => {
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
      label: 'Focus Time Today',
      value: focusTimeDisplay,
      subtitle: '+12% vs avg',
      icon: Clock,
      sparkline: metrics?.sparklines.focus || [2400, 3100, 4200, 3800, 5100, 6200, focusSecs],
      color: 'var(--accent)',
    },
    {
      label: 'Tasks Completed',
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
      label: 'Pending Items',
      value: `${pendingTasks} Tasks`,
      subtitle: 'Ready to tackle',
      icon: AlertCircle,
      sparkline: metrics?.sparklines.pending || [8, 7, 9, 6, 5, 4, pendingTasks],
      color: '#6366F1',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full h-full select-none">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={i}
            className="flex items-center justify-between px-3 py-2 rounded bg-surface border border-subtle hover:border-tx-muted/30 transition-colors h-full overflow-hidden"
          >
            <div className="flex flex-col justify-center min-w-0 pr-2">
              <div className="flex items-center space-x-1.5 text-tx-muted mb-0.5">
                <Icon className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-tx-muted truncate">
                  {card.label}
                </span>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-lg font-bold tracking-tight text-tx-primary leading-tight">
                  {card.value}
                </span>
                <span className="text-[10px] text-tx-muted truncate">
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
  );
};
