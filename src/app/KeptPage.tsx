import { createContext, useContext, useState, type FC, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const PageLayerContext = createContext<HTMLElement | null>(null);

/** Returns the active retained page layer host for Radix/floating overlays */
export const usePageLayer = (): HTMLElement => {
  return useContext(PageLayerContext) ?? (typeof document !== 'undefined' ? document.body : (null as any));
};

interface KeptPageProps {
  visible: boolean;
  children: ReactNode;
  className?: string;
  name?: string;
}

/**
 * Retains visited page views in the DOM when inactive.
 * Hides visual layout without tearing down component state, scroll offsets, or editors.
 * Scopes popovers, context menus, and portals so inactive page overlays are cleanly hidden.
 */
export const KeptPage: FC<KeptPageProps> = ({
  visible,
  children,
  className = '',
  name,
}) => {
  const parentLayer = useContext(PageLayerContext);

  // Retained layer node created once on initial mount
  const [pageLayer] = useState<HTMLDivElement>(() => {
    if (typeof document === 'undefined') return null as any;
    const el = document.createElement('div');
    el.className = 'kept-page-layer';
    return el;
  });

  const [attachHost] = useState(
    () => (host: HTMLDivElement | null) => {
      if (host && pageLayer && !host.contains(pageLayer)) {
        host.appendChild(pageLayer);
      }
    }
  );

  return (
    <div
      data-kept-page={name}
      hidden={!visible}
      className={`kept-page-container ${className}`}
      style={{
        display: visible ? 'contents' : 'none',
      }}
    >
      <PageLayerContext.Provider value={pageLayer}>
        {children}
        {!parentLayer && <div className="kept-page-layer-host" ref={attachHost} />}
      </PageLayerContext.Provider>

      {parentLayer &&
        pageLayer &&
        createPortal(
          <div className="kept-page-sublayer" hidden={!visible} ref={attachHost} />,
          parentLayer
        )}
    </div>
  );
};
