import React, { useState, useEffect, useMemo } from 'react';
// Polyfill React globally for legacy libraries like react-filerobot-image-editor
if (typeof window !== 'undefined') {
  (window as any).React = React;
}

import { X, Send, FileText, Music, Crop, Edit2, Type, Square, Smile, Download, Plus, RotateCcw } from 'lucide-react';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';

interface MediaItem {
  file: File;
  type: 'image' | 'video' | 'audio' | 'file';
}

class EditorErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorMsg: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMsg: error.toString() };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Filerobot Editor crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', padding: 20, textAlign: 'center' }}>
          <h3>Editor Failed to Load</h3>
          <p style={{ color: '#ff4444', marginTop: 10 }}>{this.state.errorMsg}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface MediaPreviewProps {
  media: MediaItem[];
  onClose: () => void;
  onSend: (mediaWithCaptions: (MediaItem & { caption: string })[]) => void;
  onAddMedia: (newMedia: MediaItem[]) => void;
  onUpdateMedia?: (index: number, updatedMedia: MediaItem) => void;
}

const ThumbnailItem: React.FC<{ 
  item: MediaItem; 
  isActive: boolean; 
  onClick: () => void; 
}> = ({ item, isActive, onClick }) => {
  const thumbUrl = useMemo(() => URL.createObjectURL(item.file), [item.file]);
  
  useEffect(() => {
    return () => URL.revokeObjectURL(thumbUrl);
  }, [thumbUrl]);

  return (
    <div 
      className={`thumbnail-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      {item.type === 'image' ? (
        <img src={thumbUrl} alt="thumb" />
      ) : (
        <video src={thumbUrl} muted />
      )}
    </div>
  );
};

const MediaPreview: React.FC<MediaPreviewProps> = ({ media, onClose, onSend, onAddMedia, onUpdateMedia }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captions, setCaptions] = useState<{ [index: number]: string }>({});
  const addMediaInputRef = React.useRef<HTMLInputElement>(null);
  
  const [activeTool, setActiveTool] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<any>(TABS.ANNOTATE);
  
  // Guard against out of bounds if media list changes
  const effectiveIndex = currentIndex >= media.length ? 0 : currentIndex;
  const { file, type } = media[effectiveIndex] || { file: null, type: 'file' };
  
  const previewUrl = useMemo(() => {
    if (file && (type === 'image' || type === 'video')) {
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

  const handleSend = async () => {
    // If we're editing an image, we should trigger a save before sending
    // For simplicity in this version, we assume the user saves manually or we use the latest edited version
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
    a.download = file?.name || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const dataURItoFile = (dataURI: string, filename: string) => {
    const arr = dataURI.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleEditorSave = (editedImageObject: any) => {
    const dataUri = editedImageObject?.imageBase64;
    if (!dataUri) return;
    
    const editedFile = dataURItoFile(dataUri, file?.name || 'edited_image.png');
    if (onUpdateMedia) {
      onUpdateMedia(effectiveIndex, { file: editedFile, type: 'image' });
    }
    setActiveTool(null);
  };

  const handleAddMoreMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newMedia: MediaItem[] = Array.from(files).map((f) => {
        let t: 'image' | 'video' | 'audio' | 'file' = 'file';
        if (f.type.startsWith('image/')) t = 'image';
        else if (f.type.startsWith('video/')) t = 'video';
        else if (f.type.startsWith('audio/')) t = 'audio';
        return { file: f, type: t };
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
    if (!file) return null;

    switch (type) {
      case 'image':
        return (
          <div className="media-preview-image-wrapper integrated-editor">
            <EditorErrorBoundary>
              <FilerobotImageEditor
                source={previewUrl!}
                onSave={handleEditorSave}
                onClose={() => setActiveTool(null)}
                savingPixelRatio={1}
                previewPixelRatio={1}
                disableSaveIfNoChanges={false}
                observePluginContainerSize={true}
                annotationsCommon={{ fill: '#ff0000' }}
                Text={{ text: 'Add Text...' }}
                defaultTabId={activeTab}
                defaultToolId={activeTool || undefined}
                tabsIds={[TABS.ADJUST, TABS.ANNOTATE, TABS.FILTERS, TABS.FINETUNE]}
                // Customizing the view to be "integrated"
                showBackButton={false}
                closeAfterSave={true}
              />
            </EditorErrorBoundary>
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

  return (
    <div className="media-preview-overlay whatsapp-integrated">
      <div className="media-preview-container">
        <header className="media-preview-header-whatsapp">
          <div className="header-left">
            <button onClick={onClose} className="toolbar-icon-btn" title="Close">
              <X size={24} />
            </button>
          </div>
          
          {type === 'image' && (
            <div className="header-actions-whatsapp">
              {activeTool && (
                <>
                  <button 
                    className="toolbar-icon-btn undo-btn" 
                    onClick={() => {
                      // Trigger Filerobot undo via DOM click as a fallback
                      const undoBtn = document.querySelector('.filerobot-image-editor-root [title*="Undo"]') as HTMLElement;
                      undoBtn?.click();
                    }} 
                    title="Undo"
                  >
                    <RotateCcw size={20} />
                  </button>
                  <button 
                    className="done-text-btn" 
                    onClick={() => {
                      // Trigger Filerobot save via DOM click
                      const saveBtn = document.querySelector('.filerobot-image-editor-root [class*="Save"], .filerobot-image-editor-root button:last-child') as HTMLElement;
                      saveBtn?.click();
                    }}
                  >
                    Done
                  </button>
                  <div className="divider-v"></div>
                </>
              )}
              <button 
                className={`toolbar-icon-btn ${activeTool === TOOLS.CROP ? 'active' : ''}`} 
                onClick={() => { setActiveTab(TABS.ADJUST); setActiveTool(TOOLS.CROP); }} 
                title="Crop/Rotate"
              >
                <Crop size={22} />
              </button>
              <button 
                className={`toolbar-icon-btn ${activeTool === TOOLS.PEN ? 'active' : ''}`} 
                onClick={() => { setActiveTab(TABS.ANNOTATE); setActiveTool(TOOLS.PEN); }} 
                title="Draw"
              >
                <Edit2 size={20} />
              </button>
              <button 
                className={`toolbar-icon-btn ${activeTool === TOOLS.TEXT ? 'active' : ''}`} 
                onClick={() => { setActiveTab(TABS.ANNOTATE); setActiveTool(TOOLS.TEXT); }} 
                title="Text"
              >
                <Type size={22} />
              </button>
              <button 
                className={`toolbar-icon-btn ${activeTool === TOOLS.RECT ? 'active' : ''}`} 
                onClick={() => { setActiveTab(TABS.ANNOTATE); setActiveTool(TOOLS.RECT); }} 
                title="Shapes"
              >
                <Square size={20} />
              </button>
              <button 
                className={`toolbar-icon-btn ${activeTool === TOOLS.IMAGE ? 'active' : ''}`} 
                onClick={() => { setActiveTab(TABS.ANNOTATE); setActiveTool(TOOLS.IMAGE); }} 
                title="Stickers"
              >
                <Smile size={22} />
              </button>
              <button className="toolbar-icon-btn" onClick={handleDownload} title="Download">
                <Download size={22} />
              </button>
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
                  value={captions[effectiveIndex] || ''} 
                  onChange={(e) => setCaptions(prev => ({ ...prev, [effectiveIndex]: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  autoFocus
                />
              </div>
            </div>

            <div className="thumbnail-strip">
              {media.map((item, index) => {
                if (item.type !== 'image' && item.type !== 'video') return null;
                return (
                  <ThumbnailItem 
                    key={index}
                    item={item}
                    isActive={index === effectiveIndex}
                    onClick={() => {
                      setCurrentIndex(index);
                      setActiveTool(null);
                    }}
                  />
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
