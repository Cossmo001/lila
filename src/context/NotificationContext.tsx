import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, Phone, Info, X } from 'lucide-react';
import { getToken, onMessage } from 'firebase/messaging';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { messaging, db } from '../lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

type NotificationType = 'message' | 'call' | 'info';

interface Toast {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  avatarUrl?: string;
  duration?: number;
}

interface NotificationContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  playTone: (type: 'incoming' | 'outgoing' | 'call', loop?: boolean) => void;
  stopTone: (type: 'incoming' | 'outgoing' | 'call') => void;
  requestNativePermission: (prompt?: boolean) => Promise<boolean>;
  sendNativeNotification: (title: string, options?: NotificationOptions) => void;
  syncFCMToken: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Audio URLs (Public/Safe sources)
const TONES = {
  incoming: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3', // Simple pop/ping
  outgoing: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3', // Subtle click
  call: 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3', // Ringing sound
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);

    if (toast.duration !== 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toast.duration || 5000);
    }
  }, []);

  const playTone = useCallback((type: keyof typeof TONES, loop: boolean = false) => {
    if (!audioRefs.current[type]) {
      audioRefs.current[type] = new Audio(TONES[type]);
    }
    
    const audio = audioRefs.current[type];
    audio.currentTime = 0;
    audio.loop = loop;
    audio.play().catch(err => console.error("Audio play failed:", err));
  }, []);

  const stopTone = useCallback((type: keyof typeof TONES) => {
    const audio = audioRefs.current[type];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const requestNativePermission = useCallback(async (prompt: boolean = true) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const pushStatus = await PushNotifications.checkPermissions();
        const localStatus = await LocalNotifications.checkPermissions();
        
        if (pushStatus.receive === 'granted' && localStatus.display === 'granted') return true;
        if (!prompt) return false;
        
        const pushResult = await PushNotifications.requestPermissions();
        const localResult = await LocalNotifications.requestPermissions();
        
        return pushResult.receive === 'granted' || localResult.display === 'granted';
      } catch (err) {
        console.error("Native permission request failed:", err);
        return false;
      }
    }

    if (!('Notification' in window)) {
      console.warn("This browser does not support desktop notifications");
      return false;
    }
    
    if (Notification.permission === 'granted') return true;
    if (!prompt) return false;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const sendNativeNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body: options?.body || '',
              id: Math.floor(Math.random() * 1000000),
              extra: options?.data,
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor: '#3abcf4',
              sound: 'beep.wav'
            }
          ]
        });
      } catch (err) {
        console.error("Capacitor LocalNotification failed:", err);
      }
      return;
    }

    if (Notification.permission === 'granted' && document.hidden) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          vibrate: [200, 100, 200],
          ...options
        } as any);
      } catch (err) {
        console.error("Service Worker notification failed, falling back to window.Notification:", err);
        // Fallback for browsers without service worker active/supported
        new Notification(title, {
          icon: '/pwa-192x192.png',
          ...options
        });
      }
    }
  }, []);

  const { user } = useAuth();

  const syncFCMToken = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      // Only attempt to sync if permissions are already granted (don't prompt on mount)
      const permission = await requestNativePermission(false);
      if (!permission) return;

      let currentToken = '';

      if (Capacitor.isNativePlatform()) {
        // For native, we register and wait for the listener (handled in useEffect)
        // or we can use a promise-based approach if the plugin supports it
        await PushNotifications.register();
        return; // Token will be synced via the listener below
      } else if (messaging) {
        currentToken = await getToken(messaging, {
          vapidKey: 'BGNA0Dcd-RVPIozjD4PvSSzf7vZEMvOXgl88uCa5ykH-WlgKsYDfb2UC6_JIhN7_S-xmLrsksyURN1rCHRexo_c'
        });
      }

      if (currentToken) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        if (userData?.fcmToken !== currentToken) {
          await updateDoc(doc(db, 'users', user.uid), {
            fcmToken: currentToken,
            lastTokenSync: new Date()
          });
          console.log("FCM Token synced successfully");
        }
      }
    } catch (err) {
      console.error("FCM Token sync failed:", err);
    }
  }, [user?.uid, requestNativePermission]);

  // Listen for native push notifications and token registration
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user?.uid) return;

    let registrationListener: any;
    let registrationErrorListener: any;
    let pushNotificationReceivedListener: any;
    let pushNotificationActionPerformedListener: any;

    const setupListeners = async () => {
      registrationListener = await PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data();
          if (userData?.fcmToken !== token.value) {
            await updateDoc(doc(db, 'users', user.uid), {
              fcmToken: token.value,
              lastTokenSync: new Date()
            });
          }
        } catch (err) {
          console.error("Failed to sync native FCM token:", err);
        }
      });

      registrationErrorListener = await PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error: ', error.error);
      });

      pushNotificationReceivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received: ', notification);
        showToast({
          type: 'message',
          title: notification.title || 'New Message',
          message: notification.body || '',
          avatarUrl: notification.data?.avatarUrl
        });
        playTone('incoming');
      });

      pushNotificationActionPerformedListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed: ', notification);
      });
    };

    setupListeners();

    return () => {
      registrationListener?.remove();
      registrationErrorListener?.remove();
      pushNotificationReceivedListener?.remove();
      pushNotificationActionPerformedListener?.remove();
    };
  }, [user?.uid, showToast, playTone]);

  // Listen for foreground messages
  useEffect(() => {
    if (!messaging) return;
    
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      if (payload.notification) {
        showToast({
          type: 'message',
          title: payload.notification.title || 'New Notification',
          message: payload.notification.body || '',
          avatarUrl: payload.notification.image
        });
        playTone('incoming');
      }
    });

    return () => unsubscribe();
  }, [showToast, playTone]);

  return (
    <NotificationContext.Provider value={{ showToast, playTone, stopTone, requestNativePermission, sendNativeNotification, syncFCMToken }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-notification premium-toast ${toast.type}-toast`}>
            {toast.avatarUrl ? (
              <div className="toast-avatar">
                <img src={toast.avatarUrl} alt="" />
                <div className="toast-type-badge">
                  {toast.type === 'message' && <MessageSquare size={10} />}
                  {toast.type === 'call' && <Phone size={10} />}
                </div>
              </div>
            ) : (
              <div className="toast-icon-circle">
                {toast.type === 'message' && <MessageSquare size={20} />}
                {toast.type === 'call' && <Phone size={20} />}
                {toast.type === 'info' && <Info size={20} />}
              </div>
            )}
            <div className="toast-content">
              <div className="toast-header-row">
                <span className="toast-title">{toast.title}</span>
                <span className="toast-tag">{toast.type}</span>
              </div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button 
              className="toast-close" 
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
