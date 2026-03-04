import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Trash2 } from 'lucide-react';
import type { Message } from '../types';
import MediaViewer from './MediaViewer';
import CustomAudioPlayer from './CustomAudioPlayer';

interface MessageListProps {
  messages: Message[];
  wallpaper?: {
    type: 'color' | 'image';
    value: string;
  };
  onDeleteMessage?: (messageId: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, wallpaper, onDeleteMessage }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeMedia, setActiveMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
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
      default:
        return <>{msg.text}</>;
    }
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
            <div className={`message ${msg.sender} ${msg.senderId === 'system' ? 'system' : ''}`}>
              <div className="message-content">
                {msg.senderId !== 'system' && msg.sender === 'them' && msg.senderName && (
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '4px' }}>
                    {msg.senderName}
                  </div>
                )}
                {renderMessageContent(msg)}
              <div className="message-time">
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
                    {!msg.isDeleted && (new Date().getTime() - (msg.timestamp?.getTime() || 0)) < 43200000 && (
                      <button 
                        className="delete-msg-btn"
                        onClick={() => onDeleteMessage?.(msg.id)}
                        title="Delete for everyone"
                        style={{ background: 'none', border: 'none', padding: '0 0 0 8px', color: 'var(--text-time)', cursor: 'pointer', display: 'inline-flex', verticalAlign: 'middle' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>
                )}
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
    </>
  );
};

export default MessageList;


