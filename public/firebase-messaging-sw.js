importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  // REPLACE THESE with your new project's config!
  apiKey: "AIzaSyB1ZXXNpllmC1NA5dXd6E0k9BXnCLPW-Ns",
  authDomain: "lila-8e550.firebaseapp.com",
  projectId: "lila-8e550",
  storageBucket: "lila-8e550.firebasestorage.app",
  messagingSenderId: "264441686941",
  appId: "1:264441686941:web:55a952e50a46daadfc9d74",
  measurementId: "G-10035YJGK4"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.image || '/pwa-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
