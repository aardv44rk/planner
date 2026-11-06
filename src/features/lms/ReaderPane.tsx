import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, FileText } from 'lucide-react';

const ReaderToolsContext = createContext<HTMLElement | null>(null);

export const ReaderTools: React.FC<{ children: ReactNode }> = ({ children }) => {
  const host = useContext(ReaderToolsContext);
  return host ? createPortal(children, host) : <>{children}</>;
};

interface ReaderPaneProps {
  title: string;
  fileType?: string;
  onClose: () => void;
  onOpenExternal?: () => void;
  children: ReactNode;
}

export const ReaderPane: React.FC<ReaderPaneProps> = ({
  title,
  fileType,
  onClose,
  onOpenExternal,
  children,
}) => {
  const [toolsHost, setToolsHost] = useState<HTMLDivElement | null>(null);

  return (
    <div className="h-full flex flex-col bg-surface border border-subtle rounded-[var(--radius-card)] overflow-hidden shadow-subtle">
      {/* Document Reader Header */}
      <header className="flex items-center justify-between px-3.5 py-2.5 bg-surface-2 border-b border-subtle select-none">
        <div className="flex items-center space-x-2 min-w-0 pr-2">
          <FileText className="w-4 h-4 text-accent shrink-0" />
          <h2 className="text-xs font-semibold text-tx-primary truncate leading-tight" title={title}>
            {title}
          </h2>
          {fileType && (
            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-3 border border-subtle text-tx-muted font-bold shrink-0">
              {fileType}
            </span>
          )}
        </div>

        {/* Action Controls & External Link */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <div ref={setToolsHost} className="flex items-center space-x-1" />

          {onOpenExternal && (
            <button
              type="button"
              onClick={onOpenExternal}
              className="p-1 rounded text-tx-muted hover:text-tx-primary hover:bg-elevated transition-colors cursor-pointer"
              title="Open in System Default Application"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-tx-muted hover:text-red-500 hover:bg-elevated transition-colors cursor-pointer"
            title="Close Document"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Reader Body */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <ReaderToolsContext.Provider value={toolsHost}>
          {children}
        </ReaderToolsContext.Provider>
      </div>
    </div>
  );
};
