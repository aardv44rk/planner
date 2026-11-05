import React, { useState, useEffect, useRef } from 'react';
import { FileEdit, Check, RefreshCw } from 'lucide-react';
import { useCommandCenterStore } from '../../stores/commandCenterStore';

export const ScratchpadWidget: React.FC = () => {
  const { dailyNote, saveDailyNote, selectedDate } = useCommandCenterStore();
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dailyNote) {
      setContent(dailyNote.content_md);
    } else {
      setContent('');
    }
  }, [dailyNote, selectedDate]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;

  return (
    <div className="flex flex-col h-full w-full bg-surface rounded border border-subtle p-2.5 select-none min-h-0 overflow-hidden">
      {/* Quiet Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-1 border-b border-subtle/50">
        <div className="flex items-center space-x-1.5">
          <FileEdit className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-tx-muted">
            Daily Scratchpad
          </h2>
          <span className="text-[10px] text-tx-muted font-mono">
            {selectedDate}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[9px] text-tx-muted font-mono">
            {words}w · {chars}c
          </span>
          <div className="flex items-center space-x-1 text-[9px] text-tx-muted">
            {saveStatus === 'saving' ? (
              <>
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-accent" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-2.5 h-2.5 text-emerald-500" />
                <span>Saved</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 min-h-0 mt-1.5 w-full overflow-hidden">
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="Jot down quick thoughts, markdown notes, code snippets, or daily plans..."
          className="w-full h-full p-2 rounded bg-canvas border border-subtle/70 resize-none overflow-hidden text-[11px] font-mono text-tx-primary leading-relaxed placeholder:text-tx-muted/40 focus:outline-none focus:border-accent"
          spellCheck={false}
        />
      </div>
    </div>
  );
};
