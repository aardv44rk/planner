import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { ReaderTools } from './ReaderPane';

interface MarkdownDocumentProps {
  url?: string;
  rawContent?: string;
  fileKey: string;
}

export const MarkdownDocument: React.FC<MarkdownDocumentProps> = ({
  url,
  rawContent,
}) => {
  const [content, setContent] = useState<string>(rawContent || '');
  const [loading, setLoading] = useState<boolean>(!rawContent && Boolean(url));
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (rawContent) {
      setContent(rawContent);
      return;
    }

    if (url) {
      setLoading(true);
      fetch(url)
        .then((r) => r.text())
        .then((text) => {
          setContent(text);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load markdown content:', err);
          setContent(`# Failed to load document\n\n${err?.message || 'Network error'}`);
          setLoading(false);
        });
    }
  }, [url, rawContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-1">
      <ReaderTools>
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[10px] font-mono text-tx-muted select-none">
            {wordCount} words
          </span>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-surface border border-subtle text-tx-secondary hover:text-tx-primary transition-colors cursor-pointer text-xs"
            title="Copy Raw Markdown"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] text-emerald-500 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="text-[10px]">Copy</span>
              </>
            )}
          </button>
        </div>
      </ReaderTools>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 max-w-4xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-tx-muted text-xs font-mono">
            Loading document via lms:// stream...
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-tx-primary leading-relaxed space-y-4">
            <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
              {content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
