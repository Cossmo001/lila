import React, { useState } from 'react';
import { X, Send, FileText, Film } from 'lucide-react';

interface MediaPreviewProps {
  file: File;
  type: 'image' | 'video' | 'audio' | 'file';
  onClose: () => void;
  onSend: (file: File, caption: string) => void;
}

const MediaPreview: React.FC<MediaPreviewProps> = ({ file, type, onClose, onSend }) => {
  const [caption, setCaption] = useState('');
  const previewUrl = React.useMemo(() => {
    if (type === 'image' || type === 'video') {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file, type]);

  const handleSend = () => {
    onSend(file, caption);
    onClose();
  };

  const renderPreview = () => {
    switch (type) {
      case 'image':
        return <img src={previewUrl!} alt="Preview" className="media-preview-content" />;
      case 'video':
        return <video src={previewUrl!} controls className="media-preview-content" />;
      case 'audio':
        return (
          <div className="media-preview-file">
            <div className="file-icon-large audio"><Film size={48} /></div>
            <span>{file.name}</span>
          </div>
        );
      default:
        return (
          <div className="media-preview-file">
            <div className="file-icon-large doc"><FileText size={48} /></div>
            <span>{file.name}</span>
          </div>
        );
    }
  };

  return (
    <div className="media-preview-overlay">
      <div className="media-preview-container">
        <header className="media-preview-header">
          <button onClick={onClose} className="close-btn"><X size={24} /></button>
          <h3>Preview</h3>
          <div style={{ width: 24 }} />
        </header>

        <main className="media-preview-main">
          {renderPreview()}
        </main>

        <footer className="media-preview-footer">
          <div className="caption-input-container">
            <input 
              type="text" 
              placeholder="Add a caption..." 
              value={caption} 
              onChange={(e) => setCaption(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              autoFocus
            />
            <button className="send-media-btn" onClick={handleSend}>
              <Send size={24} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MediaPreview;
