import React, { useRef, useState } from 'react';
import {
  DndContext,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

const renderWidgetComponent = (type: string, colSpan?: number) => {
  switch (type) {
    case 'kpi_strip':
      return <MetricStrip colSpan={colSpan} />;
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const [resizing, setResizing] = useState(false);
  const [previewSize, setPreviewSize] = useState<{ w: number; h: number } | null>(null);
  const resizeStartPos = useRef<{ x: number; y: number; startW: number; startH: number } | null>(null);
  const latestPreviewSize = useRef<{ w: number; h: number } | null>(null);

  const clampedColSpan = Math.max(1, Math.min(widget.w, 12));

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

  const cardStyle: React.CSSProperties = {
    gridColumn: `span ${clampedColSpan}`,
    gridRow: `span ${widget.h}`,
    transform: resizing ? undefined : CSS.Translate.toString(transform),
    transition,
  };

  // Original slot in grid when item is being dragged
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={cardStyle}
        className="h-full w-full min-h-[180px] rounded border border-dashed border-accent/60 bg-accent/5 flex flex-col items-center justify-center transition-all p-3 select-none"
      >
        <span className="text-[11px] text-accent/80 font-mono tracking-wider uppercase font-semibold">
          {widget.title}
        </span>
        <span className="text-[10px] text-tx-muted mt-1 font-mono">
          Drop to reposition
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      className={`group relative h-full w-full min-h-[180px] min-w-0 flex flex-col overflow-hidden rounded bg-surface border border-subtle hover:border-tx-muted/40 transition-colors shadow-xs ${
        isEditMode ? 'ring-1 ring-accent/30' : ''
      } ${resizing ? 'ring-2 ring-accent select-none' : ''}`}
    >
      {/* Unified Minimalist Top Window Bar (Entire bar acts as Drag Handle) */}
      <div
        {...attributes}
        {...listeners}
        className="h-8 px-3 flex items-center justify-between border-b border-subtle/60 bg-surface select-none cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        {/* Left Side: 6-dot grip indicator on hover + widget title */}
        <div className="flex items-center space-x-1.5 min-w-0 pr-2 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-tx-muted/40 group-hover:text-accent transition-colors flex-shrink-0" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-tx-muted truncate">
            {widget.title}
          </span>
        </div>

        {/* Right Side: Interactive actions & close button (stops drag propagation) */}
        <div
          className="flex items-center space-x-1.5 flex-shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isEditMode && (
            <div className="flex items-center space-x-0.5 bg-canvas/80 border border-subtle/60 rounded px-1 py-0.5">
              {([
                { label: 'S', w: 3 },
                { label: 'M', w: 4 },
                { label: 'L', w: 6 },
                { label: 'Full', w: 12 },
              ] as const).map((preset) => (
                <button
                  key={preset.label}
                  onPointerDown={(e) => e.stopPropagation()}
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
              <span className="text-[8px] font-mono text-tx-muted ml-1 pl-1 border-l border-subtle/50">
                {widget.w}x{widget.h}
              </span>
            </div>
          )}

          {/* Subtle unpin button only visible on card hover */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onHide();
            }}
            className="p-1 rounded text-tx-muted hover:text-red-500 hover:bg-elevated/80 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Unpin widget from Home dashboard"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Concrete Widget Content Panel */}
      <div className="flex-1 w-full min-h-0 overflow-hidden bg-surface">
        {renderWidgetComponent(widget.type, clampedColSpan)}
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
    reorderWidgets,
    resizeWidget,
    toggleWidgetPin,
    resetLayout,
    setWidgetPin,
  } = useLayoutStore();

  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragDimensions, setDragDimensions] = useState<{ width: number; height: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    const rect = event.active.rect.current.initial;
    if (rect) {
      setDragDimensions({ width: rect.width, height: rect.height });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderWidgets(active.id as string, over.id as string);
    }
    setActiveDragId(null);
    setDragDimensions(null);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setDragDimensions(null);
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
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-accent text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-xs"
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
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={visibleWidgets.map((w) => w.id)}
        strategy={rectSortingStrategy}
      >
        <div className="w-full flex flex-col">
          {/* Proportional 12-Column CSS Bento Grid */}
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
      </SortableContext>

      {/* Clean DragOverlay: renders dragged widget at opacity-90 scale-[1.01] shadow-lg ring-1 ring-accent */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeDraggedWidget ? (
          <div
            style={{
              width: dragDimensions ? `${dragDimensions.width}px` : undefined,
              height: dragDimensions ? `${dragDimensions.height}px` : undefined,
            }}
            className="opacity-90 scale-[1.01] shadow-lg ring-1 ring-accent bg-surface rounded border border-subtle overflow-hidden pointer-events-none cursor-grabbing flex flex-col"
          >
            {/* Window Top Bar Preview */}
            <div className="h-8 px-3 flex items-center justify-between border-b border-subtle/60 bg-surface select-none">
              <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                <GripVertical className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-tx-muted truncate">
                  {activeDraggedWidget.title}
                </span>
              </div>
              <span className="text-[9px] font-mono text-accent">Moving</span>
            </div>

            {/* Content Preview */}
            <div className="flex-1 w-full min-h-0 overflow-hidden bg-surface">
              {renderWidgetComponent(activeDraggedWidget.type, activeDraggedWidget.w)}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
