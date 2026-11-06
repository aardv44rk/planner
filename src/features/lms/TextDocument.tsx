import React, { useState, useEffect } from 'react';
import { Copy, Check, WrapText } from 'lucide-react';
import { ReaderTools } from './ReaderPane';

interface TextDocumentProps {
  url?: string;
  rawContent?: string;
  fileKey: string;
}

export const TextDocument: React.FC<TextDocumentProps> = ({
  url,
  rawContent,
}) => {
  const [content, setContent] = useState<string>(rawContent || '');
  const [loading, setLoading] = useState<boolean>(!rawContent && Boolean(url));
  const [copied, setCopied] = useState<boolean>(false);
  const [wrap, setWrap] = useState<boolean>(true);

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
          console.error('Failed to load text file:', err);
          setContent(`Failed to load document: ${err?.message || 'Network error'}`);
          setLoading(false);
        });
    }
  }, [url, rawContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = content.split('\n');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-1">
      <ReaderTools>
        <div className="flex items-center space-x-1.5 text-xs">
          <span className="text-[10px] font-mono text-tx-muted select-none">
            {lines.length} lines
          </span>

          <button
            type="button"
            onClick={() => setWrap((w) => !w)}
            className={`p-1 rounded border transition-colors cursor-pointer ${
              wrap
                ? 'bg-accent/15 border-accent text-accent'
                : 'bg-surface border-subtle text-tx-secondary hover:text-tx-primary'
            }`}
            title="Toggle Word Wrap"
          >
            <WrapText className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-surface border border-subtle text-tx-secondary hover:text-tx-primary transition-colors cursor-pointer"
            title="Copy Text"
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

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar font-mono text-xs p-4 leading-relaxed flex">
        {loading ? (
          <div className="flex items-center justify-center w-full p-12 text-tx-muted font-mono">
            Loading text stream via lms://...
          </div>
        ) : (
          <div className="flex w-full select-text">
            {/* Line numbers */}
            <div className="pr-3 select-none text-tx-muted text-right border-r border-border-subtle shrink-0 opacity-60">
              {lines.map((_, i) => (
                <div key={i} className="leading-relaxed">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code / Text contents */}
            <div className={`pl-3.5 flex-1 min-w-0 ${wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}>
              {lines.map((line, i) => (
                <div key={i} className="leading-relaxed text-tx-primary">
                  {line || '\u00A0'}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
