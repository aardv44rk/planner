import React, { useState } from 'react';
import {
  Sparkles,
  PieChart,
  BarChart3,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Check,
  Pin,
} from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';
import { useLayoutStore } from '../../stores/layoutStore';

export const HabitsView: React.FC = () => {
  const {
    habitMatrix,
    toggleHabitDay,
    createHabit,
    timeAllocation,
    metrics,
    tasks,
    selectedDate,
  } = useCommandCenterStore();

  const { isWidgetPinned, toggleWidgetPin } = useLayoutStore();

  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');

  const isHabitsPinned = isWidgetPinned('widget-habit-matrix');
  const isTimeAllocPinned = isWidgetPinned('widget-time-allocation');
  const isKpisPinned = isWidgetPinned('widget-kpis');

  const daysLabel = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // 7 date strings for current week
  const currentBaseDate = new Date(selectedDate);
  const dayOfWeek = (currentBaseDate.getDay() + 6) % 7;
  const monday = new Date(currentBaseDate);
  monday.setDate(currentBaseDate.getDate() - dayOfWeek);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    await createHabit(newHabitName.trim());
    setNewHabitName('');
    setIsAddingHabit(false);
  };

  const colors = ['#A85A32', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899'];

  const focusSecs = metrics?.focus_time_today_secs ?? 9600;
  const hours = Math.floor(focusSecs / 3600);
  const mins = Math.floor((focusSecs % 3600) / 60);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed === 1).length;
  const streakDays = metrics?.active_streak_days ?? 7;

  return (
    <div className="h-full w-full flex flex-col p-4 bg-surface rounded border border-subtle select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-subtle/50">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-semibold tracking-tight text-tx-primary">
                Habits & Metrics
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-elevated border border-subtle text-tx-muted font-mono">
                Streak: {streakDays} Days · Focus: {hours}h {mins}m
              </span>
            </div>
            <p className="text-[11px] text-tx-muted">
              Habit tracking grid, time allocation metrics, and desktop activity analytics.
            </p>
          </div>
        </div>

        {/* Pin to Home Buttons */}
        <div className="flex items-center space-x-2">
          {/* Pin Habit Matrix */}
          <button
            onClick={() => toggleWidgetPin('widget-habit-matrix')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
              isHabitsPinned
                ? 'bg-accent/10 border-accent/40 text-accent font-medium'
                : 'bg-surface border-subtle text-tx-muted hover:text-tx-primary hover:bg-elevated'
            }`}
            title="Toggle Habit Matrix on Home dashboard"
          >
            {isHabitsPinned ? (
              <>
                <Check className="w-3 h-3 text-accent" />
                <span>Habits Pinned ✓</span>
              </>
            ) : (
              <>
                <Pin className="w-3 h-3" />
                <span>Pin Habits to Home</span>
              </>
            )}
          </button>

          {/* Pin Time Allocation */}
          <button
            onClick={() => toggleWidgetPin('widget-time-allocation')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
              isTimeAllocPinned
                ? 'bg-accent/10 border-accent/40 text-accent font-medium'
                : 'bg-surface border-subtle text-tx-muted hover:text-tx-primary hover:bg-elevated'
            }`}
            title="Toggle Time Allocation on Home dashboard"
          >
            {isTimeAllocPinned ? (
              <>
                <Check className="w-3 h-3 text-accent" />
                <span>Allocation Pinned ✓</span>
              </>
            ) : (
              <>
                <Pin className="w-3 h-3" />
                <span>Pin Allocation to Home</span>
              </>
            )}
          </button>

          {/* Pin KPIs */}
          <button
            onClick={() => toggleWidgetPin('widget-kpis')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
              isKpisPinned
                ? 'bg-accent/10 border-accent/40 text-accent font-medium'
                : 'bg-surface border-subtle text-tx-muted hover:text-tx-primary hover:bg-elevated'
            }`}
            title="Toggle KPI strip on Home dashboard"
          >
            {isKpisPinned ? (
              <>
                <Check className="w-3 h-3 text-accent" />
                <span>KPIs Pinned ✓</span>
              </>
            ) : (
              <>
                <Pin className="w-3 h-3" />
                <span>Pin KPIs to Home</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4 mt-3 overflow-hidden">
        {/* Left Column: Habit Matrix Grid (col-span-7) */}
        <div className="col-span-7 flex flex-col min-h-0 bg-canvas/60 rounded border border-subtle p-3.5 overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between pb-2 border-b border-subtle/50">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-semibold text-tx-primary">Weekly Habit Matrix</h3>
              <span className="text-[10px] text-tx-muted font-mono">({habitMatrix.length} habits)</span>
            </div>

            <button
              onClick={() => setIsAddingHabit(!isAddingHabit)}
              className="flex items-center space-x-1 px-2 py-1 rounded bg-accent text-white text-xs font-medium hover:opacity-90 shadow-xs"
            >
              <Plus className="w-3 h-3" />
              <span>Add Habit</span>
            </button>
          </div>

          {/* Inline Add Habit Form */}
          {isAddingHabit && (
            <form onSubmit={handleCreateHabit} className="flex-shrink-0 my-2 flex items-center space-x-2 animate-scale-in">
              <input
                type="text"
                placeholder="Habit name (e.g. Read 20 mins, Morning Run)..."
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded bg-surface border border-subtle text-xs text-tx-primary focus:outline-none focus:border-accent"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs rounded bg-accent text-white font-medium hover:opacity-90 shadow-xs"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsAddingHabit(false)}
                className="px-2 py-1.5 text-xs rounded text-tx-muted hover:bg-elevated"
              >
                Cancel
              </button>
            </form>
          )}

          {/* Matrix Table */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-2 pr-1">
            {/* Days Column Header */}
            <div className="flex items-center justify-between py-1.5 px-1 border-b border-subtle/50 text-xs text-tx-muted font-mono font-medium">
              <span className="flex-1">Habit Name</span>
              <div className="flex items-center space-x-3 pr-2">
                {daysLabel.map((day, idx) => (
                  <span key={idx} className="w-6 text-center text-[10px]">
                    {day}
                  </span>
                ))}
              </div>
            </div>

            {/* Habit Rows */}
            <div className="divide-y divide-subtle/30">
              {habitMatrix.length === 0 ? (
                <div className="text-center text-xs text-tx-muted py-8">
                  No habits added yet. Click "+ Add Habit" to start building your routine!
                </div>
              ) : (
                habitMatrix.map((habit) => {
                  const completedCount = habit.days.filter(Boolean).length;
                  const isPerfect = completedCount === 7;

                  return (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between py-2.5 px-1 hover:bg-surface/80 rounded transition-colors"
                    >
                      <div className="flex items-center space-x-2 flex-1 min-w-0 pr-2">
                        <span className="text-xs font-medium text-tx-primary truncate">
                          {habit.habit_name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            isPerfect
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
                              : 'bg-elevated text-tx-muted'
                          }`}
                        >
                          {completedCount}/7
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 pr-2">
                        {habit.days.map((checked, dIdx) => (
                          <button
                            key={dIdx}
                            onClick={() => toggleHabitDay(habit.id, weekDates[dIdx])}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-all border ${
                              checked
                                ? 'bg-accent border-accent text-white shadow-xs'
                                : 'bg-surface border-subtle/70 hover:border-accent/60 text-transparent'
                            }`}
                            title={`Toggle ${habit.habit_name} on ${weekDates[dIdx]}`}
                          >
                            {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Time Allocation & Activity Metrics (col-span-5) */}
        <div className="col-span-5 flex flex-col min-h-0 gap-3 overflow-hidden">
          {/* Time Allocation Card */}
          <div className="flex-1 min-h-0 flex flex-col bg-canvas/60 rounded border border-subtle p-3.5 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between pb-2 border-b border-subtle/50">
              <div className="flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold text-tx-primary">Time Allocation</h3>
              </div>
              <span className="text-[10px] text-tx-muted font-mono">Today</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-subtle/30 pt-2 pr-1">
              {timeAllocation.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-tx-muted">
                  No activity tracked yet today.
                </div>
              ) : (
                timeAllocation.map((item, index) => {
                  const color = colors[index % colors.length];
                  return (
                    <div key={item.category} className="py-2 px-1 hover:bg-surface/80 rounded transition-colors">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-tx-primary font-medium text-xs">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-[10px] text-tx-muted font-mono">
                          {item.minutes}m ({item.percentage}%)
                        </span>
                      </div>

                      <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden border border-subtle/30">
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

          {/* Metrics Quick Overview Card */}
          <div className="h-44 flex-shrink-0 flex flex-col bg-canvas/60 rounded border border-subtle p-3.5 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between pb-2 border-b border-subtle/50">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-accent" />
                <h4 className="text-xs font-semibold text-tx-primary">Performance Highlights</h4>
              </div>
              <span className="text-[10px] text-tx-muted font-mono">LifeOS Engine</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2 flex-1">
              <div className="p-2 rounded bg-surface border border-subtle/50 flex flex-col justify-center">
                <div className="flex items-center space-x-1.5 text-tx-muted mb-0.5">
                  <Clock className="w-3 h-3 text-accent" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Focus</span>
                </div>
                <span className="text-sm font-bold text-tx-primary font-mono">{hours}h {mins}m</span>
              </div>

              <div className="p-2 rounded bg-surface border border-subtle/50 flex flex-col justify-center">
                <div className="flex items-center space-x-1.5 text-tx-muted mb-0.5">
                  <Flame className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Streak</span>
                </div>
                <span className="text-sm font-bold text-tx-primary font-mono">{streakDays} Days</span>
              </div>

              <div className="p-2 rounded bg-surface border border-subtle/50 flex flex-col justify-center">
                <div className="flex items-center space-x-1.5 text-tx-muted mb-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Tasks</span>
                </div>
                <span className="text-sm font-bold text-tx-primary font-mono">{completedTasks}/{totalTasks}</span>
              </div>

              <div className="p-2 rounded bg-surface border border-subtle/50 flex flex-col justify-center">
                <div className="flex items-center space-x-1.5 text-tx-muted mb-0.5">
                  <AlertCircle className="w-3 h-3 text-indigo-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Pending</span>
                </div>
                <span className="text-sm font-bold text-tx-primary font-mono">{totalTasks - completedTasks} Tasks</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
