import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, FileText, Music } from 'lucide-react';

interface MediaPreviewProps {
  file: File;
  type: 'image' | 'video' | 'audio' | 'file';
  onClose: () => void;
  onSend: (file: File, caption: string) => void;
}

const MediaPreview: React.FC<MediaPreviewProps> = ({ file, type, onClose, onSend }) => {
  const [caption, setCaption] = useState('');
  
  const previewUrl = useMemo(() => {
    if (type === 'image' || type === 'video') {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file, type]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [onClose, previewUrl]);

  const handleSend = () => {
    onSend(file, caption);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderPreview = () => {
    switch (type) {
      case 'image':
        return <img src={previewUrl!} alt="Preview" className="media-preview-content" />;
      case 'video':
        return <video src={previewUrl!} controls className="media-preview-content" />;
      case 'audio':
        return (
          <div className="media-preview-file-card">
            <div className="file-icon-large audio"><Music size={48} /></div>
            <div className="file-info-large">
              <span className="file-name-large">{file.name}</span>
              <span className="file-size-large">{formatFileSize(file.size)}</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="media-preview-file-card">
            <div className="file-icon-large doc"><FileText size={48} /></div>
            <div className="file-info-large">
              <span className="file-name-large">{file.name}</span>
              <span className="file-size-large">{formatFileSize(file.size)}</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="media-preview-overlay">
      <div className="media-preview-container">
        <header className="media-preview-header-whatsapp">
          <button onClick={onClose} className="close-btn-whatsapp" title="Close">
            <X size={24} />
          </button>
          <div className="header-info">
            <span className="preview-title">Preview</span>
          </div>
          <div style={{ width: 44 }} />
        </header>

        <main className="media-preview-main">
          {renderPreview()}
        </main>

        <footer className="media-preview-footer-whatsapp">
          <div className="caption-input-container-whatsapp">
            <input 
              type="text" 
              placeholder="Add a caption..." 
              value={caption} 
              onChange={(e) => setCaption(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              autoFocus
            />
            <button className="send-media-btn-whatsapp" onClick={handleSend} title="Send">
              <Send size={20} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MediaPreview;
