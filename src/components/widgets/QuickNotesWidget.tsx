import React, { useState } from 'react';
import { Bookmark, Plus, X } from 'lucide-react';

export const QuickNotesWidget: React.FC = () => {
  const [pins, setPins] = useState<string[]>([
    'Review SQLite WAL mode checkpoint',
    'Verify zero scroll on Bento grid',
    'Obsidian text-first aesthetic',
  ]);
  const [newPin, setNewPin] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim()) return;
    setPins([newPin.trim(), ...pins]);
    setNewPin('');
  };

  const handleRemove = (index: number) => {
    setPins(pins.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface rounded border border-subtle p-2.5 select-none min-h-0 overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between pb-1.5 border-b border-subtle">
        <div className="flex items-center space-x-1.5">
          <Bookmark className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-tx-primary">
            Quick Notes
          </h2>
        </div>
        <span className="text-[10px] text-tx-muted font-mono">{pins.length} Pins</span>
      </div>

      <form onSubmit={handleAdd} className="flex-shrink-0 my-1">
        <div className="flex items-center space-x-1 p-0.5 rounded bg-canvas border border-subtle focus-within:border-accent">
          <input
            type="text"
            placeholder="Quick note..."
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            className="flex-1 px-1.5 py-0.5 bg-transparent text-[11px] text-tx-primary placeholder:text-tx-muted/50 focus:outline-none"
          />
          <button
            type="submit"
            className="p-1 rounded bg-accent text-white hover:opacity-90"
            title="Add note"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </form>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
        {pins.map((pin, i) => (
          <div
            key={i}
            className="group flex items-start justify-between p-1 rounded bg-canvas border border-subtle hover:border-tx-muted/30 transition-colors"
          >
            <span className="text-[10px] text-tx-primary leading-tight pr-1 truncate">
              • {pin}
            </span>
            <button
              onClick={() => handleRemove(i)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded flex-shrink-0"
              title="Remove"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
