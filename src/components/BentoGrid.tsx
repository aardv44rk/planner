import React from 'react';
import { useLayoutStore } from '../stores/layoutStore';
import { WidgetConfig } from '../types';
import { MetricStrip } from './widgets/MetricStrip';
import { ScheduleWidget } from './widgets/ScheduleWidget';
import { TasksWidget } from './widgets/TasksWidget';
import { ProjectsWidget } from './widgets/ProjectsWidget';
import { ScratchpadWidget } from './widgets/ScratchpadWidget';
import { TimeAllocationWidget } from './widgets/TimeAllocationWidget';
import { HabitMatrixWidget } from './widgets/HabitMatrixWidget';
import { QuickNotesWidget } from './widgets/QuickNotesWidget';
import {
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  EyeOff,
  Move,
  X,
} from 'lucide-react';

const renderWidgetComponent = (type: string) => {
  switch (type) {
    case 'kpi_strip':
      return <MetricStrip />;
    case 'schedule':
      return <ScheduleWidget />;
    case 'tasks':
      return <TasksWidget />;
    case 'projects':
      return <ProjectsWidget />;
    case 'scratchpad':
      return <ScratchpadWidget />;
    case 'time_allocation':
      return <TimeAllocationWidget />;
    case 'habit_matrix':
      return <HabitMatrixWidget />;
    case 'quick_notes':
      return <QuickNotesWidget />;
    default:
      return (
        <div className="p-4 text-xs text-tx-muted">
          Widget type: {type}
        </div>
      );
  }
};

export const BentoGrid: React.FC = () => {
  const {
    layout,
    isEditMode,
    selectedWidgetId,
    setSelectedWidgetId,
    toggleEditMode,
    swapWidgets,
    updateWidgetPosition,
    toggleWidgetVisibility,
  } = useLayoutStore();

  if (!layout) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-xs text-tx-muted animate-pulse">
          Loading Bento dashboard layout...
        </div>
      </div>
    );
  }

  const handleWidgetClick = (id: string) => {
    if (!isEditMode) return;

    if (!selectedWidgetId) {
      setSelectedWidgetId(id);
    } else if (selectedWidgetId === id) {
      setSelectedWidgetId(null);
    } else {
      swapWidgets(selectedWidgetId, id);
    }
  };

  const handleSpanChange = (
    widget: WidgetConfig,
    deltaW: number,
    deltaH: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const newW = Math.max(1, Math.min(12, widget.w + deltaW));
    const newH = Math.max(1, Math.min(4, widget.h + deltaH));
    updateWidgetPosition(widget.id, { w: newW, h: newH });
  };

  const visibleWidgets = layout.widgets.filter((w) => w.visible !== false);

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden flex flex-col">
      {/* Edit Mode Floating Notification */}
      {isEditMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-surface/95 border border-accent/60 shadow-lg backdrop-blur flex items-center space-x-3 text-xs text-tx-primary animate-fade-in">
          <div className="flex items-center space-x-1.5">
            <Move className="w-3.5 h-3.5 text-accent animate-bounce" />
            <span className="font-medium text-[11px]">
              Edit Mode: Click any 2 widgets to swap positions
            </span>
          </div>
          {selectedWidgetId && (
            <span className="text-[10px] font-mono text-accent bg-accent/15 px-2 py-0.5 rounded border border-accent/30">
              Selected: {layout.widgets.find((w) => w.id === selectedWidgetId)?.title}
            </span>
          )}
          <button
            onClick={toggleEditMode}
            className="p-1 rounded-full hover:bg-elevated text-tx-muted hover:text-tx-primary"
            title="Close edit mode"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 100% Viewport-Filled 12-Column CSS Bento Grid */}
      <div
        className="w-full h-full min-h-0 grid gap-2.5 overflow-hidden"
        style={{
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gridTemplateRows: 'minmax(64px, 72px) minmax(0, 1.25fr) minmax(0, 1.25fr) minmax(0, 1fr)',
        }}
      >
        {visibleWidgets.map((widget) => {
          const isSelected = selectedWidgetId === widget.id;

          const gridStyle: React.CSSProperties = {
            gridColumn: `${widget.x + 1} / span ${Math.min(widget.w, 12)}`,
            gridRow: `${widget.y + 1} / span ${widget.h}`,
          };

          return (
            <div
              key={widget.id}
              onClick={() => handleWidgetClick(widget.id)}
              style={gridStyle}
              className={`relative transition-all duration-150 h-full w-full min-h-0 min-w-0 flex flex-col overflow-hidden ${
                isEditMode
                  ? 'cursor-pointer hover:ring-2 hover:ring-accent/50 rounded'
                  : ''
              } ${
                isSelected
                  ? 'ring-2 ring-accent shadow-md rounded'
                  : ''
              }`}
            >
              {/* Edit Mode Overlay Controls */}
              {isEditMode && (
                <div className="absolute top-1.5 right-1.5 z-30 flex items-center space-x-1 p-0.5 rounded bg-surface/95 border border-subtle backdrop-blur shadow-sm text-tx-muted">
                  <span className="text-[9px] font-mono px-1">
                    {widget.w}x{widget.h}
                  </span>

                  <button
                    onClick={(e) => handleSpanChange(widget, -1, 0, e)}
                    disabled={widget.w <= 2}
                    className="p-0.5 rounded hover:bg-elevated hover:text-tx-primary disabled:opacity-30"
                    title="Narrower"
                  >
                    <Minimize2 className="w-2.5 h-2.5" />
                  </button>

                  <button
                    onClick={(e) => handleSpanChange(widget, 1, 0, e)}
                    disabled={widget.w >= 12}
                    className="p-0.5 rounded hover:bg-elevated hover:text-tx-primary disabled:opacity-30"
                    title="Wider"
                  >
                    <Maximize2 className="w-2.5 h-2.5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWidgetClick(widget.id);
                    }}
                    className={`p-0.5 rounded hover:bg-elevated ${
                      isSelected ? 'text-accent' : 'hover:text-tx-primary'
                    }`}
                    title="Swap with another widget"
                  >
                    <ArrowLeftRight className="w-2.5 h-2.5" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWidgetVisibility(widget.id);
                    }}
                    className="p-0.5 rounded hover:bg-elevated hover:text-red-500"
                    title="Hide widget"
                  >
                    <EyeOff className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {/* Concrete Widget Content */}
              <div className="flex-1 w-full h-full min-h-0 overflow-hidden">
                {renderWidgetComponent(widget.type)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
