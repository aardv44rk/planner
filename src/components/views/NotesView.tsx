import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Bookmark,
  Calendar,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  Pin,
  Clock,
} from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';
import { useLayoutStore } from '../../stores/layoutStore';

export const NotesView: React.FC = () => {
  const {
    dailyNote,
    saveDailyNote,
    selectedDate,
    setSelectedDate,
    notesHistory,
  } = useCommandCenterStore();

  const { isWidgetPinned, toggleWidgetPin } = useLayoutStore();

  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quick notes pins
  const [pins, setPins] = useState<string[]>([
    'Review SQLite WAL mode checkpoint',
    'Verify zero scroll on Bento grid',
    'Obsidian text-first aesthetic',
  ]);
  const [newPin, setNewPin] = useState('');
  const [isAddingPin, setIsAddingPin] = useState(false);

  const isScratchpadPinned = isWidgetPinned('widget-scratchpad');
  const isQuickNotesPinned = isWidgetPinned('widget-quick-notes');

  useEffect(() => {
    if (dailyNote) {
      setContent(dailyNote.content_md);
    } else {
      setContent('');
    }
  }, [dailyNote, selectedDate]);

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    setSaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      await saveDailyNote(val);
      setSaveStatus('saved');
    }, 500);
  };

  const handleAddPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim()) return;
    setPins([newPin.trim(), ...pins]);
    setNewPin('');
    setIsAddingPin(false);
  };

  const handleRemovePin = (idx: number) => {
    setPins(pins.filter((_, i) => i !== idx));
  };

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="h-full w-full flex flex-col p-4 bg-surface rounded border border-subtle select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-3 border-b border-subtle/50">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-semibold tracking-tight text-tx-primary">
                Notes & Vault
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-elevated border border-subtle text-tx-muted font-mono">
                {selectedDate}
              </span>
            </div>
            <p className="text-[11px] text-tx-muted">
              Daily scratchpads, persistent vault markdown notes, and quick thought captures.
            </p>
          </div>
        </div>

        {/* Pin to Home Buttons & Auto-Save indicator */}
        <div className="flex items-center space-x-2">
          {/* Save Status Indicator */}
          <div className="flex items-center space-x-1.5 text-xs text-tx-muted px-2 py-1 rounded bg-canvas border border-subtle font-mono">
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-accent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span>Saved</span>
              </>
            )}
            <span className="text-subtle">·</span>
            <span>{words} words</span>
          </div>

          {/* Pin Scratchpad */}
          <button
            onClick={() => toggleWidgetPin('widget-scratchpad')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
              isScratchpadPinned
                ? 'bg-accent/10 border-accent/40 text-accent font-medium'
                : 'bg-surface border-subtle text-tx-muted hover:text-tx-primary hover:bg-elevated'
            }`}
            title="Toggle Scratchpad widget on Home dashboard"
          >
            {isScratchpadPinned ? (
              <>
                <Check className="w-3 h-3 text-accent" />
                <span>Scratchpad Pinned ✓</span>
              </>
            ) : (
              <>
                <Pin className="w-3 h-3" />
                <span>Pin Scratchpad to Home</span>
              </>
            )}
          </button>

          {/* Pin Quick Notes */}
          <button
            onClick={() => toggleWidgetPin('widget-quick-notes')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
              isQuickNotesPinned
                ? 'bg-accent/10 border-accent/40 text-accent font-medium'
                : 'bg-surface border-subtle text-tx-muted hover:text-tx-primary hover:bg-elevated'
            }`}
            title="Toggle Quick Notes widget on Home dashboard"
          >
            {isQuickNotesPinned ? (
              <>
                <Check className="w-3 h-3 text-accent" />
                <span>Quick Notes Pinned ✓</span>
              </>
            ) : (
              <>
                <Pin className="w-3 h-3" />
                <span>Pin Quick Notes to Home</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-4 mt-3 overflow-hidden">
        {/* Left Column: Date History Tree & Quick Jump (col-span-3) */}
        <div className="col-span-3 flex flex-col min-h-0 bg-canvas/60 rounded border border-subtle p-3 overflow-hidden">
          <div className="flex-shrink-0 flex items-center justify-between pb-2 border-b border-subtle/50">
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <h3 className="text-xs font-semibold text-tx-primary">Daily Notes History</h3>
            </div>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-subtle/70 text-tx-muted hover:text-accent font-mono transition-colors"
              title="Jump to Today's Note"
            >
              Today
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-2 space-y-1 pr-1">
            {notesHistory.length === 0 ? (
              <div className="text-xs text-tx-muted py-6 text-center">
                No archived notes yet. Start writing today!
              </div>
            ) : (
              notesHistory.map((dStr) => {
                const isSelected = dStr === selectedDate;
                const isTodayDate = dStr === todayStr;

                return (
                  <button
                    key={dStr}
                    onClick={() => setSelectedDate(dStr)}
                    className={`w-full text-left px-2.5 py-2 rounded text-xs transition-colors flex items-center justify-between border ${
                      isSelected
                        ? 'bg-accent text-white font-medium border-accent shadow-xs'
                        : 'bg-surface/50 border-subtle/40 text-tx-muted hover:text-tx-primary hover:bg-elevated'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3 h-3 opacity-60" />
                      <span className="font-mono text-xs">{dStr}</span>
                      {isTodayDate && (
                        <span
                          className={`text-[9px] px-1 rounded font-sans ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-accent/20 text-accent font-semibold'
                          }`}
                        >
                          Today
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Markdown Editor + Quick Notes (col-span-9) */}
        <div className="col-span-9 flex flex-col min-h-0 gap-3 overflow-hidden">
          {/* Markdown Editor (flex-1) */}
          <div className="flex-1 min-h-0 flex flex-col bg-canvas rounded border border-subtle overflow-hidden p-3">
            <div className="flex-shrink-0 flex items-center justify-between pb-2 border-b border-subtle/50 mb-2">
              <span className="text-xs font-semibold text-tx-primary">
                Daily Note — {selectedDate}
              </span>
              <span className="text-[10px] text-tx-muted font-mono">
                Markdown Supported · {chars} Characters
              </span>
            </div>

            <textarea
              value={content}
              onChange={handleEditorChange}
              placeholder="Start drafting daily thoughts, meeting notes, project specs, or tasks in Obsidian markdown format..."
              className="flex-1 w-full bg-transparent resize-none overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed text-tx-primary placeholder:text-tx-muted/40 focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Quick Notes / Bullet Scratch (Compact lower strip, height ~140px) */}
          <div className="h-36 flex-shrink-0 flex flex-col bg-canvas/60 rounded border border-subtle p-3 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between pb-1.5 border-b border-subtle/50">
              <div className="flex items-center space-x-1.5">
                <Bookmark className="w-3.5 h-3.5 text-accent" />
                <h4 className="text-xs font-semibold text-tx-primary">Quick Notes & Bookmarks</h4>
                <span className="text-[10px] text-tx-muted font-mono">({pins.length})</span>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsAddingPin(!isAddingPin)}
                  className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-surface border border-subtle text-tx-muted hover:text-tx-primary text-[10px]"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Note</span>
                </button>
              </div>
            </div>

            {isAddingPin && (
              <form onSubmit={handleAddPin} className="flex-shrink-0 my-1.5 flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder="Quick snippet or bullet item..."
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-surface border border-subtle text-xs text-tx-primary focus:outline-none focus:border-accent"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs rounded bg-accent text-white font-medium hover:opacity-90 shadow-xs"
                >
                  Save
                </button>
              </form>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-subtle/30 pr-1">
              {pins.map((pinText, idx) => (
                <div
                  key={idx}
                  className="group/pin flex items-center justify-between py-1.5 px-1 hover:bg-surface/80 rounded transition-colors"
                >
                  <span className="text-xs text-tx-primary truncate pr-2">
                    • {pinText}
                  </span>
                  <button
                    onClick={() => handleRemovePin(idx)}
                    className="opacity-0 group-hover/pin:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded transition-opacity"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
