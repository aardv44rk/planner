import React, { useState, useRef } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';

export const ScheduleWidget: React.FC = () => {
  const {
    scheduleBlocks,
    selectedDate,
    setSelectedDate,
    createScheduleBlock,
    deleteScheduleBlock,
    importIcs,
  } = useCommandCenterStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('Deep Work');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute 7 days for the current week centered on selectedDate
  const currentBaseDate = new Date(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentBaseDate);
    const dayOfWeek = (currentBaseDate.getDay() + 6) % 7;
    d.setDate(currentBaseDate.getDate() - dayOfWeek + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    return { dateStr, dayName, dayNum };
  });

  const handleDaySelect = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handlePrevWeek = () => {
    const d = new Date(currentBaseDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const d = new Date(currentBaseDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await createScheduleBlock({
      title: newTitle.trim(),
      start_time: startTime,
      end_time: endTime,
      category,
      date: selectedDate,
    });

    setNewTitle('');
    setIsAdding(false);
  };

  const handleIcsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const importedCount = await importIcs(text, selectedDate);
    alert(`Successfully imported ${importedCount} calendar event(s).`);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface rounded border border-subtle p-2.5 select-none min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-1.5 border-b border-subtle">
        <div className="flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-primary">
            Schedule & Agenda
          </h2>
        </div>

        <div className="flex items-center space-x-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleIcsUpload}
            accept=".ics"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors"
            title="Import .ics Calendar File"
          >
            <Upload className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="p-1 rounded text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors"
            title="Add Schedule Block"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Week Day Strip Selector */}
      <div className="flex-shrink-0 flex items-center justify-between py-1.5 border-b border-subtle">
        <button
          onClick={handlePrevWeek}
          className="p-0.5 text-tx-muted hover:text-tx-primary rounded hover:bg-elevated"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>

        <div className="flex items-center space-x-1">
          {weekDays.map((w) => {
            const isSelected = w.dateStr === selectedDate;
            return (
              <button
                key={w.dateStr}
                onClick={() => handleDaySelect(w.dateStr)}
                className={`flex flex-col items-center justify-center w-7 py-0.5 rounded transition-colors text-[10px] ${
                  isSelected
                    ? 'bg-accent text-white font-medium'
                    : 'text-tx-muted hover:bg-elevated hover:text-tx-primary'
                }`}
              >
                <span className="text-[8px] uppercase">{w.dayName[0]}</span>
                <span className="font-semibold text-[11px] leading-tight">{w.dayNum}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNextWeek}
          className="p-0.5 text-tx-muted hover:text-tx-primary rounded hover:bg-elevated"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Quick Add Form */}
      {isAdding && (
        <form
          onSubmit={handleAddBlock}
          className="flex-shrink-0 my-1.5 p-2 rounded bg-canvas border border-subtle space-y-1.5 text-xs"
        >
          <input
            type="text"
            placeholder="Block title (e.g. Deep Work)..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-2 py-0.5 rounded bg-surface border border-subtle text-tx-primary placeholder:text-tx-muted/60 focus:outline-none focus:border-accent text-xs"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="text-[9px] text-tx-muted block">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-1 py-0.2 rounded bg-surface border border-subtle text-tx-primary text-[11px]"
              />
            </div>
            <div>
              <label className="text-[9px] text-tx-muted block">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-1 py-0.2 rounded bg-surface border border-subtle text-tx-primary text-[11px]"
              />
            </div>
            <div>
              <label className="text-[9px] text-tx-muted block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-1 py-0.2 rounded bg-surface border border-subtle text-tx-primary text-[11px]"
              >
                <option value="Deep Work">Deep Work</option>
                <option value="Engineering">Engineering</option>
                <option value="Sync">Sync</option>
                <option value="Development">Dev</option>
                <option value="Personal">Personal</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2 py-0.5 text-[10px] rounded text-tx-muted hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2 py-0.5 text-[10px] rounded bg-accent text-white font-medium hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* Agenda List with internal scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto mt-1.5 space-y-1.5 pr-0.5">
        {scheduleBlocks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-tx-muted text-xs text-center p-4">
            <Calendar className="w-5 h-5 mb-1 opacity-40" />
            <span className="text-[11px]">No blocks for this date</span>
            <button
              onClick={() => setIsAdding(true)}
              className="mt-1.5 text-[10px] text-accent hover:underline"
            >
              + Add block
            </button>
          </div>
        ) : (
          scheduleBlocks.map((block) => (
            <div
              key={block.id}
              className="group flex items-start justify-between p-1.5 rounded bg-canvas border border-subtle hover:border-tx-muted/30 transition-colors"
            >
              <div className="flex items-start space-x-2 min-w-0">
                <div className="flex flex-col text-[10px] font-mono font-medium text-accent pt-0.5 w-9 text-right flex-shrink-0">
                  <span>{block.start_time}</span>
                  <span className="text-[8px] text-tx-muted">{block.end_time}</span>
                </div>
                <div className="w-[2px] h-6 bg-subtle group-hover:bg-accent transition-colors rounded-full flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-tx-primary leading-tight truncate">
                    {block.title}
                  </div>
                  <span className="inline-block mt-0.5 text-[9px] px-1 py-0 rounded bg-elevated text-tx-muted font-mono">
                    {block.category}
                  </span>
                </div>
              </div>

              <button
                onClick={() => deleteScheduleBlock(block.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded transition-opacity flex-shrink-0"
                title="Delete block"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
