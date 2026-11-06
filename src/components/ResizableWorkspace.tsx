import type { ReactNode, Ref } from 'react';
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  type PanelImperativeHandle,
} from 'react-resizable-panels';
import './resizable-workspace.css';

export interface ResizableWorkspaceProps {
  id: string;
  enabled?: boolean;
  children: [ReactNode, ReactNode];
  firstSize?: number | string;
  secondSize?: number | string;
  firstMin?: number | string;
  secondMin?: number | string;
  firstMax?: number | string;
  secondMax?: number | string;
  firstCollapsible?: boolean;
  firstPanelRef?: Ref<PanelImperativeHandle | null>;
  onFirstCollapse?: (collapsed: boolean) => void;
}

export function ResizableWorkspace({
  id,
  enabled = true,
  children,
  firstSize = '35%',
  secondSize = '65%',
  firstMin = '20%',
  secondMin = '30%',
  firstMax = '65%',
  secondMax,
  firstCollapsible = false,
  firstPanelRef,
  onFirstCollapse,
}: ResizableWorkspaceProps) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `workspace:${id}`,
    onlySaveAfterUserInteractions: !firstCollapsible,
  });

  return (
    <Group
      id={`workspace-${id}`}
      className="splitWorkspace"
      data-resizable={enabled}
      disabled={!enabled}
      disableCursor
      defaultLayout={defaultLayout}
      onLayoutChange={
        firstCollapsible
          ? (layout) => onFirstCollapse?.(layout[`${id}-first`] === 0)
          : undefined
      }
      onLayoutChanged={(layout, meta) => {
        if (enabled) onLayoutChanged(layout, meta);
      }}
    >
      <Panel
        id={`${id}-first`}
        className="splitPane"
        defaultSize={firstSize}
        groupResizeBehavior={
          typeof firstSize === 'number'
            ? 'preserve-pixel-size'
            : 'preserve-relative-size'
        }
        collapsible={firstCollapsible}
        collapsedSize={0}
        collapsedThreshold={48}
        panelRef={firstPanelRef}
        minSize={firstMin}
        maxSize={firstMax}
      >
        {children[0]}
      </Panel>
      <Separator
        className="workspaceSeparator"
        aria-label="Resize workspace pane"
        title="Drag to resize pane"
      />
      <Panel
        id={`${id}-second`}
        className="splitPane"
        defaultSize={secondSize}
        groupResizeBehavior={
          typeof secondSize === 'number'
            ? 'preserve-pixel-size'
            : 'preserve-relative-size'
        }
        minSize={secondMin}
        maxSize={secondMax ?? (firstCollapsible ? '100%' : '80%')}
      >
        {children[1]}
      </Panel>
    </Group>
  );
}

export default ResizableWorkspace;
