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
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useLayoutStore, WIDGET_TITLES } from '../stores/layoutStore';
import { GridSlot } from '../types';
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
          Widget: {type}
        </div>
      );
  }
};

interface DraggableWidgetProps {
  widgetId: string;
  slot: GridSlot;
  isEditMode: boolean;
  onResizeSlot: (colSpan: number, rowSpan: number) => void;
  onUnpin: () => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
}

const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  widgetId,
  slot,
  isEditMode,
  onResizeSlot,
  onUnpin,
  gridRef,
}) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: widgetId,
  });

  const [resizing, setResizing] = useState(false);
  const [previewSize, setPreviewSize] = useState<{ colSpan: number; rowSpan: number } | null>(null);
  const resizeStartPos = useRef<{ x: number; y: number; startCol: number; startRow: number } | null>(null);
  const latestPreviewSize = useRef<{ colSpan: number; rowSpan: number } | null>(null);

  const title = WIDGET_TITLES[widgetId] || widgetId;

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      startCol: slot.colSpan,
      startRow: slot.rowSpan,
    };
    latestPreviewSize.current = { colSpan: slot.colSpan, rowSpan: slot.rowSpan };
    setPreviewSize({ colSpan: slot.colSpan, rowSpan: slot.rowSpan });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!resizeStartPos.current || !gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const colWidth = (rect.width - 11 * 14) / 12; // 12 columns with 14px gap
      const rowHeight = 180;

      const deltaX = moveEvent.clientX - resizeStartPos.current.x;
      const deltaY = moveEvent.clientY - resizeStartPos.current.y;

      const deltaCols = Math.round(deltaX / Math.max(20, colWidth));
      const deltaRows = Math.round(deltaY / rowHeight);

      const targetCol = Math.max(3, Math.min(12, resizeStartPos.current.startCol + deltaCols));
      const targetRow = Math.max(1, Math.min(8, resizeStartPos.current.startRow + deltaRows));

      latestPreviewSize.current = { colSpan: targetCol, rowSpan: targetRow };
      setPreviewSize({ colSpan: targetCol, rowSpan: targetRow });
    };

    const handlePointerUp = () => {
      setResizing(false);
      if (latestPreviewSize.current) {
        const { colSpan, rowSpan } = latestPreviewSize.current;
        if (colSpan !== slot.colSpan || rowSpan !== slot.rowSpan) {
          onResizeSlot(colSpan, rowSpan);
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

  return (
    <div
      ref={setNodeRef}
      className={`group relative w-full h-full flex flex-col overflow-hidden rounded bg-surface border border-subtle hover:border-tx-muted/40 transition-colors shadow-xs ${
        isEditMode ? 'ring-1 ring-accent/30' : ''
      } ${resizing ? 'ring-2 ring-accent select-none' : ''}`}
    >
      {/* Top Window Bar: Whole bar is draggable */}
      <div
        {...attributes}
        {...listeners}
        className="h-8 px-3 flex items-center justify-between border-b border-subtle/60 bg-surface select-none cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        {/* Left Side: 6-dot grip indicator on hover + widget title */}
        <div className="flex items-center space-x-1.5 min-w-0 pr-2 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-tx-muted/40 group-hover:text-accent transition-colors flex-shrink-0" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-tx-muted truncate">
            {title}
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
                    onResizeSlot(preset.w, slot.rowSpan);
                  }}
                  className={`px-1 py-0.2 text-[8px] font-mono rounded transition-colors ${
                    slot.colSpan === preset.w
                      ? 'bg-accent text-white font-bold'
                      : 'text-tx-muted hover:text-tx-primary hover:bg-elevated'
                  }`}
                  title={`Resize slot to ${preset.label} (${preset.w} columns)`}
                >
                  {preset.label}
                </button>
              ))}
              <span className="text-[8px] font-mono text-tx-muted ml-1 pl-1 border-l border-subtle/50">
                {slot.colSpan}x{slot.rowSpan}
              </span>
            </div>
          )}

          {/* Subtle unpin button only on card hover */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onUnpin();
            }}
            className="p-1 rounded text-tx-muted hover:text-red-500 hover:bg-elevated/80 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Unpin widget from this slot"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Concrete Widget Panel */}
      <div className="flex-1 w-full min-h-0 overflow-hidden bg-surface">
        {renderWidgetComponent(widgetId, slot.colSpan)}
      </div>

      {/* Resize Visual Preview Overlay */}
      {resizing && previewSize && (
        <div className="absolute inset-0 z-40 border-2 border-dashed border-accent bg-accent/5 rounded pointer-events-none flex flex-col items-center justify-center backdrop-blur-[1px]">
          <div className="px-2.5 py-1 rounded bg-surface shadow-lg text-xs font-mono font-semibold text-accent border border-accent/40 flex items-center space-x-1.5">
            <span>{previewSize.colSpan} cols × {previewSize.rowSpan} rows</span>
            <span className="text-[10px] text-tx-muted font-normal">({previewSize.rowSpan * 180}px height)</span>
          </div>
        </div>
      )}

      {/* Bottom-Right Interactive Corner Resizer */}
      <div
        onPointerDown={handleResizeStart}
        className={`absolute bottom-0 right-0 w-3.5 h-3.5 z-30 cursor-se-resize flex items-end justify-end p-0.5 transition-opacity ${
          isEditMode || resizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 hover:opacity-100'
        }`}
        title="Drag corner to resize slot"
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-tx-muted/60 hover:border-accent" />
      </div>
    </div>
  );
};

interface DroppableSlotProps {
  slot: GridSlot;
  isEditMode: boolean;
  activeWidgetId: string | null;
  onResizeSlot: (slotId: string, colSpan: number, rowSpan: number) => void;
  onUnpinWidget: (widgetId: string) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
}

const DroppableSlot: React.FC<DroppableSlotProps> = ({
  slot,
  isEditMode,
  activeWidgetId,
  onResizeSlot,
  onUnpinWidget,
  gridRef,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: slot.id,
  });

  const slotStyle: React.CSSProperties = {
    gridColumn: `span ${slot.colSpan}`,
    gridRow: `span ${slot.rowSpan}`,
  };

  const isCurrentActive = slot.widgetId !== null && slot.widgetId === activeWidgetId;

  return (
    <div
      ref={setNodeRef}
      style={slotStyle}
      className={`relative w-full h-full min-h-[180px] min-w-0 transition-all duration-150 rounded ${
        isOver
          ? 'ring-2 ring-accent border-2 border-dashed border-accent bg-accent/10 shadow-md'
          : isCurrentActive
          ? 'border border-dashed border-accent/60 bg-accent/5'
          : ''
      }`}
    >
      {slot.widgetId ? (
        isCurrentActive ? (
          // Source slot placeholder while item is actively dragged
          <div className="w-full h-full flex flex-col items-center justify-center p-3 select-none rounded border border-dashed border-accent/60 bg-accent/5">
            <span className="text-[11px] text-accent/80 font-mono tracking-wider uppercase font-semibold">
              {WIDGET_TITLES[slot.widgetId] || slot.widgetId}
            </span>
            <span className="text-[10px] text-tx-muted mt-1 font-mono">
              Moving from this slot...
            </span>
          </div>
        ) : (
          <DraggableWidget
            widgetId={slot.widgetId}
            slot={slot}
            isEditMode={isEditMode}
            onResizeSlot={(w, h) => onResizeSlot(slot.id, w, h)}
            onUnpin={() => onUnpinWidget(slot.widgetId!)}
            gridRef={gridRef}
          />
        )
      ) : (
        // Empty slot drop target
        <div
          className={`w-full h-full rounded border border-dashed flex flex-col items-center justify-center p-4 text-center transition-colors select-none ${
            isOver
              ? 'border-accent bg-accent/15 ring-1 ring-accent'
              : 'border-subtle/70 bg-surface/30 hover:border-accent/40'
          }`}
        >
          <span className="text-xs font-medium text-tx-muted">Empty Grid Slot</span>
          <span className="text-[10px] text-tx-muted/70 font-mono mt-0.5">
            {slot.colSpan} cols × {slot.rowSpan} rows
          </span>
          <span className="text-[9px] text-accent mt-1">Drop widget here to place</span>
        </div>
      )}
    </div>
  );
};

export const BentoGrid: React.FC = () => {
  const {
    slots,
    isEditMode,
    swapWidgetSlots,
    resizeSlot,
    setWidgetPin,
    resetLayout,
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
    if (over) {
      // active.id is the dragged widgetId, over.id is the target slot.id
      swapWidgetSlots(active.id as string, over.id as string);
    }
    setActiveDragId(null);
    setDragDimensions(null);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setDragDimensions(null);
  };

  // Find slot of currently dragged widget for overlay aspect
  const activeSlot = activeDragId ? slots.find((s) => s.widgetId === activeDragId) : null;
  const hasAnyPinned = slots.some((s) => s.widgetId !== null);

  if (!hasAnyPinned) {
    return (
      <div className="w-full py-16 px-4 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-surface border border-subtle flex items-center justify-center text-tx-muted mb-3">
          <LayoutGrid className="w-6 h-6 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-semibold text-tx-primary mb-1">
          No Widgets Pinned to Home
        </h3>
        <p className="text-xs text-tx-muted max-w-sm mb-4">
          Pin widgets from the domain tabs or click "+ Add Widget" in the top bar to populate your grid slots.
        </p>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setWidgetPin('kpi_strip', true);
              setWidgetPin('schedule', true);
              setWidgetPin('tasks', true);
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
            <span>Reset Layout</span>
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
      <div className="w-full flex flex-col">
        {/* Stationary 12-Column CSS Grid Slots Container */}
        <div
          ref={gridContainerRef}
          className="w-full grid grid-cols-12 gap-3.5"
          style={{ gridAutoRows: 'minmax(180px, auto)', alignContent: 'start' }}
        >
          {slots.map((slot) => (
            <DroppableSlot
              key={slot.id}
              slot={slot}
              isEditMode={isEditMode}
              activeWidgetId={activeDragId}
              onResizeSlot={(slotId, col, row) => resizeSlot(slotId, col, row)}
              onUnpinWidget={(widgetId) => setWidgetPin(widgetId, false)}
              gridRef={gridContainerRef}
            />
          ))}
        </div>
      </div>

      {/* Floating DragOverlay: elevated clone of active widget */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeDragId ? (
          <div
            style={{
              width: dragDimensions ? `${dragDimensions.width}px` : undefined,
              height: dragDimensions ? `${dragDimensions.height}px` : undefined,
            }}
            className="opacity-90 scale-[1.01] shadow-2xl ring-1 ring-accent bg-surface rounded border border-subtle overflow-hidden pointer-events-none cursor-grabbing flex flex-col"
          >
            {/* Top Bar Preview */}
            <div className="h-8 px-3 flex items-center justify-between border-b border-subtle/60 bg-surface select-none">
              <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                <GripVertical className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-tx-muted truncate">
                  {WIDGET_TITLES[activeDragId] || activeDragId}
                </span>
              </div>
              <span className="text-[9px] font-mono text-accent">Moving</span>
            </div>

            {/* Widget Content Preview */}
            <div className="flex-1 w-full min-h-0 overflow-hidden bg-surface">
              {renderWidgetComponent(activeDragId, activeSlot?.colSpan)}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
