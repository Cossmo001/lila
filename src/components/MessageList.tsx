import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '../types';
import MediaViewer from './MediaViewer';
import CustomAudioPlayer from './CustomAudioPlayer';

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeMedia, setActiveMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const renderMessageContent = (msg: Message) => {
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
      <div className="message-list">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            <div className="message-content">
              {renderMessageContent(msg)}
              <div className="message-time">
                {formatTime(msg.timestamp)}
                {msg.sender === 'me' && (
                  <div style={{ marginLeft: '4px', display: 'inline-flex', verticalAlign: 'middle' }}>
                    {msg.read ? (
                      <CheckCheck size={14} color="var(--accent)" />
                    ) : msg.delivered ? (
                      <CheckCheck size={14} color="var(--text-time)" />
                    ) : (
                      <Check size={14} color="var(--text-time)" />
                    )}
                  </div>
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


