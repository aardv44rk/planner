import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Plus,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
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
import { ScheduleBlock } from '../../types';
import { api } from '../../utils/ipc';
import { courseMatchesQuarter } from '../../utils/academic';

export type CalendarViewMode = 'day' | 'week' | 'month' | 'timetable';

interface ScheduleWidgetProps {
  fullScreen?: boolean;
}

export const ScheduleWidget: React.FC<ScheduleWidgetProps> = ({
  fullScreen = false,
}) => {
  const {
    scheduleBlocks,
    selectedDate,
    setSelectedDate,
    createScheduleBlock,
    deleteScheduleBlock,
    importIcs,
    courses,
    selectedQuarter,
    setSelectedQuarter,
    selectedAcademicYear,
  } = useCommandCenterStore();

  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    if (fullScreen) return 'timetable';
    const saved = localStorage.getItem('lifeos-default-cal-view') as CalendarViewMode | null;
    return saved && ['day', 'week', 'month', 'timetable'].includes(saved) ? saved : 'week';
  });

  useEffect(() => {
    const handleViewChange = () => {
      const saved = localStorage.getItem('lifeos-default-cal-view') as CalendarViewMode | null;
      if (saved && ['day', 'week', 'month', 'timetable'].includes(saved)) {
        setViewMode(saved);
      }
    };
    window.addEventListener('calendar-view-changed', handleViewChange);
    window.addEventListener('storage', handleViewChange);
    return () => {
      window.removeEventListener('calendar-view-changed', handleViewChange);
      window.removeEventListener('storage', handleViewChange);
    };
  }, []);

  const handleSelectViewMode = (mode: CalendarViewMode) => {
    setViewMode(mode);
    localStorage.setItem('lifeos-default-cal-view', mode);
  };
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

  const findCoursesForSlot = (dayName: string, slotPeriods: number[]) => {
    return courses
      .filter((c) => courseMatchesQuarter(c.term, selectedQuarter, selectedAcademicYear))
      .filter((c) => {
        if (!c.schedule || c.schedule.includes('On-Demand') || c.schedule.includes('Project')) return false;
        const hasDay = c.schedule.includes(dayName);
        if (!hasDay) return false;
        if (slotPeriods.includes(1) && (c.schedule.includes('08:50') || c.schedule.includes('10:30'))) return true;
        if (slotPeriods.includes(3) && (c.schedule.includes('10:45') || c.schedule.includes('12:25'))) return true;
        if (slotPeriods.includes(5) && (c.schedule.includes('13:30') || c.schedule.includes('15:10'))) return true;
        if (slotPeriods.includes(7) && (c.schedule.includes('15:25') || c.schedule.includes('17:05'))) return true;
        if (slotPeriods.includes(9) && (c.schedule.includes('17:15') || c.schedule.includes('18:55'))) return true;
        return false;
      });
  };

  return (
    <div
      className={`@container flex flex-col h-full w-full select-none min-h-0 overflow-hidden ${
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
          {/* Segmented View Mode Switcher: Day | Week | Month | Timetable */}
          <div className="flex items-center bg-canvas/80 border border-subtle/60 rounded p-0.5 space-x-0.5 text-[9px] font-medium shrink-0">
            {(['day', 'week', 'month', 'timetable'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleSelectViewMode(mode)}
                className={`px-1.5 py-0.5 rounded capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-accent text-white font-semibold shadow-xs'
                    : 'text-tx-muted hover:text-tx-primary'
                }`}
              >
                {mode === 'timetable' ? 'Timetable' : mode}
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

      {/* Timetable (時間割) View */}
      {viewMode === 'timetable' && (
        <div className="flex-1 min-h-0 flex flex-col pt-1 overflow-hidden">
          {/* Quarter bar and quick summary */}
          <div className="flex-shrink-0 flex items-center justify-between pb-2 border-b border-subtle/50">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-semibold text-tx-primary">
                Timetable
              </span>
              <span className="text-[10px] font-mono text-muted">
                {selectedQuarter === 'All' ? 'Full Academic Year' : `Quarter ${selectedQuarter}`}
              </span>
            </div>

            {/* Quarter Filter Chips */}
            <div className="flex items-center gap-1">
              {['3Q', '4Q', '1Q', '2Q', 'All'].map((q) => {
                const isSel = selectedQuarter === q;
                const count = q === 'All'
                  ? courses.filter((c) => courseMatchesQuarter(c.term, 'All', selectedAcademicYear)).length
                  : courses.filter((c) => courseMatchesQuarter(c.term, q, selectedAcademicYear)).length;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setSelectedQuarter(q)}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                      isSel
                        ? 'bg-accent text-white font-semibold shadow-xs'
                        : 'bg-surface text-muted hover:text-tx-primary hover:bg-surface-3'
                    }`}
                  >
                    <span>{q}</span>
                    <span className="ml-1 opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timetable Grid Container */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-2 space-y-3">
            <div className="w-full border border-subtle rounded-[var(--radius-control)] overflow-hidden bg-surface">
              {/* Header: Periods & Days */}
              <div className="grid grid-cols-7 border-b border-subtle bg-surface-3 text-[11px] font-semibold text-tx-primary divide-x divide-subtle select-none">
                <div className="p-2 text-center text-muted font-mono text-[10px]">時限 / Period</div>
                {['Mon (月)', 'Tue (火)', 'Wed (水)', 'Thu (木)', 'Fri (金)', 'Sat (土)'].map((day) => (
                  <div key={day} className="p-2 text-center text-[11px] font-medium text-tx-primary">
                    {day}
                  </div>
                ))}
              </div>

              {/* Rows for 1-2, 3-4, Lunch, 5-6, 7-8, 9-10 */}
              {[
                { slotLabel: '1–2', times: '08:50 – 10:30', periods: [1, 2], isBreak: false },
                { slotLabel: '3–4', times: '10:45 – 12:25', periods: [3, 4], isBreak: false },
                { slotLabel: 'Lunch', times: '12:25 – 13:30', periods: [], isBreak: true },
                { slotLabel: '5–6', times: '13:30 – 15:10', periods: [5, 6], isBreak: false },
                { slotLabel: '7–8', times: '15:25 – 17:05', periods: [7, 8], isBreak: false },
                { slotLabel: '9–10', times: '17:15 – 18:55', periods: [9, 10], isBreak: false },
              ].map((slot) => {
                if (slot.isBreak) {
                  return (
                    <div
                      key={slot.slotLabel}
                      className="grid grid-cols-7 border-b border-subtle/50 bg-surface-2/40 text-[10px] text-muted py-1 divide-x divide-subtle/30"
                    >
                      <div className="px-2 text-center font-mono font-medium">{slot.times}</div>
                      <div className="col-span-6 px-3 text-center text-[10px] text-muted font-medium italic">
                        Lunch Break / 昼休み
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={slot.slotLabel}
                    className="grid grid-cols-7 border-b border-subtle/50 divide-x divide-subtle min-h-[64px]"
                  >
                    {/* Period label */}
                    <div className="p-2 flex flex-col justify-center items-center bg-surface-2/50 text-center select-none">
                      <span className="font-mono font-bold text-xs text-tx-primary">{slot.slotLabel}</span>
                      <span className="font-mono text-[9px] text-muted mt-0.5">{slot.times}</span>
                    </div>

                    {/* Day Cells: Mon (1) to Sat (6) */}
                    {[
                      { name: 'Mon', key: 'Mon' },
                      { name: 'Tue', key: 'Tue' },
                      { name: 'Wed', key: 'Wed' },
                      { name: 'Thu', key: 'Thu' },
                      { name: 'Fri', key: 'Fri' },
                      { name: 'Sat', key: 'Sat' },
                    ].map((d) => {
                      const matchedCourses = findCoursesForSlot(d.key, slot.periods);

                      return (
                        <div
                          key={d.name}
                          className="p-1.5 flex flex-col justify-start space-y-1 hover:bg-surface-2/30 transition-colors"
                        >
                          {matchedCourses.map((c) => (
                            <div
                              key={c.id}
                              className="p-1.5 rounded-[var(--radius-control)] border text-left cursor-pointer transition-all hover:scale-[1.01] hover:shadow-subtle"
                              style={{
                                backgroundColor: 'var(--bg-surface-2)',
                                borderColor: c.color ? `${c.color}50` : 'var(--border-subtle)',
                                borderLeftWidth: '3px',
                                borderLeftColor: c.color || 'var(--accent)',
                              }}
                              title={`${c.code}: ${c.title} (${c.schedule})`}
                            >
                              <div className="font-mono text-[10px] font-bold text-accent truncate">
                                {c.code}
                              </div>
                              <div className="text-[11px] font-semibold text-tx-primary line-clamp-2 leading-snug mt-0.5">
                                {c.title}
                              </div>
                              <div className="text-[9px] text-muted mt-0.5 flex items-center justify-between">
                                <span className="truncate">{c.room || 'LMS'}</span>
                                <span className="font-mono opacity-80">{slot.slotLabel}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Unscheduled & On-Demand Courses Section */}
            <div className="p-3 rounded-[var(--radius-control)] border border-subtle bg-surface space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-tx-primary">
                  Other / Intensive
                </span>
                <span className="text-[10px] text-muted font-mono">
                  {
                    courses
                      .filter((c) => courseMatchesQuarter(c.term, selectedQuarter, selectedAcademicYear))
                      .filter((c) => !c.schedule || c.schedule.includes('On-Demand') || c.schedule.includes('Project')).length
                  }{' '}
                  Course(s)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {courses
                  .filter((c) => courseMatchesQuarter(c.term, selectedQuarter, selectedAcademicYear))
                  .filter((c) => !c.schedule || c.schedule.includes('On-Demand') || c.schedule.includes('Project'))
                  .map((c) => (
                    <div
                      key={c.id}
                      className="p-2 rounded-[var(--radius-control)] bg-surface-2 border border-subtle flex items-start space-x-2"
                    >
                      <span
                        className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: c.color || 'var(--accent)' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[10px] font-bold text-accent">{c.code}</div>
                        <div className="text-[11px] font-medium text-tx-primary truncate mt-0.5">{c.title}</div>
                        <div className="text-[9px] text-muted font-mono mt-0.5">{c.term} · {c.schedule}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: GOOGLE CALENDAR-STYLE WEEK VIEW (7-Column 2D Time Grid 08:00 to 22:00) */}
      {viewMode === 'week' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden pt-1">
          {/* Header: Time label spacer + 7 Days of Week Header */}
          <div className="flex-shrink-0 flex items-center border-b border-subtle/50 pb-1.5 pr-2">
            <div className="w-10 shrink-0 text-center text-[9px] font-mono text-tx-muted uppercase select-none">
              Time
            </div>
            <div className="flex-1 grid grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const dayStr = format(d, 'yyyy-MM-dd');
                const isSelected = dayStr === selectedDate;
                const isCurrent = isToday(d);
                return (
                  <button
                    key={dayStr}
                    type="button"
                    onClick={() => handleDayClick(d)}
                    className={`flex flex-col items-center justify-center py-1 rounded transition-colors text-xs border ${
                      isSelected
                        ? 'bg-accent text-white font-medium border-accent shadow-xs'
                        : isCurrent
                        ? 'bg-accent/15 text-accent font-semibold border-accent/40'
                        : 'text-tx-muted hover:bg-elevated hover:text-tx-primary border-transparent'
                    }`}
                  >
                    <span className="text-[8px] uppercase tracking-wider font-mono">
                      {format(d, 'EEE')}
                    </span>
                    <span className="font-semibold text-[11px] leading-tight mt-0.5">
                      {format(d, 'd')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2D Scrollable Time Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative pr-1">
            <div
              className="relative w-full flex"
              style={{ height: `${totalTimelineHeight}px` }}
            >
              {/* Left Y-Axis Time Labels */}
              <div className="w-10 shrink-0 relative border-r border-subtle/30">
                {timelineHours.slice(0, -1).map((hour, idx) => {
                  const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                  const topPos = idx * hourRowHeight;
                  return (
                    <div
                      key={hour}
                      style={{ top: `${topPos}px` }}
                      className="absolute left-0 right-1 text-right text-[9px] font-mono text-tx-muted -mt-2 select-none"
                    >
                      {hourStr}
                    </div>
                  );
                })}
                <div
                  style={{ top: `${totalTimelineHeight}px` }}
                  className="absolute left-0 right-1 text-right text-[9px] font-mono text-tx-muted -mt-2 select-none"
                >
                  22:00
                </div>
              </div>

              {/* 7 Day Columns */}
              <div className="flex-1 grid grid-cols-7 relative divide-x divide-subtle/20">
                {weekDays.map((d) => {
                  const dayStr = format(d, 'yyyy-MM-dd');
                  const isCurrent = isToday(d);
                  const dayBlocks = monthBlocks[dayStr] || [];

                  return (
                    <div
                      key={dayStr}
                      className="relative h-full hover:bg-elevated/10 transition-colors"
                    >
                      {/* Hour Grid Lines */}
                      {timelineHours.slice(0, -1).map((hour, idx) => {
                        const topPos = idx * hourRowHeight;
                        return (
                          <div
                            key={hour}
                            style={{ top: `${topPos}px`, height: `${hourRowHeight}px` }}
                            onClick={() => {
                              setSelectedDate(dayStr);
                              setCurrentDate(d);
                              handleHourSlotClick(hour);
                            }}
                            className="absolute left-0 right-0 border-t border-subtle/25 hover:bg-accent/5 transition-colors cursor-pointer"
                          />
                        );
                      })}

                      {/* Current Time Horizontal Line for Today */}
                      {isCurrent && nowMinutes >= timelineStartMinutes && nowMinutes <= timelineEndMinutes && (
                        <div
                          style={{ top: `${currentNowTopPx}px` }}
                          className="absolute left-0 right-0 z-30 flex items-center pointer-events-none"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-accent ring-1 ring-accent/30 -ml-0.5" />
                          <div className="flex-1 h-[1.5px] bg-accent shadow-xs" />
                        </div>
                      )}

                      {/* Schedule Blocks for this Day */}
                      {dayBlocks.map((block) => {
                        const startMins = parseTimeToMinutes(block.start_time);
                        const endMins = parseTimeToMinutes(block.end_time);

                        const clampedStart = Math.max(timelineStartMinutes, Math.min(timelineEndMinutes, startMins));
                        const clampedEnd = Math.max(clampedStart + 15, Math.min(timelineEndMinutes, endMins));

                        const topPx =
                          ((clampedStart - timelineStartMinutes) / (timelineEndMinutes - timelineStartMinutes)) *
                          totalTimelineHeight;
                        const heightPx = Math.max(
                          20,
                          ((clampedEnd - clampedStart) / (timelineEndMinutes - timelineStartMinutes)) *
                            totalTimelineHeight - 2
                        );

                        return (
                          <div
                            key={block.id}
                            style={{
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              left: '2px',
                              right: '2px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(dayStr);
                              setCurrentDate(d);
                            }}
                            className={`absolute z-20 group/block p-1 rounded border shadow-xs flex flex-col justify-between overflow-hidden transition-all hover:ring-1 hover:ring-accent/60 ${getCategoryColor(
                              block.category
                            )}`}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="font-mono text-[8px] font-bold leading-none truncate">
                                {block.start_time}
                              </span>
                              <span className="text-[10px] font-semibold leading-tight truncate mt-0.5">
                                {block.title}
                              </span>
                            </div>

                            <div className="flex items-center justify-between mt-auto">
                              <span className="text-[7px] px-0.5 rounded font-mono border border-current/20 opacity-80 truncate">
                                {block.category}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteScheduleBlock(block.id);
                                }}
                                className="opacity-0 group-hover/block:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded transition-opacity"
                                title="Delete block"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
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
