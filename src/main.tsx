import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext';
import { AgoraProvider } from './context/AgoraContext';
import { NotificationProvider } from './context/NotificationContext';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <AgoraProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AgoraProvider>
    </AuthProvider>
  </React.StrictMode>
);
