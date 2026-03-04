importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBkRhMQiy9AiI6jW2bZUVqfjRAOneTdDsk",
  authDomain: "lila-chat.firebaseapp.com",
  projectId: "lila-chat",
  storageBucket: "lila-chat.firebasestorage.app",
  messagingSenderId: "1010976647627",
  appId: "1:1010976647627:web:a58f6a01dbf1b59082ee4e"
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
