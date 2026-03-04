import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';

// Your web app's Firebase configuration
// Replace the placeholders with your actual keys
const firebaseConfig = {
  apiKey: "AIzaSyB1ZXXNpllmC1NA5dXd6E0k9BXnCLPW-Ns",
  authDomain: "lila-8e550.firebaseapp.com",
  projectId: "lila-8e550",
  storageBucket: "lila-8e550.firebasestorage.app",
  messagingSenderId: "264441686941",
  appId: "1:264441686941:web:55a952e50a46daadfc9d74",
  measurementId: "G-10035YJGK4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled
        // in one tab at a a time.
        console.warn('Firestore persistence failed: failed-precondition');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence
        console.warn('Firestore persistence failed: unimplemented');
    }
});

let messagingInstance = null;
try {
  messagingInstance = getMessaging(app);
} catch (e) {
  console.warn("Firebase Messaging not supported in this environment:", e);
}

export const messaging = messagingInstance;
export default app;
