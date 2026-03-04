import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  updateProfile: (data: Partial<any>) => Promise<void>;
  setContactAlias: (contactUid: string, alias: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true,
  updateProfile: async () => {},
  setContactAlias: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUserData: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // Real-time listener for userData
        unsubUserData = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserData({ ...snapshot.data(), uid: user.uid });
          }
        });

        // Set online status
        await updateDoc(userRef, {
          isOnline: true,
          lastSeen: serverTimestamp()
        });

        // Handle window close / disconnect
        const handlePresence = () => {
          if (document.visibilityState === 'hidden') {
            updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
          } else {
            updateDoc(userRef, { isOnline: true, lastSeen: serverTimestamp() });
          }
        };

        document.addEventListener('visibilitychange', handlePresence);
        window.addEventListener('beforeunload', () => {
          updateDoc(userRef, { isOnline: false, lastSeen: serverTimestamp() });
        });
      } else {
        setUserData(null);
      }
      setLoading(false);

      return () => {
        if (unsubUserData) unsubUserData();
      };
    });

    return unsubscribe;
  }, []);

  const updateProfile = async (data: Partial<any>) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  };

  const setContactAlias = async (contactUid: string, alias: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      [`contacts.${contactUid}.alias`]: alias,
      updatedAt: serverTimestamp()
    });
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, updateProfile, setContactAlias }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

