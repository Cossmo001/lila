import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { MessageSquare, Phone, Info, X } from 'lucide-react';

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

  return (
    <NotificationContext.Provider value={{ showToast, playTone, stopTone, requestNativePermission, sendNativeNotification }}>
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
