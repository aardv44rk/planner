import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Pin,
  Check,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
} from 'date-fns';
import { useCommandCenterStore } from '../../stores/commandCenterStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { ScheduleBlock } from '../../types';
import { api } from '../../utils/ipc';

export type CalendarViewMode = 'day' | 'week' | 'month';

interface ScheduleWidgetProps {
  fullScreen?: boolean;
  showPinButton?: boolean;
}

export const ScheduleWidget: React.FC<ScheduleWidgetProps> = ({
  fullScreen = false,
  showPinButton = false,
}) => {
  const {
    scheduleBlocks,
    selectedDate,
    setSelectedDate,
    createScheduleBlock,
    deleteScheduleBlock,
    importIcs,
  } = useCommandCenterStore();

  const { isWidgetPinned, toggleWidgetPin } = useLayoutStore();

  const [viewMode, setViewMode] = useState<CalendarViewMode>(fullScreen ? 'month' : 'week');
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    try {
      return parseISO(selectedDate);
    } catch {
      return new Date();
    }
  });

  const [monthBlocks, setMonthBlocks] = useState<Record<string, ScheduleBlock[]>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [category, setCategory] = useState('Deep Work');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPinned = isWidgetPinned('widget-schedule');

  // Sync currentDate when selectedDate changes externally
  useEffect(() => {
    try {
      const d = parseISO(selectedDate);
      if (!isNaN(d.getTime())) {
        setCurrentDate(d);
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedDate]);

  // Fetch range for Month view & week dots
  useEffect(() => {
    let isCancelled = false;

    const loadMonthRange = async () => {
      try {
        const mStart = startOfMonth(currentDate);
        const mEnd = endOfMonth(currentDate);
        const rangeStart = startOfWeek(mStart, { weekStartsOn: 1 });
        const rangeEnd = endOfWeek(mEnd, { weekStartsOn: 1 });

        const startStr = format(rangeStart, 'yyyy-MM-dd');
        const endStr = format(rangeEnd, 'yyyy-MM-dd');

        const blocks = await api.getScheduleBlocksRange(startStr, endStr);
        if (isCancelled) return;

        const map: Record<string, ScheduleBlock[]> = {};
        for (const block of blocks) {
          if (!map[block.date]) {
            map[block.date] = [];
          }
          map[block.date].push(block);
        }
        setMonthBlocks(map);
      } catch (err) {
        console.error('Failed to load month blocks:', err);
      }
    };

    loadMonthRange();

    return () => {
      isCancelled = true;
    };
  }, [currentDate, scheduleBlocks]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      const next = subMonths(currentDate, 1);
      setCurrentDate(next);
      setSelectedDate(format(next, 'yyyy-MM-dd'));
    } else if (viewMode === 'week') {
      const next = subWeeks(currentDate, 1);
      setCurrentDate(next);
      setSelectedDate(format(next, 'yyyy-MM-dd'));
    } else {
      const next = subDays(currentDate, 1);
      setCurrentDate(next);
      setSelectedDate(format(next, 'yyyy-MM-dd'));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      const next = addMonths(currentDate, 1);
      setCurrentDate(next);
      setSelectedDate(format(next, 'yyyy-MM-dd'));
    } else if (viewMode === 'week') {
      const next = addWeeks(currentDate, 1);
      setCurrentDate(next);
      setSelectedDate(format(next, 'yyyy-MM-dd'));
    } else {
      const next = addDays(currentDate, 1);
      setCurrentDate(next);
      setSelectedDate(format(next, 'yyyy-MM-dd'));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(format(today, 'yyyy-MM-dd'));
  };

  const handleDayClick = (day: Date) => {
    setCurrentDate(day);
    setSelectedDate(format(day, 'yyyy-MM-dd'));
  };

  const handleHourSlotClick = (hour: number) => {
    const startStr = `${hour.toString().padStart(2, '0')}:00`;
    const endStr = `${(hour + 1).toString().padStart(2, '0')}:00`;
    setStartTime(startStr);
    setEndTime(endStr);
    setIsAdding(true);
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

  // Compact date formatting to prevent 2-line wrapping
  const getHeaderTitle = () => {
    if (viewMode === 'month') {
      return format(currentDate, fullScreen ? 'MMMM yyyy' : 'MMM yyyy');
    }
    if (viewMode === 'week') {
      const wStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const wEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (isSameMonth(wStart, wEnd)) {
        return `${format(wStart, 'MMM d')} – ${format(wEnd, 'd')}`; // e.g. "Nov 2 – 8"
      }
      return `${format(wStart, 'MMM d')} – ${format(wEnd, 'MMM d')}`; // e.g. "Oct 30 – Nov 5"
    }
    return format(currentDate, fullScreen ? 'EEEE, MMM d, yyyy' : 'EEE, MMM d'); // e.g. "Fri, Nov 6"
  };

  // Week days
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Month days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const monthGridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthGridDays = eachDayOfInterval({ start: monthGridStart, end: monthGridEnd });

  // Hours for Day timeline: 08:00 to 22:00 (14 hours total, 15 boundary marks)
  const timelineStartHour = 8;
  const timelineEndHour = 22;
  const totalTimelineHours = timelineEndHour - timelineStartHour; // 14 hours
  const timelineHours = Array.from({ length: totalTimelineHours + 1 }, (_, i) => i + timelineStartHour);

  // Time calculations for proportional day view
  const hourRowHeight = fullScreen ? 56 : 48; // px per hour
  const totalTimelineHeight = totalTimelineHours * hourRowHeight;

  const parseTimeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map((v) => parseInt(v, 10) || 0);
    return h * 60 + m;
  };

  // Live timeline indicator
  const now = new Date();
  const isCurrentDateToday = isSameDay(currentDate, now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const timelineStartMinutes = timelineStartHour * 60;
  const timelineEndMinutes = timelineEndHour * 60;
  const currentNowTopPx =
    ((nowMinutes - timelineStartMinutes) / (timelineEndMinutes - timelineStartMinutes)) * totalTimelineHeight;

  const getCategoryColor = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'deep work':
        return 'border-accent/50 bg-accent/15 text-accent';
      case 'engineering':
      case 'development':
        return 'border-blue-500/50 bg-blue-500/15 text-blue-500 dark:text-blue-400';
      case 'sync':
      case 'meeting':
        return 'border-purple-500/50 bg-purple-500/15 text-purple-500 dark:text-purple-400';
      case 'personal':
        return 'border-amber-500/50 bg-amber-500/15 text-amber-500 dark:text-amber-400';
      default:
        return 'border-subtle bg-elevated text-tx-muted';
    }
  };

  return (
    <div
      className={`flex flex-col h-full w-full select-none min-h-0 overflow-hidden ${
        fullScreen ? 'p-4 bg-surface rounded border border-subtle' : 'p-2.5'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex-shrink-0 flex items-center justify-between pb-1.5 border-b border-subtle/50 min-w-0 gap-2">
        {/* Left: Compact Date Readout */}
        <div className="flex items-center space-x-1.5 min-w-0 flex-1 overflow-hidden">
          <Clock className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          {fullScreen && (
            <>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-tx-muted shrink-0">
                Calendar
              </h2>
              <span className="text-subtle text-xs shrink-0">·</span>
            </>
          )}
          <span className="text-xs font-semibold text-tx-primary whitespace-nowrap truncate min-w-0">
            {getHeaderTitle()}
          </span>
        </div>

        {/* Right: Segmented Control & Navigation Controls (shrink-0) */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Contextual Pin to Home button (when fullScreen/showPinButton) */}
          {showPinButton && (
            <button
              onClick={() => toggleWidgetPin('widget-schedule')}
              className={`flex items-center space-x-1 px-2 py-0.5 text-xs rounded border transition-colors shrink-0 ${
                isPinned
                  ? 'bg-accent/10 border-accent/40 text-accent font-medium'
                  : 'bg-surface border-subtle text-tx-muted hover:text-tx-primary hover:bg-elevated'
              }`}
              title={isPinned ? 'Widget is pinned to Home' : 'Pin widget to Home dashboard'}
            >
              {isPinned ? (
                <>
                  <Check className="w-3 h-3 text-accent" />
                  <span>Pinned ✓</span>
                </>
              ) : (
                <>
                  <Pin className="w-3 h-3" />
                  <span>Pin</span>
                </>
              )}
            </button>
          )}

          {/* Segmented View Mode Switcher: Day | Week | Month */}
          <div className="flex items-center bg-canvas/80 border border-subtle/60 rounded p-0.5 space-x-0.5 text-[9px] font-medium shrink-0">
            {(['day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-1.5 py-0.5 rounded capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-accent text-white font-semibold shadow-xs'
                    : 'text-tx-muted hover:text-tx-primary'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Navigation < Today > */}
          <div className="flex items-center space-x-0.5 shrink-0">
            <button
              onClick={handlePrev}
              className="p-1 rounded text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={handleToday}
              className="px-1.5 py-0.5 text-[9px] font-medium rounded text-tx-muted hover:text-tx-primary hover:bg-elevated border border-subtle/40 transition-colors"
              title="Jump to Today"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1 rounded text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors"
              title="Next"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Quick Action buttons */}
          <div className="flex items-center space-x-0.5 shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleIcsUpload}
              accept=".ics"
              className="hidden"
            />
            {fullScreen && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-tx-muted hover:text-tx-primary hover:bg-elevated border border-subtle/50 text-[10px]"
                title="Import .ics Calendar File"
              >
                <Upload className="w-3 h-3" />
                <span>Import</span>
              </button>
            )}
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded bg-accent text-white hover:opacity-90 text-[10px] font-medium shadow-xs"
              title="Add Block"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inline Quick Add Form */}
      {isAdding && (
        <form
          onSubmit={handleAddBlock}
          className="flex-shrink-0 my-2 p-2 rounded bg-canvas border border-subtle space-y-1.5 text-xs animate-scale-in"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-tx-primary text-[11px]">
              Add Block ({selectedDate})
            </span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-tx-muted hover:text-tx-primary text-xs"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            placeholder="Event title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-2 py-1 rounded bg-surface border border-subtle text-tx-primary placeholder:text-tx-muted/60 focus:outline-none focus:border-accent text-xs"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className="text-[9px] text-tx-muted block mb-0.5">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-1.5 py-0.5 rounded bg-surface border border-subtle text-tx-primary text-xs"
              />
            </div>
            <div>
              <label className="text-[9px] text-tx-muted block mb-0.5">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-1.5 py-0.5 rounded bg-surface border border-subtle text-tx-primary text-xs"
              />
            </div>
            <div>
              <label className="text-[9px] text-tx-muted block mb-0.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-1.5 py-0.5 rounded bg-surface border border-subtle text-tx-primary text-xs"
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
              className="px-2 py-0.5 text-xs rounded text-tx-muted hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2.5 py-0.5 text-xs rounded bg-accent text-white font-medium hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* VIEW 1: DAY VIEW (Proportional Hourly Timeline 08:00 to 22:00) */}
      {viewMode === 'day' && (
        <div className="flex-1 min-h-0 flex flex-col pt-1.5 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 relative">
            <div
              className="relative w-full"
              style={{ height: `${totalTimelineHeight}px` }}
            >
              {/* Hour Grid Lines & Labels */}
              {timelineHours.slice(0, -1).map((hour, idx) => {
                const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                const topPos = idx * hourRowHeight;

                return (
                  <div
                    key={hour}
                    style={{ top: `${topPos}px`, height: `${hourRowHeight}px` }}
                    onClick={() => handleHourSlotClick(hour)}
                    className="absolute left-0 right-0 group/slot flex items-start border-t border-subtle/30 hover:bg-elevated/20 transition-colors cursor-pointer"
                  >
                    <span className="w-10 text-[9px] font-mono text-tx-muted -mt-2 bg-surface px-0.5 select-none">
                      {hourStr}
                    </span>
                    <div className="flex-1 h-full relative" />
                  </div>
                );
              })}

              {/* Final 22:00 boundary line */}
              <div
                style={{ top: `${totalTimelineHeight}px` }}
                className="absolute left-0 right-0 flex items-start border-t border-subtle/30"
              >
                <span className="w-10 text-[9px] font-mono text-tx-muted -mt-2 bg-surface px-0.5 select-none">
                  22:00
                </span>
              </div>

              {/* Current Time Horizontal Line */}
              {isCurrentDateToday && nowMinutes >= timelineStartMinutes && nowMinutes <= timelineEndMinutes && (
                <div
                  style={{ top: `${currentNowTopPx}px` }}
                  className="absolute left-9 right-0 z-30 flex items-center pointer-events-none"
                >
                  <div className="w-2 h-2 rounded-full bg-accent ring-2 ring-accent/30 -ml-1" />
                  <div className="flex-1 h-[1.5px] bg-accent shadow-xs" />
                </div>
              )}

              {/* Schedule Blocks Absolutely Positioned Proportionally */}
              {scheduleBlocks.map((block) => {
                const startMins = parseTimeToMinutes(block.start_time);
                const endMins = parseTimeToMinutes(block.end_time);

                const clampedStart = Math.max(timelineStartMinutes, Math.min(timelineEndMinutes, startMins));
                const clampedEnd = Math.max(clampedStart + 15, Math.min(timelineEndMinutes, endMins));

                const topPx =
                  ((clampedStart - timelineStartMinutes) / (timelineEndMinutes - timelineStartMinutes)) *
                  totalTimelineHeight;
                const heightPx = Math.max(
                  22,
                  ((clampedEnd - clampedStart) / (timelineEndMinutes - timelineStartMinutes)) *
                    totalTimelineHeight - 2
                );

                return (
                  <div
                    key={block.id}
                    style={{
                      top: `${topPx}px`,
                      height: `${heightPx}px`,
                      left: '46px',
                      right: '4px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute z-20 group/block p-1 rounded border shadow-xs flex items-start justify-between overflow-hidden transition-all hover:ring-1 hover:ring-accent/60 ${getCategoryColor(
                      block.category
                    )}`}
                  >
                    <div className="flex flex-col min-w-0 pr-1">
                      <div className="flex items-center space-x-1">
                        <span className="font-mono text-[8px] font-bold">
                          {block.start_time} - {block.end_time}
                        </span>
                        <span className="text-[8px] px-1 rounded font-mono border border-current/20 font-semibold opacity-90">
                          {block.category}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold leading-tight truncate mt-0.5">
                        {block.title}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteScheduleBlock(block.id)}
                      className="opacity-0 group-hover/block:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded transition-opacity"
                      title="Delete block"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: WEEK VIEW (7-Day Strip Selector + Vertical Agenda) */}
      {viewMode === 'week' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-1">
          {/* Week Day Strip Selector */}
          <div className="flex-shrink-0 flex items-center justify-between py-1 border-b border-subtle/40">
            <div className="grid grid-cols-7 gap-1 w-full">
              {weekDays.map((d) => {
                const dayStr = format(d, 'yyyy-MM-dd');
                const isSelected = dayStr === selectedDate;
                const isCurrent = isToday(d);
                const hasBlocks = (monthBlocks[dayStr]?.length || 0) > 0;

                return (
                  <button
                    key={dayStr}
                    onClick={() => handleDayClick(d)}
                    className={`flex flex-col items-center justify-center py-1 rounded transition-colors text-xs relative border ${
                      isSelected
                        ? 'bg-accent text-white font-medium border-accent shadow-xs'
                        : isCurrent
                        ? 'bg-accent/10 text-accent font-semibold border-accent/40'
                        : 'text-tx-muted hover:bg-elevated hover:text-tx-primary border-transparent'
                    }`}
                  >
                    <span className="text-[8px] uppercase tracking-wider font-mono">
                      {format(d, 'EEE')}
                    </span>
                    <span className="font-semibold text-[11px] leading-tight mt-0.5">
                      {format(d, 'd')}
                    </span>
                    {hasBlocks && !isSelected && (
                      <span className="w-1 h-1 rounded-full bg-accent mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Agenda List */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-1 divide-y divide-subtle/30 pr-1">
            {scheduleBlocks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-tx-muted text-xs text-center p-4">
                <CalendarIcon className="w-5 h-5 mb-1 opacity-30" />
                <span className="text-[11px]">No blocks scheduled for {format(currentDate, 'MMM d')}</span>
                <button
                  onClick={() => setIsAdding(true)}
                  className="mt-1 text-[11px] text-accent hover:underline font-medium"
                >
                  + Add schedule block
                </button>
              </div>
            ) : (
              scheduleBlocks.map((block) => (
                <div
                  key={block.id}
                  className="group/item flex items-center justify-between py-1.5 px-1 hover:bg-elevated/40 rounded transition-colors"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="flex items-center space-x-1 text-[10px] font-mono text-accent w-20 flex-shrink-0">
                      <span>{block.start_time}</span>
                      <span className="text-tx-muted">-</span>
                      <span>{block.end_time}</span>
                    </div>
                    <div className="w-[2px] h-3.5 bg-accent/60 rounded-full flex-shrink-0" />
                    <div className="min-w-0 flex items-center space-x-2">
                      <span className="text-[11px] font-medium text-tx-primary leading-tight truncate">
                        {block.title}
                      </span>
                      <span className={`text-[8px] px-1 py-0.2 rounded font-mono flex-shrink-0 border ${getCategoryColor(block.category)}`}>
                        {block.category}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteScheduleBlock(block.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded transition-opacity flex-shrink-0"
                    title="Delete block"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: MONTH VIEW (7-Column Calendar Grid + Indicators) */}
      {viewMode === 'month' && (
        <div className="flex-1 min-h-0 flex flex-col pt-1 overflow-hidden">
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-mono uppercase text-tx-muted pb-1 border-b border-subtle/40">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* 7-Column Month Calendar Grid */}
          <div
            className={`grid grid-cols-7 gap-1 pt-1.5 pb-1.5 ${
              fullScreen ? 'flex-1 min-h-0 auto-rows-fr' : ''
            }`}
          >
            {monthGridDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isCurrMonth = isSameMonth(day, currentDate);
              const isSelected = isSameDay(day, parseISO(selectedDate));
              const isCurrent = isToday(day);
              const dayEvents = monthBlocks[dayStr] || [];

              return (
                <button
                  key={dayStr}
                  onClick={() => handleDayClick(day)}
                  className={`p-1 rounded flex flex-col items-center justify-between text-xs transition-colors relative border ${
                    fullScreen ? 'min-h-[48px]' : 'min-h-[28px]'
                  } ${
                    isSelected
                      ? 'bg-accent text-white font-semibold border-accent shadow-xs'
                      : isCurrent
                      ? 'bg-accent/10 text-accent font-semibold border-accent/40 hover:bg-accent/20'
                      : isCurrMonth
                      ? 'text-tx-primary hover:bg-elevated border-transparent'
                      : 'text-tx-muted/40 hover:bg-elevated/40 border-transparent'
                  }`}
                >
                  <div className="w-full flex items-center justify-between">
                    <span className="leading-none text-[10px]">{format(day, 'd')}</span>
                    {dayEvents.length > 0 && (
                      <span
                        className={`text-[8px] font-mono px-0.5 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-accent/15 text-accent'
                        }`}
                      >
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Dot / Pill Indicators */}
                  <div className="flex items-center space-x-0.5 h-1.5 mt-auto">
                    {dayEvents.slice(0, 3).map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-1 h-1 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-accent'
                        }`}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className={`text-[7px] leading-none ${isSelected ? 'text-white' : 'text-accent'}`}>
                        +
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Agenda of selected date */}
          <div className="flex-1 min-h-0 border-t border-subtle/50 pt-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-1 text-[10px] text-tx-muted">
              <span className="font-semibold text-tx-primary">
                {format(parseISO(selectedDate), 'EEE, MMM d, yyyy')}
              </span>
              <span className="font-mono text-[9px]">{scheduleBlocks.length} event(s)</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-subtle/30 pr-1">
              {scheduleBlocks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-tx-muted text-xs py-2">
                  No events for this date.
                </div>
              ) : (
                scheduleBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="group/item flex items-center justify-between py-1.5 px-1 hover:bg-elevated/40 rounded transition-colors"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="text-[10px] font-mono text-accent w-20 flex-shrink-0">
                        {block.start_time} - {block.end_time}
                      </span>
                      <span className="text-[11px] font-medium text-tx-primary truncate">
                        {block.title}
                      </span>
                      <span className={`text-[8px] px-1 py-0.2 rounded font-mono ${getCategoryColor(block.category)}`}>
                        {block.category}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteScheduleBlock(block.id)}
                      className="opacity-0 group-hover/item:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded transition-opacity"
                      title="Delete event"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
