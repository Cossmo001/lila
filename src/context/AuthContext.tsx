import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

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
    let profileSubscription: any;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      console.log("Auth State Change:", { event: _event, userId: currentUser?.id });
      setUser(currentUser);

      if (currentUser) {
        console.log("Fetching profile for:", currentUser.id);
        // Fetch initial profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          console.error("Profile fetch error:", error);
        }

        if (profile) {
          console.log("Profile loaded:", profile.username);
          setUserData(profile);
        } else {
          console.warn("No profile found for user!");
        }

        // Subscribe to profile changes
        profileSubscription = supabase
          .channel(`profile:${currentUser.id}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${currentUser.id}` 
          }, (payload) => {
            console.log("Profile Real-time change:", payload.new);
            setUserData((prev: any) => ({ ...prev, ...payload.new }));
          })
          .subscribe();
        } else {
          setUserData(null);
          if (profileSubscription) profileSubscription.unsubscribe();
        }
        setLoading(false);
      });

    return () => {
      subscription.unsubscribe();
      if (profileSubscription) profileSubscription.unsubscribe();
    };
  }, []);

  // Dedicated presence management
  useEffect(() => {
    if (!user) return;

    const handlePresence = async () => {
      const isHidden = document.visibilityState === 'hidden';
      await supabase
        .from('profiles')
        .update({ 
          status: isHidden ? 'offline' : 'online', 
          last_seen: new Date().toISOString() 
        })
        .eq('id', user.id);
    };

    document.addEventListener('visibilitychange', handlePresence);
    return () => {
      document.removeEventListener('visibilitychange', handlePresence);
    };
  }, [user]);

  const updateProfile = async (data: Partial<any>) => {
    if (!user) return;
    
    // 1. Update Profile Table
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: user.id,
        ...data, 
        updated_at: new Date().toISOString() 
      });
    
    if (profileError) throw profileError;

    // 2. Sync to auth metadata to ensure consistency across triggers
    if (data.username || data.avatar_url) {
      await supabase.auth.updateUser({
        data: {
          ...(data.username ? { username: data.username } : {}),
          ...(data.avatar_url ? { avatar_url: data.avatar_url } : {})
        }
      });
    }
  };

  const setContactAlias = async (contactUid: string, alias: string) => {
    if (!user || !userData) return;
    const updatedContacts = { 
      ...(userData.contacts || {}), 
      [contactUid]: { ...((userData.contacts || {})[contactUid] || {}), alias } 
    };
    await updateProfile({ contacts: updatedContacts });
  };

  const blockUser = async (contactUid: string) => {
    if (!user || !userData) return;
    const updatedBlocked = { 
      ...(userData.blocked_users || {}), 
      [contactUid]: true 
    };
    await updateProfile({ blocked_users: updatedBlocked });
  };

  const unblockUser = async (contactUid: string) => {
    if (!user || !userData) return;
    const updatedBlocked = { ...(userData.blocked_users || {}) };
    delete updatedBlocked[contactUid];
    await updateProfile({ blocked_users: updatedBlocked });
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, updateProfile, setContactAlias, blockUser, unblockUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
