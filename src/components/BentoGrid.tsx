import React, { useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
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
  GripVertical,
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

interface BentoWidgetCardProps {
  widget: WidgetConfig;
  isEditMode: boolean;
  totalRows: number;
  onHide: () => void;
  onResize: (w: number, h: number) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
}

const BentoWidgetCard: React.FC<BentoWidgetCardProps> = ({
  widget,
  isEditMode,
  totalRows,
  onHide,
  onResize,
  gridRef,
}) => {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: widget.id,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: widget.id,
  });

  const [resizing, setResizing] = useState(false);
  const resizeStartPos = useRef<{ x: number; y: number; startW: number; startH: number } | null>(null);

  const clampedX = Math.max(0, Math.min(widget.x, 11));
  const clampedColSpan = Math.max(1, Math.min(widget.w, 12 - clampedX));

  const clampedY = Math.max(0, Math.min(widget.y, totalRows - 1));
  const clampedRowSpan = Math.max(1, Math.min(widget.h, totalRows - clampedY));

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startW: clampedColSpan,
      startH: clampedRowSpan,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!resizeStartPos.current || !gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const colWidth = rect.width / 12;
      const rowHeight = rect.height / totalRows;

      const deltaX = moveEvent.clientX - resizeStartPos.current.x;
      const deltaY = moveEvent.clientY - resizeStartPos.current.y;

      const deltaCols = Math.round(deltaX / colWidth);
      const deltaRows = Math.round(deltaY / rowHeight);

      const targetW = Math.max(3, Math.min(12 - clampedX, resizeStartPos.current.startW + deltaCols));
      const targetH = Math.max(1, Math.min(totalRows - clampedY, resizeStartPos.current.startH + deltaRows));

      if (targetW !== widget.w || targetH !== widget.h) {
        onResize(targetW, targetH);
      }
    };

    const handlePointerUp = () => {
      setResizing(false);
      resizeStartPos.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const gridStyle: React.CSSProperties = {
    gridColumn: `${clampedX + 1} / span ${clampedColSpan}`,
    gridRow: `${clampedY + 1} / span ${clampedRowSpan}`,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={(node) => {
        setDropRef(node);
      }}
      style={gridStyle}
      className={`group relative h-full w-full min-h-0 min-w-0 flex flex-col overflow-hidden transition-all duration-150 rounded ${
        isOver
          ? 'ring-2 ring-accent border-2 border-dashed border-accent bg-accent/5'
          : ''
      } ${
        isEditMode
          ? 'hover:ring-1 hover:ring-accent/40'
          : ''
      } ${resizing ? 'ring-2 ring-accent select-none' : ''}`}
    >
      {/* Top Header Drag Handle Bar (Subtle 6-dot grip & quick actions) */}
      <div
        className={`absolute top-1 left-2 right-2 z-20 flex items-center justify-between pointer-events-none transition-opacity ${
          isEditMode ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-auto'
        }`}
      >
        {/* Drag Handle Grip */}
        <div
          ref={setDragRef}
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-elevated/80 text-tx-muted hover:text-tx-primary backdrop-blur bg-surface/70 border border-subtle/50 transition-colors"
          title="Drag to reorder on grid"
        >
          <GripVertical className="w-3 h-3" />
        </div>

        {/* Quick controls: Size info and Hide Button */}
        <div className="flex items-center space-x-1">
          {isEditMode && (
            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-surface/90 text-tx-muted border border-subtle/50">
              {widget.w}x{widget.h}
            </span>
          )}

          <button
            onClick={onHide}
            className="p-1 rounded hover:bg-elevated text-tx-muted hover:text-red-500 backdrop-blur bg-surface/70 border border-subtle/50 transition-colors"
            title="Hide widget from dashboard"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Concrete Widget Panel */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden">
        {renderWidgetComponent(widget.type)}
      </div>

      {/* Bottom-Right Interactive Corner Resizer */}
      <div
        onPointerDown={handleResizeStart}
        className={`absolute bottom-0 right-0 w-3.5 h-3.5 z-30 cursor-se-resize flex items-end justify-end p-0.5 transition-opacity ${
          isEditMode || resizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:opacity-100'
        }`}
        title="Drag corner to resize widget"
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-tx-muted/60 hover:border-accent" />
      </div>
    </div>
  );
};

export const BentoGrid: React.FC = () => {
  const {
    layout,
    activeWorkspace,
    isEditMode,
    swapWidgets,
    resizeWidget,
    toggleWidgetVisibility,
  } = useLayoutStore();

  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      swapWidgets(active.id as string, over.id as string);
    }
  };

  if (!layout) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-xs text-tx-muted animate-pulse">
          Loading Bento dashboard layout...
        </div>
      </div>
    );
  }

  const visibleWidgets = layout.widgets.filter((w) => w.visible !== false);

  const totalRows =
    activeWorkspace === 'focus' ? 2 : activeWorkspace === 'analytics' ? 3 : 4;

  const gridRows =
    activeWorkspace === 'focus'
      ? '64px minmax(0, 1fr)'
      : activeWorkspace === 'analytics'
      ? '64px minmax(0, 1fr) minmax(0, 1fr)'
      : '64px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="relative w-full h-full min-h-0 overflow-hidden flex flex-col">
        {/* 100% Viewport-Filled 12-Column CSS Bento Grid */}
        <div
          ref={gridContainerRef}
          className="w-full h-full min-h-0 grid gap-2.5 overflow-hidden"
          style={{
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gridTemplateRows: gridRows,
          }}
        >
          {visibleWidgets.map((widget) => (
            <BentoWidgetCard
              key={widget.id}
              widget={widget}
              isEditMode={isEditMode}
              totalRows={totalRows}
              onHide={() => toggleWidgetVisibility(widget.id)}
              onResize={(w, h) => resizeWidget(widget.id, w, h)}
              gridRef={gridContainerRef}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
};
