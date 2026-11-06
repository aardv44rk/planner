import React, { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';

export const HabitMatrixWidget: React.FC = () => {
  const { habitMatrix, toggleHabitDay, createHabit, selectedDate } = useCommandCenterStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');

  const daysLabel = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Compute the 7 date strings for the week matching selectedDate
  const currentBaseDate = new Date(selectedDate);
  const dayOfWeek = (currentBaseDate.getDay() + 6) % 7;
  const monday = new Date(currentBaseDate);
  monday.setDate(currentBaseDate.getDate() - dayOfWeek);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    await createHabit(newHabitName.trim());
    setNewHabitName('');
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col h-full w-full p-2.5 select-none min-h-0 overflow-hidden">
      {/* Sub Toolbar: Habit count & Add button */}
      <div className="flex-shrink-0 flex items-center justify-between pb-1 border-b border-subtle/40">
        <span className="text-[10px] text-tx-muted font-mono">
          Weekly Habits ({habitMatrix.length})
        </span>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-0.5 rounded text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors"
          title="Add Habit"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Add Habit Form */}
      {isAdding && (
        <form onSubmit={handleCreate} className="flex-shrink-0 my-1 flex items-center space-x-1">
          <input
            type="text"
            placeholder="New habit name..."
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            className="flex-1 px-1.5 py-0.5 rounded bg-canvas border border-subtle text-[11px] text-tx-primary focus:outline-none focus:border-accent"
            autoFocus
          />
          <button
            type="submit"
            className="px-2 py-0.5 text-[10px] rounded bg-accent text-white font-medium hover:opacity-90"
          >
            Add
          </button>
        </form>
      )}

      {/* Habits List */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-1 pr-1">
        {/* Days Header */}
        <div className="flex items-center justify-between py-0.5 border-b border-subtle/40 text-[9px] text-tx-muted font-mono">
          <span className="flex-1">Daily Habit</span>
          <div className="flex items-center space-x-1.5">
            {daysLabel.map((d, i) => (
              <span key={i} className="w-3.5 text-center">
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-subtle/30">
          {habitMatrix.map((habit) => {
            const completedCount = habit.days.filter(Boolean).length;
            return (
              <div
                key={habit.id}
                className="flex items-center justify-between py-1.5 px-0.5 hover:bg-elevated/40 rounded transition-colors"
              >
                <div className="flex items-center space-x-1.5 flex-1 min-w-0 pr-1">
                  <span className="truncate text-tx-primary text-[11px]">
                    {habit.habit_name}
                  </span>
                  <span className="text-[9px] text-tx-muted font-mono">
                    ({completedCount}/7)
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {habit.days.map((checked, dIdx) => (
                    <button
                      key={dIdx}
                      onClick={() => toggleHabitDay(habit.id, weekDates[dIdx])}
                      className={`w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-colors border ${
                        checked
                          ? 'bg-accent border-accent text-white'
                          : 'bg-canvas border-subtle/60 hover:border-tx-muted/60 text-transparent'
                      }`}
                      title={`Toggle ${habit.habit_name} on ${weekDates[dIdx]}`}
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
