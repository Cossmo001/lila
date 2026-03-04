import React, { createContext, useContext, useEffect, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { AGORA_APP_ID } from '../lib/agora';

interface AgoraContextType {
  client: IAgoraRTCClient;
  localAudioTrack: IMicrophoneAudioTrack | null;
  localVideoTrack: ICameraVideoTrack | null;
  remoteUsers: any[];
  join: (channelName: string, type: 'audio' | 'video') => Promise<void>;
  leave: () => Promise<void>;
  muteAudio: (mute: boolean) => void;
  muteVideo: (mute: boolean) => void;
}

const AgoraContext = createContext<AgoraContextType | null>(null);

export const useAgora = () => {
  const context = useContext(AgoraContext);
  if (!context) throw new Error('useAgora must be used within an AgoraProvider');
  return context;
};

export const AgoraProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client] = useState(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);

  // Use refs to avoid stale closures in listeners and leave function
  const audioTrackRef = React.useRef<IMicrophoneAudioTrack | null>(null);
  const videoTrackRef = React.useRef<ICameraVideoTrack | null>(null);

  useEffect(() => {
    const handleUserPublished = async (user: any, mediaType: 'audio' | 'video') => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
      }
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    };

    const handleUserUnpublished = (user: any) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);

    return () => {
      client.off('user-published', handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
    };
  }, [client]);

  const join = React.useCallback(async (channelName: string, type: 'audio' | 'video') => {
    // Cleanup any existing tracks before joining
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current.close();
      audioTrackRef.current = null;
    }
    if (videoTrackRef.current) {
      videoTrackRef.current.stop();
      videoTrackRef.current.close();
      videoTrackRef.current = null;
    }

    await client.join(AGORA_APP_ID, channelName, null, null);
    
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    audioTrackRef.current = audioTrack;
    setLocalAudioTrack(audioTrack);
    
    if (type === 'video') {
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      videoTrackRef.current = videoTrack;
      setLocalVideoTrack(videoTrack);
      await client.publish([audioTrack, videoTrack]);
    } else {
      await client.publish(audioTrack);
    }
  }, [client]);

  const leave = React.useCallback(async () => {
    console.log('AgoraContext: Leaving channel and closing tracks...');
    
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current.close();
      audioTrackRef.current = null;
    }
    if (videoTrackRef.current) {
      videoTrackRef.current.stop();
      videoTrackRef.current.close();
      videoTrackRef.current = null;
    }

    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    
    try {
      await client.leave();
    } catch (e) {
      console.error('Error leaving Agora client:', e);
    }
    
    setRemoteUsers([]);
  }, [client]);

  const muteAudio = React.useCallback((mute: boolean) => {
    audioTrackRef.current?.setEnabled(!mute);
  }, []);

  const muteVideo = React.useCallback((mute: boolean) => {
    videoTrackRef.current?.setEnabled(!mute);
  }, []);

  return (
    <AgoraContext.Provider value={{ client, localAudioTrack, localVideoTrack, remoteUsers, join, leave, muteAudio, muteVideo }}>
      {children}
    </AgoraContext.Provider>
  );
};
