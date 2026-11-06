import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, AlertCircle } from 'lucide-react';
import { ReaderTools } from './ReaderPane';
import { getReadingState, saveReadingState } from './reading-state';

// Configure pdfjs worker
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
}

interface PdfDocumentProps {
  url: string;
  fileKey: string;
}

export const PdfDocument: React.FC<PdfDocumentProps> = ({ url, fileKey }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const initial = getReadingState(fileKey);
  const [currentPage, setCurrentPage] = useState<number>(initial.page || 1);
  const [zoom, setZoom] = useState<number>(initial.zoom || 1.0);
  const [numPages, setNumPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF Document
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    const loadingTask = pdfjs.getDocument({
      url,
      withCredentials: false,
    });

    loadingTask.promise
      .then((doc) => {
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('PDF load error:', err);
        setErrorMessage(err?.message || 'Failed to load PDF document');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Task already completed or cancelled
        }
      }
    };
  }, [url]);

  // Render active page to canvas
  const renderPage = useCallback(
    async (pageNum: number, currentZoom: number) => {
      const doc = pdfDocRef.current;
      const canvas = canvasRef.current;
      if (!doc || !canvas) return;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }

      try {
        const page = await doc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        // Calculate responsive scale
        const containerWidth = containerRef.current?.clientWidth || 800;
        const fitScale = (containerWidth - 48) / unscaledViewport.width;
        const finalScale = Math.max(0.4, Math.min(3.0, (fitScale > 0 ? fitScale : 1.0) * currentZoom));

        const viewport = page.getViewport({ scale: finalScale });
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport,
          canvas,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;

        saveReadingState(fileKey, { page: pageNum, zoom: currentZoom });
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF render error:', err);
        }
      }
    },
    [fileKey]
  );

  useEffect(() => {
    if (!loading && pdfDocRef.current) {
      renderPage(currentPage, zoom);
    }
  }, [loading, currentPage, zoom, renderPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage((p) => p + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100));
  };

  const handleResetZoom = () => {
    setZoom(1.0);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-1">
      {/* Tool slot rendered into ReaderPane header */}
      <ReaderTools>
        <div className="flex items-center space-x-1.5 text-xs">
          <div className="flex items-center bg-surface border border-subtle rounded px-1">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || loading}
              className="p-1 hover:text-accent disabled:opacity-30 cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] px-1.5 font-medium select-none text-tx-secondary">
              {currentPage} / {numPages}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= numPages || loading}
              className="p-1 hover:text-accent disabled:opacity-30 cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center bg-surface border border-subtle rounded px-1">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5 || loading}
              className="p-1 hover:text-accent disabled:opacity-30 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="font-mono text-[10px] px-1 hover:text-accent cursor-pointer font-medium text-tx-secondary"
              title="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 2.5 || loading}
              className="p-1 hover:text-accent disabled:opacity-30 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </ReaderTools>

      {/* Main Canvas Scroll Area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto custom-scrollbar p-6 flex flex-col items-center justify-start relative"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center p-12 text-tx-muted space-y-2">
            <RotateCw className="w-6 h-6 animate-spin text-accent" />
            <span className="text-xs font-mono">Loading PDF stream via lms:// protocol...</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-xs text-tx-primary font-medium">{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setCurrentPage(1);
              }}
              className="px-3 py-1 text-xs rounded bg-accent text-white font-semibold cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`shadow-md rounded border border-border-subtle bg-white transition-opacity duration-150 ${
            loading || errorMessage ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        />
      </div>
    </div>
  );
};
