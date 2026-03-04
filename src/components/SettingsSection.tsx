import React, { useState, useRef } from 'react';
import { User, Bell, Shield, LogOut, Camera, Check, X, ChevronLeft, ChevronRight, MessageSquare, Moon } from 'lucide-react';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';

type SubView = 'main' | 'account' | 'privacy' | 'notifications' | 'chats';

const SettingsSection: React.FC = () => {
  const { user, userData, updateProfile } = useAuth();
  const { requestNativePermission } = useNotification();
  const [subView, setSubView] = useState<SubView>('main');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempUsername, setTempUsername] = useState(userData?.username || '');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = async () => {
    try {
      await updateProfile({ username: tempUsername });
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Save profile error:", err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.uid}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      await updateProfile({ avatarUrl: publicUrl });
    } catch (err: any) {
      console.error("Upload avatar error:", err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSetting = async (category: string, key: string, currentValue: boolean) => {
    try {
      const newSettings = { ...userData?.settings };
      if (!newSettings[category]) newSettings[category] = {};
      newSettings[category][key] = !currentValue;
      
      await updateProfile({ settings: newSettings });
    } catch (err) {
      console.error("Toggle setting error:", err);
    }
  };

  const handleToggleDesktopNotifications = async () => {
    const isCurrentlyOn = userData?.settings?.notifications?.desktop !== false;
    if (!isCurrentlyOn) {
      const granted = await requestNativePermission();
      if (!granted) {
        alert("Notification permission was denied by the browser. Please enable it in your browser settings.");
        return;
      }
    }
    await toggleSetting('notifications', 'desktop', isCurrentlyOn);
  };

  const renderMainSettings = () => (
    <div className="fade-in">
      <div className="profile-card" onClick={() => setIsEditingProfile(true)} style={{ cursor: 'pointer' }}>
        <div className="large-avatar">
          {userData?.avatarUrl ? (
            <img src={userData.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            userData?.username?.[0]?.toUpperCase()
          )}
        </div>
        <div className="profile-info">
          <h2>{userData?.username || 'User'}</h2>
          <p>{userData?.about || 'Available'}</p>
        </div>
        <ChevronRight size={20} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
      </div>

      <div className="settings-list">
        <div className="settings-item" onClick={() => setSubView('account')}>
          <User size={20} className="settings-icon" />
          <div className="settings-text">
            <span>Account</span>
            <p>Security notifications, change number</p>
          </div>
          <ChevronRight size={18} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
        </div>
        <div className="settings-item" onClick={() => setSubView('privacy')}>
          <Shield size={20} className="settings-icon" />
          <div className="settings-text">
            <span>Privacy</span>
            <p>Block contacts, disappearing messages</p>
          </div>
          <ChevronRight size={18} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
        </div>
        <div className="settings-item" onClick={() => setSubView('notifications')}>
          <Bell size={20} className="settings-icon" />
          <div className="settings-text">
            <span>Notifications</span>
            <p>Message, group & call tones</p>
          </div>
          <ChevronRight size={18} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
        </div>
        <div className="settings-item" onClick={() => setSubView('chats')}>
          <MessageSquare size={20} className="settings-icon" />
          <div className="settings-text">
            <span>Chats</span>
            <p>Theme, wallpapers, chat history</p>
          </div>
          <ChevronRight size={18} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
        </div>
        <hr className="section-divider" />
        <div className="settings-item logout" onClick={() => auth.signOut()}>
          <LogOut size={20} className="settings-icon" />
          <div className="settings-text">
            <span>Logout</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAccount = () => (
    <div className="fade-in">
      <div className="sub-view-item">
        <label>EMAIL</label>
        <span>{user?.email}</span>
      </div>
      <div className="sub-view-item">
        <label>USER ID</label>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{user?.uid}</span>
      </div>
      <div className="settings-item" style={{ marginTop: '20px', color: '#ff4b4b' }}>
        <Shield size={20} className="settings-icon" color="#ff4b4b" />
        <div className="settings-text">
          <span style={{ color: '#ff4b4b' }}>Security Notifications</span>
        </div>
        <label className="switch">
          <input type="checkbox" checked={userData?.settings?.account?.securityNotify} onChange={() => toggleSetting('account', 'securityNotify', userData?.settings?.account?.securityNotify)} />
          <span className="slider"></span>
        </label>
      </div>
    </div>
  );

  const renderPrivacy = () => (
    <div className="fade-in">
      <div className="settings-item">
        <div className="settings-text">
          <span>Last Seen & Online</span>
          <p>Everyone</p>
        </div>
        <ChevronRight size={18} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
      </div>
      <div className="settings-item">
        <div className="settings-text">
          <span>Read Receipts</span>
          <p>If turned off, you won't send or receive read receipts.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={userData?.settings?.privacy?.readReceipts !== false} onChange={() => toggleSetting('privacy', 'readReceipts', userData?.settings?.privacy?.readReceipts !== false)} />
          <span className="slider"></span>
        </label>
      </div>
      <div className="settings-item">
        <div className="settings-text">
          <span>Groups</span>
          <p>Everyone</p>
        </div>
        <ChevronRight size={18} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="fade-in">
      <div className="settings-item">
        <div className="settings-text">
          <span>Conversation Tones</span>
          <p>Play sounds for incoming and outgoing messages.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={userData?.settings?.notifications?.tones !== false} onChange={() => toggleSetting('notifications', 'tones', userData?.settings?.notifications?.tones !== false)} />
          <span className="slider"></span>
        </label>
      </div>
      <div className="settings-item">
        <div className="settings-text">
          <span>High Priority Notifications</span>
          <p>Show previews of notifications at the top of the screen.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={userData?.settings?.notifications?.priority !== false} onChange={() => toggleSetting('notifications', 'priority', userData?.settings?.notifications?.priority !== false)} />
          <span className="slider"></span>
        </label>
      </div>
      <div className="settings-item">
        <div className="settings-text">
          <span>Desktop Notifications</span>
          <p>Show notifications even when the browser is minimized or in the background.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={userData?.settings?.notifications?.desktop !== false} onChange={handleToggleDesktopNotifications} />
          <span className="slider"></span>
        </label>
      </div>
    </div>
  );

  const renderChats = () => (
    <div className="fade-in">
      <div className="settings-item">
        <Moon size={20} className="settings-icon" />
        <div className="settings-text">
          <span>Dark Mode</span>
        </div>
        <label className="switch">
          <input type="checkbox" checked={true} disabled />
          <span className="slider"></span>
        </label>
      </div>
      <div className="settings-item">
        <div className="settings-text">
          <span>Enter is Send</span>
        </div>
        <label className="switch">
          <input type="checkbox" checked={userData?.settings?.chats?.enterIsSend !== false} onChange={() => toggleSetting('chats', 'enterIsSend', userData?.settings?.chats?.enterIsSend !== false)} />
          <span className="slider"></span>
        </label>
      </div>
    </div>
  );

  if (isEditingProfile) {
    return (
      <div className="section-container fade-in">
        <header className="section-header">
           <div className="mobile-back" onClick={() => setIsEditingProfile(false)} style={{ display: 'flex' }}>
            <ChevronLeft size={24} />
          </div>
          <h1>Edit Profile</h1>
        </header>
        <div className="section-content" style={{ padding: '20px' }}>
          <div className="avatar-edit" onClick={() => fileInputRef.current?.click()} style={{ margin: '0 auto 30px' }}>
            <div className="large-avatar">
              {isUploading ? (
                <div className="upload-spinner" />
              ) : userData?.avatarUrl ? (
                <img src={userData.avatarUrl} alt="Avatar" />
              ) : (
                userData?.username?.[0]?.toUpperCase()
              )}
            </div>
            <div className="avatar-overlay">
              <Camera size={24} />
              <span>Change</span>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
          </div>

          <div className="input-group">
            <label>Username</label>
            <input type="text" value={tempUsername} onChange={(e) => setTempUsername(e.target.value)} placeholder="Enter your name" />
          </div>

          <div className="edit-actions" style={{ marginTop: '30px' }}>
            <button className="save-btn" onClick={handleSaveProfile} disabled={isUploading}>
              <Check size={18} style={{ marginRight: '8px' }} /> Save Changes
            </button>
            <button className="cancel-btn" onClick={() => setIsEditingProfile(false)}>
              <X size={18} style={{ marginRight: '8px' }} /> Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container fade-in">
      <header className="section-header">
        {subView !== 'main' && (
          <div className="mobile-back" onClick={() => setSubView('main')} style={{ display: 'flex' }}>
            <ChevronLeft size={24} />
          </div>
        )}
        <h1 style={{ textTransform: 'capitalize' }}>{subView === 'main' ? 'Settings' : subView}</h1>
      </header>
      
      <div className="section-content">
        {subView === 'main' && renderMainSettings()}
        {subView === 'account' && renderAccount()}
        {subView === 'privacy' && renderPrivacy()}
        {subView === 'notifications' && renderNotifications()}
        {subView === 'chats' && renderChats()}
      </div>
    </div>
  );
};

export default SettingsSection;
