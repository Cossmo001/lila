import React, { useState, useEffect, useMemo } from 'react';
import { X, Send, FileText, Music, Crop, Edit2, Type, Square, Smile, Download, Plus } from 'lucide-react';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';

interface MediaItem {
  file: File;
  type: 'image' | 'video' | 'audio' | 'file';
}

interface MediaPreviewProps {
  media: MediaItem[];
  onClose: () => void;
  onSend: (mediaWithCaptions: (MediaItem & { caption: string })[]) => void;
  onAddMedia: (newMedia: MediaItem[]) => void;
  onUpdateMedia?: (index: number, updatedMedia: MediaItem) => void;
}

const MediaPreview: React.FC<MediaPreviewProps> = ({ media, onClose, onSend, onAddMedia, onUpdateMedia }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captions, setCaptions] = useState<{ [index: number]: string }>({});
  const addMediaInputRef = React.useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editorConfig, setEditorConfig] = useState<any>(null);
  
  const currentMedia = media[currentIndex];
  const { file, type } = currentMedia;
  
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
    const payloads = media.map((item, index) => ({
      ...item,
      caption: captions[index] || ''
    }));
    onSend(payloads);
    onClose();
  };

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = file.name || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openEditor = (tabId: string, toolId: string) => {
    if (type !== 'image') return;
    setEditorConfig({ defaultTabId: tabId, defaultToolId: toolId });
    setIsEditing(true);
  };

  const handleEditorSave = async (editedImageObject: any) => {
    setIsEditing(false);
    try {
      const response = await fetch(editedImageObject.imageBase64);
      const blob = await response.blob();
      const editedFile = new File([blob], file.name || 'edited_image.png', { type: file.type || 'image/png' });
      if (onUpdateMedia) {
        onUpdateMedia(currentIndex, { file: editedFile, type: 'image' });
      }
    } catch (e) {
      console.error("Failed to save edited image:", e);
    }
  };

  const handleAddMoreMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newMedia: MediaItem[] = Array.from(files).map((file) => {
        const isVideo = file.type.startsWith('video/');
        return { file, type: isVideo ? 'video' : 'image' };
      });
      onAddMedia(newMedia);
      if (e.target) e.target.value = '';
    }
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
        return (
          <div className="media-preview-image-wrapper">
            <img src={previewUrl!} alt="Preview" className="media-preview-content" />
          </div>
        );
      case 'video':
        return (
          <div className="media-preview-image-wrapper">
            <video src={previewUrl!} controls className="media-preview-content" />
          </div>
        );
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

  if (isEditing && type === 'image' && previewUrl) {
    return (
      <div className="media-preview-overlay" style={{ zIndex: 9999, backgroundColor: '#000', height: '100vh', width: '100vw' }}>
        <FilerobotImageEditor
          source={previewUrl}
          onSave={(editedImageObject) => handleEditorSave(editedImageObject)}
          onClose={() => setIsEditing(false)}
          savingPixelRatio={1}
          previewPixelRatio={1}
          annotationsCommon={{ fill: '#ff0000' }}
          Text={{ text: 'Add Text...' }}
          defaultTabId={editorConfig?.defaultTabId || TABS.ANNOTATE}
          defaultToolId={editorConfig?.defaultToolId || TOOLS.TEXT}
          useBackendTranslations={false}
        />
      </div>
    );
  }

  return (
    <div className="media-preview-overlay">
      <div className="media-preview-container">
        <header className="media-preview-header-whatsapp">
          <div className="header-left">
            <button onClick={onClose} className="toolbar-icon-btn" title="Close">
              <X size={24} />
            </button>
          </div>
          
          {type === 'image' && (
            <div className="header-actions-whatsapp">
              <button className="toolbar-icon-btn" onClick={() => openEditor(TABS.ADJUST, TOOLS.CROP)} title="Crop/Rotate"><Crop size={22} /></button>
              <button className="toolbar-icon-btn" onClick={() => openEditor(TABS.ANNOTATE, TOOLS.PEN)} title="Draw"><Edit2 size={20} /></button>
              <button className="toolbar-icon-btn" onClick={() => openEditor(TABS.ANNOTATE, TOOLS.TEXT)} title="Text"><Type size={22} /></button>
              <button className="toolbar-icon-btn" onClick={() => openEditor(TABS.ANNOTATE, TOOLS.RECT)} title="Shapes"><Square size={20} /></button>
              <button className="toolbar-icon-btn" onClick={() => openEditor(TABS.ANNOTATE, TOOLS.IMAGE)} title="Stickers"><Smile size={22} /></button>
              <button className="toolbar-icon-btn" onClick={handleDownload} title="Download"><Download size={22} /></button>
            </div>
          )}
        </header>

        <main className="media-preview-main">
          {renderPreview()}
        </main>

        <footer className="media-preview-footer-whatsapp">
          <div className="footer-content-wrapper">
            <div className="caption-input-wrapper">
              <div className="caption-input-container-whatsapp">
                <button className="emoji-btn"><Smile size={24} color="#8696a0" /></button>
                <input 
                  type="text" 
                  placeholder="Add a caption" 
                  value={captions[currentIndex] || ''} 
                  onChange={(e) => setCaptions(prev => ({ ...prev, [currentIndex]: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  autoFocus
                />
              </div>
            </div>

            <div className="thumbnail-strip">
              {media.map((item, index) => {
                if (item.type !== 'image' && item.type !== 'video') return null;
                const thumbUrl = URL.createObjectURL(item.file);
                return (
                  <div 
                    key={index} 
                    className={`thumbnail-item ${index === currentIndex ? 'active' : ''}`}
                    onClick={() => setCurrentIndex(index)}
                  >
                    {item.type === 'image' ? (
                      <img src={thumbUrl} alt="thumb" />
                    ) : (
                      <video src={thumbUrl} muted />
                    )}
                  </div>
                );
              })}
              <div className="thumbnail-add-btn" onClick={() => addMediaInputRef.current?.click()}>
                <Plus size={24} />
              </div>
              <input 
                type="file" 
                ref={addMediaInputRef} 
                className="hidden" 
                hidden
                multiple 
                accept="image/*,video/*" 
                onChange={handleAddMoreMedia} 
              />
            </div>
            
            <button className="send-media-fab" onClick={handleSend} title="Send">
              <Send size={24} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MediaPreview;
