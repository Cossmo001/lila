import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, FileText, Phone, Video } from 'lucide-react';
import type { Message } from '../types';
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
  onMediaClick?: (media: { url: string; type: 'image' | 'video' }) => void;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  wallpaper, 
  onDeleteMessage,
  onReplyMessage,
  onEditMessage,
  onMediaClick
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
            onClick={() => onMediaClick?.({ url: msg.mediaUrl!, type: 'image' })}
          />
        );
      case 'video':
        return (
          <div className="message-media video-container" onClick={() => onMediaClick?.({ url: msg.mediaUrl!, type: 'video' })}>
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
      case 'call':
        return (
          <div className="message-call-log">
            {msg.text.toLowerCase().includes('video') ? <Video size={16} /> : <Phone size={16} />}
            <span>{msg.text}</span>
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

  const isNewDay = (msg: Message, prevMsg?: Message) => {
    if (!prevMsg || !msg.timestamp) return true;
    const date1 = (msg.timestamp as any)?.toDate ? (msg.timestamp as any).toDate() : new Date(msg.timestamp as any);
    const date2 = (prevMsg.timestamp as any)?.toDate ? (prevMsg.timestamp as any).toDate() : new Date(prevMsg.timestamp as any);
    return date1.toDateString() !== date2.toDateString();
  };

  const formatDateLabel = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Same day
    if (date.toDateString() === today.toDateString()) return 'Today';
    
    // Yesterday
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    // Within the last 7 days (show day name)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    if (date > sevenDaysAgo && date < today) {
      return date.toLocaleDateString([], { weekday: 'long' });
    }
    
    // Over a week ago (show month and day)
    return date.toLocaleDateString([], { day: 'numeric', month: 'long' });
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
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : undefined;
          const showDateStamp = isNewDay(msg, prevMsg);

          return (
            <React.Fragment key={msg.id}>
              {showDateStamp && (
                <div className="date-stamp-container">
                  <div className="date-stamp">
                    {formatDateLabel(msg.timestamp)}
                  </div>
                </div>
              )}
              <div 
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
                              <CheckCheck size={14} color="var(--text-secondary)" />
                            ) : (
                              <Check size={14} color="var(--text-secondary)" />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>


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


