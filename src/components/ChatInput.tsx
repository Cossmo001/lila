import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Plus, Mic, Image, Video, X, Square, FileText, Camera as CameraIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import EmojiPicker from './EmojiPicker';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onSendMedia: (file: File, type: 'image' | 'video' | 'audio' | 'file', caption?: string) => void;
  replyingTo?: any;
  editingMessage?: any;
  onCancelAction?: () => void;
  onMediaSelected?: (media: { file: File, type: 'image' | 'video' | 'audio' | 'file' }[] | null) => void;
  isUploadingExternal?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onSendMedia, 
  replyingTo, 
  editingMessage, 
  onCancelAction,
  onMediaSelected,
  isUploadingExternal: isUploading = false
}) => {
  const [text, setText] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
    } else {
      setText('');
    }
  }, [editingMessage]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const attachmentsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentsRef.current && !attachmentsRef.current.contains(event.target as Node)) {
        setShowAttachments(false);
        setShowEmojiPicker(false);
      }
    };

    if (showAttachments || showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttachments, showEmojiPicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSendMessage(text);
      setText('');
      setShowEmojiPicker(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setText(prev => prev + emoji);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const mediaArray = Array.from(files).map(file => ({ file, type }));
      onMediaSelected?.(mediaArray);
      setShowAttachments(false);
      if (e.target) e.target.value = ''; // Clear the input so the same file can be selected again
    }
  };

  const handleNativeMedia = async (sourceType: 'camera' | 'photos') => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Uri,
        source: sourceType === 'camera' ? CameraSource.Camera : CameraSource.Photos
      });
      
      const response = await fetch(image.webPath!);
      const blob = await response.blob();
      const file = new File([blob], `captured_image.${image.format}`, { type: `image/${image.format}` });
      onMediaSelected?.([{ file, type: 'image' }]);
      setShowAttachments(false);
    } catch (err) {
      console.error("Native media error:", err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voicenote.webm', { type: 'audio/webm' });
        // Since voice notes don't have a preview usually, we can either send directly or send to preview
        // For now let's send directly like before, but we might need isUploading state here too if we want
        // But the user didn't ask for voice note changes. 
        // I'll just keep it simple.
        try {
          await onSendMedia(audioFile, 'audio');
        } catch (err) {
          console.error("Voice note upload error:", err);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Please allow microphone access to record voice notes.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="chat-input-area" ref={attachmentsRef}>
      {(replyingTo || editingMessage) && (
        <div className="input-action-preview">
          <div className="preview-content">
            <span className="action-label">
              {replyingTo ? `Replying to ${replyingTo.senderName}` : 'Editing message'}
            </span>
            <p className="preview-text">{replyingTo ? replyingTo.text : editingMessage.text}</p>
          </div>
          <button className="cancel-action-btn" onClick={onCancelAction}>
            <X size={18} />
          </button>
        </div>
      )}
      <div className={`attachments-menu ${showAttachments ? 'active' : ''}`}>
        {Capacitor.isNativePlatform() && (
          <button className="attachment-item" onClick={() => handleNativeMedia('camera')} disabled={isUploading}>
            <div className="icon-circle" style={{ background: '#ff9c3a' }}><CameraIcon size={20} /></div>
            <span>Camera</span>
          </button>
        )}
        <button className="attachment-item" onClick={() => docInputRef.current?.click()} disabled={isUploading}>
          <div className="icon-circle" style={{ background: '#5f66cd' }}><FileText size={20} /></div>
          <span>Document</span>
        </button>
        <button className="attachment-item" onClick={() => Capacitor.isNativePlatform() ? handleNativeMedia('photos') : fileInputRef.current?.click()} disabled={isUploading}>
          <div className="icon-circle" style={{ background: '#7f66ff' }}><Image size={20} /></div>
          <span>Photos</span>
        </button>
        <button className="attachment-item" onClick={() => videoInputRef.current?.click()} disabled={isUploading}>
          <div className="icon-circle" style={{ background: '#ff4b4b' }}><Video size={20} /></div>
          <span>Videos</span>
        </button>
        <input type="file" ref={fileInputRef} hidden accept="image/*" multiple onChange={(e) => handleFileSelect(e, 'image')} />
        <input type="file" ref={videoInputRef} hidden accept="video/*" multiple onChange={(e) => handleFileSelect(e, 'video')} />
        <input type="file" ref={docInputRef} hidden multiple onChange={(e) => handleFileSelect(e, 'file')} />
      </div>

      <button className={`action-btn ${showAttachments ? 'active' : ''}`} onClick={() => !isUploading && setShowAttachments(!showAttachments)} disabled={isUploading}>
        {showAttachments ? <X size={24} /> : <Plus size={24} />}
      </button>

      {isRecording ? (
        <div className="recording-ui premium">
          <div className="recording-status">
            <div className="recording-dot active" />
            <span className="recording-timer">{formatTime(recordingTime)}</span>
          </div>
          <div className="recording-waveform">
            <div className="waveform-bar bar-1" />
            <div className="waveform-bar bar-2" />
            <div className="waveform-bar bar-3" />
            <div className="waveform-bar bar-4" />
            <div className="waveform-bar bar-5" />
            <div className="waveform-bar bar-6" />
            <div className="waveform-bar bar-7" />
          </div>
          <span className="recording-hint pulse">Recording Voice Note...</span>
        </div>
      ) : isUploading ? (
        <div className="recording-ui uploading">
          <div className="upload-spinner" />
          <span className="recording-hint">Optimizing & Uploading...</span>
        </div>
      ) : (
        <form className="chat-input-container" onSubmit={handleSubmit}>
          {showEmojiPicker && <EmojiPicker onEmojiSelect={handleEmojiSelect} />}
          <button 
            type="button" 
            className={`action-btn ${showEmojiPicker ? 'active' : ''}`} 
            style={{ padding: '0 8px 0 0' }} 
            disabled={isUploading}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile size={24} />
          </button>
          <input
            type="text"
            className="chat-input"
            placeholder="Type a message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isUploading}
            onFocus={() => setShowEmojiPicker(false)}
          />
        </form>
      )}

      {isRecording ? (
        <button className="send-button active stop-btn" onClick={stopRecording} title="Stop & Send">
          <Square size={22} fill="currentColor" />
        </button>
      ) : (
        <button 
          className={`send-button ${(text.trim() || isUploading) ? 'active' : ''}`} 
          onClick={text.trim() ? handleSubmit : (isUploading ? undefined : startRecording)}
          title={text.trim() ? "Send" : (isUploading ? "Uploading..." : "Voice Message")}
          disabled={isUploading}
        >
          {text.trim() ? <Send size={24} /> : <Mic size={24} />}
        </button>
      )}
    </div>
  );
};

export default ChatInput;
