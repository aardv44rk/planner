import React, { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';
import { HabitDay } from '../../types';

export const HabitMatrixWidget: React.FC = () => {
  const { habitMatrix } = useCommandCenterStore();
  const [localHabits, setLocalHabits] = useState<HabitDay[]>([]);

  React.useEffect(() => {
    if (habitMatrix && habitMatrix.length > 0) {
      setLocalHabits(habitMatrix);
    }
  }, [habitMatrix]);

  const daysLabel = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const toggleDay = (habitIndex: number, dayIndex: number) => {
    setLocalHabits((prev) => {
      const copy = prev.map((h, hIdx) => {
        if (hIdx !== habitIndex) return h;
        const newDays = [...h.days];
        newDays[dayIndex] = !newDays[dayIndex];
        return { ...h, days: newDays };
      });
      return copy;
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface rounded border border-subtle p-2.5 select-none min-h-0 overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between pb-1.5 border-b border-subtle">
        <div className="flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-primary">
            Habit & Streak Grid
          </h2>
        </div>
        <span className="text-[10px] text-tx-muted font-mono">7 Days</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mt-1 pr-0.5">
        {/* Days Header */}
        <div className="flex items-center justify-between pb-1 border-b border-subtle/50 text-[9px] text-tx-muted font-mono">
          <span className="flex-1">Routine</span>
          <div className="flex items-center space-x-1.5">
            {daysLabel.map((d, i) => (
              <span key={i} className="w-3.5 text-center">
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Habits Rows */}
        <div className="space-y-1 mt-1">
          {localHabits.map((habit, hIdx) => {
            const completedCount = habit.days.filter(Boolean).length;
            return (
              <div
                key={habit.habit_name}
                className="flex items-center justify-between py-0.5 text-xs"
              >
                <div className="flex items-center space-x-1.5 flex-1 min-w-0 pr-1">
                  <span className="truncate text-tx-primary text-[10px]">
                    {habit.habit_name}
                  </span>
                  <span className="text-[8px] text-tx-muted font-mono">
                    ({completedCount})
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {habit.days.map((checked, dIdx) => (
                    <button
                      key={dIdx}
                      onClick={() => toggleDay(hIdx, dIdx)}
                      className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-colors border ${
                        checked
                          ? 'bg-accent border-accent text-white'
                          : 'bg-canvas border-subtle hover:border-tx-muted/50 text-transparent'
                      }`}
                      title={`Toggle ${habit.habit_name} day ${daysLabel[dIdx]}`}
                    >
                      {checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
