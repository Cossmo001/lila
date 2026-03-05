import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Video, VideoOff, Minimize2, Maximize2 } from 'lucide-react';
import { useAgora } from '../context/AgoraContext';

interface CallOverlayProps {
  status: 'ringing' | 'connecting' | 'active';
  type: 'audio' | 'video';
  recipient: {
    username: string;
    avatarUrl?: string;
  };
  isIncoming?: boolean;
  isMinimized?: boolean;
  onEndCall: () => void;
  onAccept?: () => void;
  onMinimize?: () => void;
  onRestore?: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ 
  status, 
  type: initialType, 
  recipient, 
  isIncoming, 
  isMinimized,
  onEndCall, 
  onAccept,
  onMinimize,
  onRestore
}) => {
  const { localVideoTrack, remoteUsers, muteAudio, muteVideo, connectionState, networkQuality } = useAgora();
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [type, setType] = useState(initialType);
  const [timer, setTimer] = useState(0);

  const localVideoRef = React.useRef<HTMLDivElement>(null);
  const remoteVideoRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'active' && type === 'video') {
      if (localVideoTrack && localVideoRef.current) {
        localVideoTrack.play(localVideoRef.current);
      }
      if (remoteUsers.length > 0 && remoteUsers[0].videoTrack && remoteVideoRef.current) {
        remoteUsers[0].videoTrack.play(remoteVideoRef.current);
      }
    }
    
    return () => {
      // Agora tracks cleanup is handled by AgoraContext, 
      // but we should ensure playback is stopped when component resets
    };
  }, [status, type, localVideoTrack, remoteUsers]);

  const handleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    muteAudio(newState);
  };

  const handleVideoToggle = () => {
    const newType = type === 'audio' ? 'video' : 'audio';
    setType(newType);
    muteVideo(newType === 'audio');
  };

  useEffect(() => {
    let interval: number;
    if (status === 'active') {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (status === 'ringing') return isIncoming ? 'Incoming Video Call' : 'Ringing...';
    if (status === 'connecting') return 'Connecting...';
    
    // During active call, check connection health
    if (connectionState === 'RECONNECTING' || networkQuality >= 5) {
      return 'Reconnecting...';
    }
    
    if (networkQuality === 4) {
      return 'Poor connection...';
    }

    return type === 'audio' ? formatTime(timer) : 'Video Call';
  };

  if (isMinimized) {
    return (
      <div className="call-minimized-bubble" onClick={onRestore}>
        <div className="mini-avatar-wrapper">
          {recipient.avatarUrl ? (
            <img src={recipient.avatarUrl} alt={recipient.username} className="mini-avatar-img" />
          ) : (
            <div className="mini-avatar-placeholder">{recipient.username[0].toUpperCase()}</div>
          )}
          <div className="mini-status-dot pulse" />
        </div>
        <div className="mini-call-info">
          <span className="mini-name">{recipient.username}</span>
          <span className="mini-timer">{status === 'active' ? formatTime(timer) : 'Calling...'}</span>
        </div>
        <button className="mini-restore-btn">
          <Maximize2 size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className={`call-overlay fade-in ${type === 'video' ? 'video-mode' : ''} ${status === 'ringing' ? 'is-ringing' : ''}`}>
      {/* Immersive Blurred Background */}
      <div 
        className="call-background-premium" 
        style={{ backgroundImage: recipient.avatarUrl ? `url(${recipient.avatarUrl})` : 'none' }} 
      />
      <div className="call-overlay-gradient" />
      
      <button className="minimize-btn-top" onClick={onMinimize} title="Minimize">
        <Minimize2 size={24} />
      </button>

      {status === 'active' && type === 'video' && (
        <div className="video-streams-premium">
          <div ref={remoteVideoRef} className="remote-video-premium" />
          <div className="video-status-overlay">
            <span className="live-badge">LIVE</span>
            <span className="call-timer-overlay">{formatTime(timer)}</span>
          </div>
          <div ref={localVideoRef} className="local-video-pip" />
        </div>
      )}

      <div className="call-info-section">
        <div className="call-profile">
          {(type === 'audio' || status === 'ringing') && (
            <div className={`avatar-premium ${status === 'ringing' ? 'pulse-animation' : ''}`} style={{ background: 'var(--accent-blue)' }}>
              {recipient.avatarUrl ? (
                <img src={recipient.avatarUrl} alt={recipient.username} />
              ) : (
                <span className="avatar-initial">{recipient.username[0].toUpperCase()}</span>
              )}
            </div>
          )}
          <h1 className="caller-name">{recipient.username}</h1>
          <div className="call-status-text">
            {getStatusText()}
          </div>
        </div>
      </div>

      <div className={`call-controls-wrapper ${type === 'video' && status === 'active' ? 'controls-floating' : ''}`}>
        <div className="call-controls-glass">
          {isIncoming && status === 'ringing' ? (
            <div className="call-actions-row">
              <button className="control-btn accept" onClick={onAccept} title="Accept">
                {type === 'audio' ? <Phone size={32} /> : <Video size={32} />}
              </button>
              <button className="control-btn decline" onClick={onEndCall} title="Decline">
                <PhoneOff size={32} />
              </button>
            </div>
          ) : (
            <div className="call-actions-row">
              <button 
                className={`control-btn ${isMuted ? 'active' : ''}`} 
                onClick={handleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              <button 
                className={`control-btn ${type === 'video' ? 'active' : ''}`} 
                onClick={handleVideoToggle}
                title={type === 'audio' ? "Switch to Video" : "Switch to Audio"}
              >
                {type === 'video' ? <Video size={24} /> : <VideoOff size={24} />}
              </button>

              <button 
                className={`control-btn ${isSpeaker ? 'active' : ''}`} 
                onClick={() => setIsSpeaker(!isSpeaker)}
                title="Speaker"
              >
                <Volume2 size={24} />
              </button>

              <button className="control-btn end-call-premium" onClick={onEndCall} title="End Call">
                <PhoneOff size={28} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
