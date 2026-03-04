import { useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { PushNotifications } from '@capacitor/push-notifications';

export interface PermissionStatus {
  camera: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'limited' | 'unknown';
  microphone: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'limited' | 'unknown';
  notifications: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'limited' | 'unknown';
  storage: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'limited' | 'unknown';
}

export const usePermissionManager = () => {
  const [status, setStatus] = useState<PermissionStatus>({
    camera: 'unknown',
    microphone: 'unknown',
    notifications: 'unknown',
    storage: 'unknown',
  });

  const checkPermissions = useCallback(async () => {
    const isNative = Capacitor.isNativePlatform();
    const newStatus: PermissionStatus = { ...status };

    try {
      if (isNative) {
        // Native (Capacitor)
        const cameraPerm = await Camera.checkPermissions();
        newStatus.camera = cameraPerm.camera;

        const fsPerm = await Filesystem.checkPermissions();
        newStatus.storage = fsPerm.publicStorage;

        const pushPerm = await PushNotifications.checkPermissions();
        newStatus.notifications = pushPerm.receive;
        
        // Microphone is often bundled with Camera or handled via getUserMedia
        // For standard Capacitor, we might need a specific plugin for just mic, 
        // but often we just request it via getUserMedia which works on both.
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const hasMic = devices.some(d => d.kind === 'audioinput');
          newStatus.microphone = hasMic ? 'prompt' : 'denied';
        }
      } else {
        // Web
        if ('Notification' in window) {
          newStatus.notifications = Notification.permission as any;
        }

        if (navigator.permissions) {
          const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
          newStatus.camera = cam.state as any;

          const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          newStatus.microphone = mic.state as any;
          
          // Storage permission query is not standard in all browsers
        }
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
    }

    setStatus(newStatus);
    return newStatus;
  }, [status]);

  const requestAll = useCallback(async () => {
    const isNative = Capacitor.isNativePlatform();
    const results: Partial<PermissionStatus> = {};

    try {
      // 1. Notifications
      if (isNative) {
        const res = await PushNotifications.requestPermissions();
        results.notifications = res.receive;
      } else if ('Notification' in window) {
        const res = await Notification.requestPermission();
        results.notifications = res as any;
      }

      // 2. Camera & Microphone
      // on Web, requesting both together is common
      if (!isNative) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          stream.getTracks().forEach(track => track.stop());
          results.camera = 'granted';
          results.microphone = 'granted';
        } catch (err) {
          console.error('Camera/Mic request failed:', err);
          results.camera = 'denied';
          results.microphone = 'denied';
        }
      } else {
        // Native Camera
        const camRes = await Camera.requestPermissions();
        results.camera = camRes.camera;
        
        // Native Mic - Capacitor doesn't have a standalone 'Microphone' plugin in the core,
        // but we can trigger a getUserMedia call even on native if it's a WebView with permissions.
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
          results.microphone = 'granted';
        } catch (err) {
          results.microphone = 'denied';
        }

        // Native Storage
        const fsRes = await Filesystem.requestPermissions();
        results.storage = fsRes.publicStorage;
      }

      setStatus(prev => ({ ...prev, ...results }));
      return results;
    } catch (err) {
      console.error('Error requesting permissions:', err);
      return results;
    }
  }, []);

  return {
    status,
    checkPermissions,
    requestAll,
  };
};
