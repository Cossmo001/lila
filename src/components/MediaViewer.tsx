import React, { useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface MediaViewerProps {
  url: string;
  type: 'image' | 'video';
  onClose: () => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ url, type, onClose }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `media_${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="media-viewer-overlay" onClick={onClose}>
      <div className="media-viewer-toolbar" onClick={e => e.stopPropagation()}>
        <div className="toolbar-left">
          <button className="toolbar-btn" onClick={onClose} title="Close">
            <X size={24} />
          </button>
        </div>
        <div className="toolbar-right">
          {type === 'image' && (
            <>
              <button className="toolbar-btn"><ZoomIn size={20} /></button>
              <button className="toolbar-btn"><ZoomOut size={20} /></button>
            </>
          )}
          <button className="toolbar-btn" onClick={handleDownload} title="Download">
            <Download size={20} />
          </button>
        </div>
      </div>

      <div className="media-viewer-content" onClick={e => e.stopPropagation()}>
        {type === 'image' ? (
          <img src={url} alt="full screen" className="full-media" />
        ) : (
          <video src={url} controls autoPlay className="full-media" />
        )}
      </div>
    </div>
  );
};

export default MediaViewer;
