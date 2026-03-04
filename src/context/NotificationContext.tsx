import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, Phone, Info, X } from 'lucide-react';
import { getToken, onMessage } from 'firebase/messaging';
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
  requestNativePermission: () => Promise<boolean>;
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

  const requestNativePermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn("This browser does not support desktop notifications");
      return false;
    }
    
    if (Notification.permission === 'granted') return true;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  const sendNativeNotification = useCallback(async (title: string, options?: NotificationOptions) => {
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
    if (!user?.uid || !messaging) return;
    
    try {
      const permission = await requestNativePermission();
      if (!permission) return;

      const currentToken = await getToken(messaging, {
        vapidKey: 'BGNA0Dcd-RVPIozjD4PvSSzf7vZEMvOXgl88uCa5ykH-WlgKsYDfb2UC6_JIhN7_S-xmLrsksyURN1rCHRexo_c'
      });

      if (currentToken) {
        // Only update if the token has actually changed to avoid infinite loops with userData listeners
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        if (userData?.fcmToken !== currentToken) {
          await updateDoc(doc(db, 'users', user.uid), {
            fcmToken: currentToken,
            lastTokenSync: new Date()
          });
          console.log("FCM Token synced successfully");
        } else {
          console.log("FCM Token already up to date");
        }
      }
    } catch (err) {
      console.error("FCM Token sync failed:", err);
    }
  }, [user?.uid, requestNativePermission]);

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
