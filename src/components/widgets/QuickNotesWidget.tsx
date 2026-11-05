import React, { useState } from 'react';
import { Bookmark, Plus, X } from 'lucide-react';

export const QuickNotesWidget: React.FC = () => {
  const [pins, setPins] = useState<string[]>([
    'Review SQLite WAL mode checkpoint',
    'Verify zero scroll on Bento grid',
    'Obsidian text-first aesthetic',
  ]);
  const [newPin, setNewPin] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim()) return;
    setPins([newPin.trim(), ...pins]);
    setNewPin('');
    setIsAdding(false);
  };

  const handleRemove = (index: number) => {
    setPins(pins.filter((_, i) => i !== index));
  };

  return (
    <div className="group flex flex-col h-full w-full bg-surface rounded border border-subtle p-2.5 select-none min-h-0 overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between pb-1 border-b border-subtle/50">
        <div className="flex items-center space-x-1.5">
          <Bookmark className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-tx-muted">
            Quick Notes
          </h2>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-[9px] text-tx-muted font-mono mr-1">{pins.length}</span>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="p-0.5 rounded text-tx-muted hover:text-tx-primary hover:bg-elevated opacity-0 group-hover:opacity-100 transition-opacity"
            title="Add Pin"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="flex-shrink-0 my-1 flex items-center space-x-1">
          <input
            type="text"
            placeholder="Quick note..."
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
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

      <div className="flex-1 min-h-0 overflow-hidden divide-y divide-subtle/30 mt-1 pr-0.5">
        {pins.map((pin, i) => (
          <div
            key={i}
            className="group/item flex items-center justify-between py-1.5 px-1 hover:bg-elevated/40 rounded transition-colors"
          >
            <span className="text-[11px] text-tx-primary leading-tight pr-1 truncate">
              • {pin}
            </span>
            <button
              onClick={() => handleRemove(i)}
              className="opacity-0 group-hover/item:opacity-100 p-0.5 text-tx-muted hover:text-red-500 rounded flex-shrink-0"
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
