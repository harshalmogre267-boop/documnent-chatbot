import React from 'react';
import { X, FileText, Copy, Check } from 'lucide-react';
import type { Citation } from '../types';

interface SourceViewerProps {
  citation: Citation | null;
  onClose: () => void;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({ citation, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!citation) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(citation.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="source-viewer-drawer open">
      {/* Drawer Overlay Header */}
      <div className="drawer-header">
        <div className="drawer-title-wrapper">
          <FileText className="source-icon" size={18} />
          <h3>Source Inspector</h3>
        </div>
        <button className="btn-icon close-btn" onClick={onClose} title="Close inspector">
          <X size={18} />
        </button>
      </div>

      {/* Drawer Body content */}
      <div className="drawer-body">
        
        {/* Source metadata card */}
        <div className="metadata-card">
          <div className="meta-row">
            <span className="meta-label">Document:</span>
            <span className="meta-value filename" title={citation.fileName}>{citation.fileName}</span>
          </div>
          {citation.pageNumber && (
            <div className="meta-row">
              <span className="meta-label">Location:</span>
              <span className="meta-value">Page {citation.pageNumber}</span>
            </div>
          )}
          <div className="meta-row">
            <span className="meta-label">Chunk Reference:</span>
            <span className="meta-value id-code">#{citation.chunkId.split('-').pop()}</span>
          </div>
        </div>

        {/* Source raw content */}
        <div className="source-content-section">
          <div className="content-header">
            <h4>Raw Document Segment</h4>
            <button className="btn-copy" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check size={13} className="copy-icon-check" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy text</span>
                </>
              )}
            </button>
          </div>
          
          <div className="text-display-box">
            <div className="quote-accent-bar"></div>
            <p className="source-text-highlight">
              {citation.text}
            </p>
          </div>
        </div>

        {/* Explanatory notice */}
        <div className="source-footer-notice">
          <p>
            This paragraph was parsed client-side and supplied to the AI engine as grounding context. The answer generated is synthesized directly from this information.
          </p>
        </div>
      </div>
    </div>
  );
};
