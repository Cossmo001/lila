import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Video, VideoOff } from 'lucide-react';
import { useAgora } from '../context/AgoraContext';

interface CallOverlayProps {
  status: 'ringing' | 'connecting' | 'active';
  type: 'audio' | 'video';
  recipient: {
    username: string;
    avatarUrl?: string;
  };
  isIncoming?: boolean;
  onEndCall: () => void;
  onAccept?: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ status, type: initialType, recipient, isIncoming, onEndCall, onAccept }) => {
  const { localVideoTrack, remoteUsers, muteAudio, muteVideo } = useAgora();
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

  return (
    <div className={`call-overlay fade-in ${type === 'video' ? 'video-mode' : ''} ${status === 'ringing' ? 'is-ringing' : ''}`}>
      {/* Immersive Blurred Background */}
      <div 
        className="call-background-premium" 
        style={{ backgroundImage: recipient.avatarUrl ? `url(${recipient.avatarUrl})` : 'none' }} 
      />
      <div className="call-overlay-gradient" />
      
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
            {status === 'ringing' ? (isIncoming ? 'Incoming Video Call' : 'Ringing...') : 
             status === 'connecting' ? 'Connecting...' : 
             type === 'audio' ? formatTime(timer) : 'Video Call'}
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
