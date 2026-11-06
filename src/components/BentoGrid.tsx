import React, { useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragOverlay,
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
  LayoutGrid,
  Plus,
  RotateCcw,
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
  onHide: () => void;
  onResize: (w: number, h: number) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
}

const BentoWidgetCard: React.FC<BentoWidgetCardProps> = ({
  widget,
  isEditMode,
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
  const [previewSize, setPreviewSize] = useState<{ w: number; h: number } | null>(null);
  const resizeStartPos = useRef<{ x: number; y: number; startW: number; startH: number } | null>(null);
  const latestPreviewSize = useRef<{ w: number; h: number } | null>(null);

  const clampedX = Math.max(0, Math.min(widget.x, 11));
  const clampedColSpan = Math.max(1, Math.min(widget.w, 12 - clampedX));

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startW: widget.w,
      startH: widget.h,
    };
    latestPreviewSize.current = { w: widget.w, h: widget.h };
    setPreviewSize({ w: widget.w, h: widget.h });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!resizeStartPos.current || !gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const colWidth = (rect.width - 11 * 14) / 12; // 12-column grid with 14px gap
      const rowHeight = 180; // row unit

      const deltaX = moveEvent.clientX - resizeStartPos.current.x;
      const deltaY = moveEvent.clientY - resizeStartPos.current.y;

      const deltaCols = Math.round(deltaX / Math.max(20, colWidth));
      const deltaRows = Math.round(deltaY / rowHeight);

      const targetW = Math.max(3, Math.min(12, resizeStartPos.current.startW + deltaCols));
      const targetH = Math.max(1, Math.min(8, resizeStartPos.current.startH + deltaRows));

      latestPreviewSize.current = { w: targetW, h: targetH };
      setPreviewSize({ w: targetW, h: targetH });
    };

    const handlePointerUp = () => {
      setResizing(false);
      if (latestPreviewSize.current) {
        const { w, h } = latestPreviewSize.current;
        if (w !== widget.w || h !== widget.h) {
          onResize(w, h);
        }
      }
      setPreviewSize(null);
      latestPreviewSize.current = null;
      resizeStartPos.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const gridStyle: React.CSSProperties = {
    gridColumn: `${clampedX + 1} / span ${clampedColSpan}`,
    gridRow: `${widget.y + 1} / span ${widget.h}`,
  };

  // When dragging, render clean 1px dashed var(--accent) drop placeholder
  if (isDragging) {
    return (
      <div
        ref={setDropRef}
        style={gridStyle}
        className="h-full w-full min-h-[180px] rounded border border-dashed border-accent bg-accent/5 flex flex-col items-center justify-center transition-all p-3 select-none"
      >
        <span className="text-[11px] text-accent/80 font-mono tracking-wider uppercase font-semibold">
          {widget.title}
        </span>
        <span className="text-[10px] text-tx-muted mt-1 font-mono">
          Moving card...
        </span>
      </div>
    );
  }

  return (
    <div
      ref={(node) => {
        setDropRef(node);
      }}
      style={gridStyle}
      className={`group relative h-full w-full min-h-[180px] min-w-0 flex flex-col overflow-hidden transition-all duration-150 rounded ${
        isOver
          ? 'ring-2 ring-accent border border-dashed border-accent bg-accent/5'
          : ''
      } ${
        isEditMode
          ? 'hover:ring-1 hover:ring-accent/40'
          : ''
      } ${resizing ? 'ring-2 ring-accent select-none' : ''}`}
    >
      {/* Top Header Drag Handle Bar (Subtle grip & quick unpin / size controls) */}
      <div
        className={`absolute top-1.5 left-2 right-2 z-20 flex items-center justify-between pointer-events-none transition-opacity ${
          isEditMode ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-auto'
        }`}
      >
        {/* Drag Handle Grip */}
        <div
          ref={setDragRef}
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-elevated/80 text-tx-muted hover:text-tx-primary backdrop-blur bg-surface/85 border border-subtle/60 shadow-xs transition-colors"
          title="Drag to reorder on grid"
        >
          <GripVertical className="w-3 h-3" />
        </div>

        {/* Quick controls: Size presets, Size info and Unpin button */}
        <div className="flex items-center space-x-1">
          {isEditMode && (
            <div className="flex items-center space-x-0.5 bg-surface/90 border border-subtle/60 rounded px-1 py-0.5 shadow-xs">
              {([
                { label: 'S', w: 3 },
                { label: 'M', w: 4 },
                { label: 'L', w: 6 },
                { label: 'Full', w: 12 },
              ] as const).map((preset) => (
                <button
                  key={preset.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    onResize(preset.w, widget.h);
                  }}
                  className={`px-1 py-0.2 text-[8px] font-mono rounded transition-colors ${
                    widget.w === preset.w
                      ? 'bg-accent text-white font-bold'
                      : 'text-tx-muted hover:text-tx-primary hover:bg-elevated'
                  }`}
                  title={`Resize to ${preset.label} (${preset.w} columns)`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {isEditMode && (
            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-surface/90 text-tx-muted border border-subtle/50">
              {widget.w}x{widget.h}
            </span>
          )}

          <button
            onClick={onHide}
            className="p-1 rounded hover:bg-elevated text-tx-muted hover:text-red-500 backdrop-blur bg-surface/85 border border-subtle/60 shadow-xs transition-colors"
            title="Unpin widget from Home screen"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Concrete Widget Panel */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden">
        {renderWidgetComponent(widget.type)}
      </div>

      {/* Resize Visual Preview Overlay */}
      {resizing && previewSize && (
        <div className="absolute inset-0 z-40 border-2 border-dashed border-accent bg-accent/5 rounded pointer-events-none flex flex-col items-center justify-center backdrop-blur-[1px]">
          <div className="px-2.5 py-1 rounded bg-surface shadow-lg text-xs font-mono font-semibold text-accent border border-accent/40 flex items-center space-x-1.5">
            <span>{previewSize.w} cols × {previewSize.h} rows</span>
            <span className="text-[10px] text-tx-muted font-normal">({previewSize.h * 180}px height)</span>
          </div>
        </div>
      )}

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
    isEditMode,
    swapWidgets,
    resizeWidget,
    toggleWidgetPin,
    resetLayout,
    setWidgetPin,
  } = useLayoutStore();

  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const lastOverId = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && over.id !== lastOverId.current) {
      lastOverId.current = over.id as string;
      swapWidgets(active.id as string, over.id as string);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      swapWidgets(active.id as string, over.id as string);
    }
    setActiveDragId(null);
    lastOverId.current = null;
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    lastOverId.current = null;
  };

  if (!layout) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <div className="text-xs text-tx-muted animate-pulse">
          Loading Home dashboard...
        </div>
      </div>
    );
  }

  // Strictly filter by w.visible so only pinned widgets appear on Home
  const visibleWidgets = layout.widgets.filter((w) => w.visible !== false);
  const activeDraggedWidget = activeDragId
    ? layout.widgets.find((w) => w.id === activeDragId)
    : null;

  if (visibleWidgets.length === 0) {
    return (
      <div className="w-full py-16 px-4 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-surface border border-subtle flex items-center justify-center text-tx-muted mb-3">
          <LayoutGrid className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-semibold text-tx-primary mb-1">
          No Widgets Pinned to Home
        </h3>
        <p className="text-xs text-tx-muted max-w-sm mb-4">
          Pin widgets from the domain tabs or click "+ Add Widget" in the top bar to customize your dashboard.
        </p>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setWidgetPin('widget-kpis', true);
              setWidgetPin('widget-schedule', true);
              setWidgetPin('widget-tasks', true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-accent text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Pin Standard Widgets</span>
          </button>
          <button
            onClick={() => resetLayout()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-surface border border-subtle text-tx-muted hover:text-tx-primary text-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="w-full flex flex-col">
        {/* Proportional 12-Column CSS Bento Grid with minmax(180px, auto) rows */}
        <div
          ref={gridContainerRef}
          className="w-full grid grid-cols-12 gap-3.5"
          style={{ gridAutoRows: 'minmax(180px, auto)', alignContent: 'start' }}
        >
          {visibleWidgets.map((widget) => (
            <BentoWidgetCard
              key={widget.id}
              widget={widget}
              isEditMode={isEditMode}
              onHide={() => toggleWidgetPin(widget.id)}
              onResize={(w, h) => resizeWidget(widget.id, w, h)}
              gridRef={gridContainerRef}
            />
          ))}
        </div>
      </div>

      {/* Floating elevated drag preview */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeDraggedWidget ? (
          <div className="w-full h-full scale-[1.02] shadow-2xl ring-1 ring-accent/60 opacity-95 bg-surface rounded border border-subtle overflow-hidden pointer-events-none cursor-grabbing">
            {renderWidgetComponent(activeDraggedWidget.type)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
