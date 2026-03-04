import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';

// Your web app's Firebase configuration
// Replace the placeholders with your actual keys
const firebaseConfig = {
  apiKey: "AIzaSyBkRhMQiy9AiI6jW2bZUVqfjRAOneTdDsk",
  authDomain: "lila-chat.firebaseapp.com",
  projectId: "lila-chat",
  storageBucket: "lila-chat.firebasestorage.app",
  messagingSenderId: "1010976647627",
  appId: "1:1010976647627:web:a58f6a01dbf1b59082ee4e",
  measurementId: "G-X57HS9W4V7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);
export default app;
