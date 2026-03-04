import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, FileText } from 'lucide-react';
import type { Message } from '../types';
import MediaViewer from './MediaViewer';
import CustomAudioPlayer from './CustomAudioPlayer';
import MessageContextMenu from './MessageContextMenu';

interface MessageListProps {
  messages: Message[];
  wallpaper?: {
    type: 'color' | 'image';
    value: string;
  };
  onDeleteMessage?: (messageId: string) => void;
  onReplyMessage?: (message: Message) => void;
  onEditMessage?: (message: Message) => void;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  wallpaper, 
  onDeleteMessage,
  onReplyMessage,
  onEditMessage
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeMedia, setActiveMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, message: Message } | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const longPressTimer = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    if (isSelectionMode) return;
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  };

  const handleTouchStart = (message: Message) => {
    longPressTimer.current = setTimeout(() => {
      // Trigger selection mode or context menu on long press
      if (!isSelectionMode) {
        // Find rough touch coordinates or just use center
        setContextMenu({ x: window.innerWidth / 2, y: window.innerHeight / 2, message });
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const toggleSelectMessage = (messageId: string) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
      if (newSelected.size === 0) setIsSelectionMode(false);
    } else {
      newSelected.add(messageId);
      setIsSelectionMode(true);
    }
    setSelectedMessages(newSelected);
  };
  const renderMessageContent = (msg: Message) => {
    if (msg.isDeleted) {
      return <span style={{ fontStyle: 'italic', opacity: 0.7 }}>This message was deleted</span>;
    }

    switch (msg.type) {
      case 'image':
        return (
          <img 
            src={msg.mediaUrl} 
            alt="sent picture" 
            className="message-media image" 
            onClick={() => setActiveMedia({ url: msg.mediaUrl!, type: 'image' })}
          />
        );
      case 'video':
        return (
          <div className="message-media video-container" onClick={() => setActiveMedia({ url: msg.mediaUrl!, type: 'video' })}>
            <video src={msg.mediaUrl} className="message-media video" />
            <div className="video-overlay">
              <div className="play-icon-circle">
                <div className="play-triangle" />
              </div>
            </div>
          </div>
        );
      case 'audio':
        return <CustomAudioPlayer url={msg.mediaUrl!} />;
      case 'file':
        return (
          <div className="message-file-content">
            <div className="file-icon"><FileText size={20} /></div>
            <div className="file-info">
              <span className="file-name">{msg.text.split('\n')[0]}</span>
              <button 
                className="file-download-btn"
                onClick={() => window.open(msg.mediaUrl, '_blank')}
              >
                Download
              </button>
            </div>
          </div>
        );
      default:
        return <>{msg.text}</>;
    }
  };

  const renderMessageText = (msg: Message) => {
    if (msg.type !== 'text' && msg.type !== 'file' && msg.text) {
      return <p className="message-caption">{msg.text}</p>;
    }
    return null;
  };
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div 
        className="message-list" 
        style={{ 
          background: wallpaper?.type === 'color' ? wallpaper.value : undefined,
          backgroundImage: wallpaper?.type === 'image' ? `url(${wallpaper.value})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {messages.map((msg) => (
            <div 
              key={msg.id}
              className={`message-wrapper ${msg.sender} ${selectedMessages.has(msg.id) ? 'selected' : ''}`}
              onClick={() => isSelectionMode && toggleSelectMessage(msg.id)}
            >
              {isSelectionMode && (
                <div className="selection-checkbox">
                  <input 
                    type="checkbox" 
                    checked={selectedMessages.has(msg.id)} 
                    onChange={() => toggleSelectMessage(msg.id)} 
                  />
                </div>
              )}
              <div 
                className={`message ${msg.sender} ${msg.senderId === 'system' ? 'system' : ''}`}
                onContextMenu={(e) => handleContextMenu(e, msg)}
                onTouchStart={() => handleTouchStart(msg)}
                onTouchEnd={handleTouchEnd}
              >
                <div className="message-content">
                  {msg.senderId !== 'system' && msg.sender === 'them' && msg.senderName && (
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' }}>
                      {msg.senderName}
                    </div>
                  )}
                  {msg.replyTo && (
                    <div className="reply-preview">
                      <span className="reply-sender">{msg.replyTo.senderName}</span>
                      <p className="reply-text">{msg.replyTo.text}</p>
                    </div>
                  )}
                  {renderMessageContent(msg)}
                  {renderMessageText(msg)}
                <div className="message-time">
                  {msg.isEdited && <span className="edited-tag">edited</span>}
                  {formatTime(msg.timestamp)}
                  {msg.sender === 'me' && (
                    <>
                      <div style={{ marginLeft: '4px', display: 'inline-flex', verticalAlign: 'middle' }}>
                        {msg.read ? (
                          <CheckCheck size={14} color="var(--accent)" />
                        ) : msg.delivered ? (
                          <CheckCheck size={14} color="var(--text-time)" />
                        ) : (
                          <Check size={14} color="var(--text-time)" />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {activeMedia && (
        <MediaViewer 
          url={activeMedia.url} 
          type={activeMedia.type} 
          onClose={() => setActiveMedia(null)} 
        />
      )}

      {contextMenu && (
        <MessageContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          isMyMessage={contextMenu.message.sender === 'me'}
          isDeleted={contextMenu.message.isDeleted}
          onClose={() => setContextMenu(null)}
          onReply={() => onReplyMessage?.(contextMenu.message)}
          onEdit={() => onEditMessage?.(contextMenu.message)}
          onDelete={() => onDeleteMessage?.(contextMenu.message.id)}
          onSelect={() => toggleSelectMessage(contextMenu.message.id)}
        />
      )}
    </>
  );
};

export default MessageList;


