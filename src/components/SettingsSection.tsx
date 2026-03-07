import React, { useState, useRef } from 'react';
import { User, Bell, Shield, LogOut, Camera, Check, X, ChevronLeft, ChevronRight, MessageSquare, Moon, Image as ImageIcon, UserX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useNotification } from '../context/NotificationContext';


type SubView = 'main' | 'account' | 'privacy' | 'notifications' | 'chats' | 'wallpaper';

const SettingsSection: React.FC = () => {
  const { user, userData, updateProfile, unblockUser } = useAuth();
  const { requestNativePermission, refreshNotifications } = useNotification();
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
    if (!file || !user?.id) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      await updateProfile({ avatar_url: publicUrl });
    } catch (err: any) {
      console.error("Upload avatar error:", err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `wallpapers/${user.id}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const newSettings = { ...userData?.settings };
      if (!newSettings.chats) newSettings.chats = {};
      newSettings.chats.wallpaper = { type: 'image', value: publicUrl };
      
      await updateProfile({ settings: newSettings });
      setSubView('chats');
    } catch (err: any) {
      console.error("Upload wallpaper error:", err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const setWallpaperColor = async (color: string) => {
    try {
      const newSettings = { ...userData?.settings };
      if (!newSettings.chats) newSettings.chats = {};
      newSettings.chats.wallpaper = { type: 'color', value: color };
      await updateProfile({ settings: newSettings });
    } catch (err) {
      console.error("Set wallpaper color error:", err);
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

  const handleThemeToggle = async () => {
    const isDark = userData?.settings?.theme !== 'light';
    const newTheme = isDark ? 'light' : 'dark';
    try {
      await updateProfile({
        settings: {
          ...userData?.settings,
          theme: newTheme
        }
      });
    } catch (err) {
      console.error("Theme toggle error:", err);
    }
  };

  const renderMainSettings = () => (
    <div className="fade-in">
      <div className="profile-card" onClick={() => setIsEditingProfile(true)} style={{ cursor: 'pointer' }}>
        <div className="large-avatar">
          {userData?.avatar_url ? (
            <img src={userData.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
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
        <div className="settings-item logout" onClick={() => supabase.auth.signOut()}>
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
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{user?.id}</span>
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
      
      <div className="section-title" style={{ marginTop: '20px' }}>Blocked Contacts</div>
      <div className="settings-list">
        {userData?.blocked_users && Object.keys(userData.blocked_users).length > 0 ? (
          Object.keys(userData.blocked_users).map(uid => (
            <div key={uid} className="settings-item">
              <UserX size={20} className="settings-icon" color="#ff4b4b" />
              <div className="settings-text">
                <span>{userData.contacts?.[uid]?.alias || uid}</span>
              </div>
              <button 
                onClick={() => unblockUser(uid)}
                className="wa-btn-secondary"
                style={{ marginLeft: 'auto', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Unblock
              </button>
            </div>
          ))
        ) : (
          <p style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No blocked contacts</p>
        )}
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
      
      <div className="settings-item" style={{ marginTop: '20px' }} onClick={async () => {
        if (confirm("This will re-request all permissions and refresh your notification IDs. Continue?")) {
          localStorage.removeItem(`permissions_handled_${user?.id}`);
          await refreshNotifications();
          window.location.reload(); // Force reload to trigger the overlay check
        }
      }}>
        <div className="settings-text">
          <span style={{ color: 'var(--accent)' }}>Force Refresh Permissions</span>
          <p>Reset and re-request all device permissions.</p>
        </div>
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
          <input 
            type="checkbox" 
            checked={userData?.settings?.theme !== 'light'} 
            onChange={handleThemeToggle} 
          />
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
      <div className="settings-item" onClick={() => setSubView('wallpaper')}>
        <ImageIcon size={20} className="settings-icon" />
        <div className="settings-text">
          <span>Chat Wallpaper</span>
          <p>Choose a color or upload an image</p>
        </div>
        <ChevronRight size={18} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
      </div>
    </div>
  );

  const renderWallpaperSelection = () => {
    const premiumColors = [
      '#0a1219', '#111b21', '#202c33', '#232d36', '#2a3942', 
      '#075e54', '#128c7e', '#0b141a', '#1c2e35', '#2c3e50',
      '#1a1a1a', '#2d3436', '#636e72', '#2d3436', '#000000'
    ];

    return (
      <div className="fade-in">
        <div className="wallpaper-preview-container">
           <div className="wallpaper-preview" style={{ 
              background: userData?.settings?.chats?.wallpaper?.type === 'color' ? userData.settings.chats.wallpaper.value : undefined,
              backgroundImage: userData?.settings?.chats?.wallpaper?.type === 'image' ? `url(${userData.settings.chats.wallpaper.value})` : undefined,
           }}>
              <div className="preview-bubble me">Preview your wallpaper</div>
              <div className="preview-bubble them">Looks great!</div>
           </div>
        </div>

        <div className="settings-item" onClick={() => fileInputRef.current?.click()}>
          <ImageIcon size={20} className="settings-icon" />
          <div className="settings-text">
            <span>{isUploading ? 'Uploading...' : 'Upload Custom Wallpaper'}</span>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleWallpaperUpload} accept="image/*" style={{ display: 'none' }} />
        </div>

        <div className="section-title">Solid Colors</div>
        <div className="color-grid">
          {premiumColors.map(color => (
            <div 
              key={color} 
              className={`color-option ${userData?.settings?.chats?.wallpaper?.value === color ? 'active' : ''}`}
              style={{ background: color }}
              onClick={() => setWallpaperColor(color)}
            >
              {userData?.settings?.chats?.wallpaper?.value === color && <Check size={16} color="white" />}
            </div>
          ))}
        </div>
        
        <div className="settings-item" style={{ marginTop: '20px' }} onClick={() => setWallpaperColor('')}>
          <div className="settings-text">
             <span style={{ color: 'var(--accent)' }}>Reset to Default</span>
          </div>
        </div>
      </div>
    );
  };

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
              ) : userData?.avatar_url ? (
                <img src={userData.avatar_url} alt="Avatar" />
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
        {subView === 'wallpaper' && renderWallpaperSelection()}
      </div>
    </div>
  );
};

export default SettingsSection;
