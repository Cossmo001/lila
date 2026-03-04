import AgoraRTC from "agora-rtc-sdk-ng";

export const AGORA_APP_ID = "bafb9d38b14c4b8f8fe4831de79b836c";

export const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

export const joinChannel = async (channelName: string, uid: string | number | null = null, token: string | null = null) => {
  return await client.join(AGORA_APP_ID, channelName, token, uid);
};

export const leaveChannel = async () => {
  await client.leave();
};

export const createLocalTracks = async (type: 'audio' | 'video' | 'both') => {
  if (type === 'audio') {
    return { audioTrack: await AgoraRTC.createMicrophoneAudioTrack() };
  } else if (type === 'video') {
    return { videoTrack: await AgoraRTC.createCameraVideoTrack() };
  } else {
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    const videoTrack = await AgoraRTC.createCameraVideoTrack();
    return { audioTrack, videoTrack };
  }
};
