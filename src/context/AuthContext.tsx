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
  blockUser: (contactUid: string) => Promise<void>;
  unblockUser: (contactUid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true,
  updateProfile: async () => {},
  setContactAlias: async () => {},
  blockUser: async () => {},
  unblockUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUserData: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Cleanup previous user data listener if it exists
      if (unsubUserData) {
        unsubUserData();
        unsubUserData = undefined;
      }

      setUser(user);
      try {
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          
          // Real-time listener for userData
          unsubUserData = onSnapshot(userRef, async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              setUserData({ ...data, uid: user.uid });
              
              // Auto-fix: Ensure legacy users have usernameLower for search
              if (data.username && !data.usernameLower) {
                console.log("Auto-fixing legacy user: adding usernameLower");
                try {
                  await updateDoc(userRef, {
                    usernameLower: data.username.toLowerCase()
                  });
                } catch (e) {
                  console.error("Failed to auto-fix legacy user:", e);
                }
              }
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
        } else {
          setUserData(null);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserData) unsubUserData();
    };
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

  const blockUser = async (contactUid: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      [`blockedUsers.${contactUid}`]: true,
      updatedAt: serverTimestamp()
    });
  };

  const unblockUser = async (contactUid: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      [`blockedUsers.${contactUid}`]: null,
      updatedAt: serverTimestamp()
    });
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, updateProfile, setContactAlias, blockUser, unblockUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
