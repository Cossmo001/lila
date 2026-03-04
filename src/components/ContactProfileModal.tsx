import React, { useState } from 'react';
import { X, Edit2, MessageSquare, Phone, Video, Shield, ChevronRight, Volume2, History, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ContactProfileModalProps {
  contact: any;
  onClose: () => void;
}

const ContactProfileModal: React.FC<ContactProfileModalProps> = ({ contact, onClose }) => {
  const { userData, setContactAlias, updateProfile } = useAuth();
  const currentAlias = userData?.contacts?.[contact.uid]?.alias || '';
  const [alias, setAlias] = useState(currentAlias);
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isMuted = userData?.settings?.muted?.[contact.uid] || false;

  const handleToggleMute = async () => {
    try {
      const newSettings = { ...userData?.settings };
      if (!newSettings.muted) newSettings.muted = {};
      newSettings.muted[contact.uid] = !isMuted;
      await updateProfile({ settings: newSettings });
    } catch (err) {
      console.error("Mute toggle error:", err);
    }
  };

  const handleSaveAlias = async () => {
    if (!alias.trim() && !currentAlias) {
      setIsEditingAlias(false);
      return;
    }
    setIsSaving(true);
    try {
      await setContactAlias(contact.uid, alias);
      setIsEditingAlias(false);
    } catch (err) {
      console.error("Save alias error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-modal">
      <header className="modal-header whatsapp-style">
        <button className="close-btn" onClick={onClose}><X size={24} /></button>
        <h2>Contact info</h2>
      </header>

      <div className="profile-scroll-v3">
        {/* Hero Section */}
        <section className="wa-section wa-hero">
          <div className="wa-avatar-container">
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt={contact.username} />
            ) : (
              <div className="avatar-fallback" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-blue)', color: 'white', fontSize: '5rem', fontWeight: 600, width: '100%', height: '100%' }}>
                {contact.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <h1>{currentAlias || contact.username}</h1>
          <p className="wa-phone">~{contact.username}</p>
          
          <div className="wa-action-grid">
            <div className="wa-action-btn" onClick={onClose}>
              <MessageSquare size={22} />
              <span>Message</span>
            </div>
            <div className="wa-action-btn">
              <Phone size={22} />
              <span>Audio</span>
            </div>
            <div className="wa-action-btn">
              <Video size={22} />
              <span>Video</span>
            </div>
          </div>
        </section>

        {/* Nickname Section */}
        <section className="wa-section wa-alias-section">
          <span className="wa-label">Nickname (Only you can see this)</span>
          {isEditingAlias ? (
            <div className="wa-alias-edit">
              <input 
                className="wa-alias-input"
                type="text" 
                value={alias} 
                onChange={e => setAlias(e.target.value)}
                placeholder="Set a private nickname..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveAlias()}
              />
              <div className="wa-alias-actions">
                <button onClick={handleSaveAlias} className="wa-btn-primary" style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#0b141a', fontWeight: 600 }} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setAlias(currentAlias); setIsEditingAlias(false); }} style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="wa-value" style={{ margin: 0, fontWeight: 500 }}>{currentAlias || "No nickname set"}</p>
              <Edit2 size={16} className="wa-chevron" onClick={() => setIsEditingAlias(true)} style={{ cursor: 'pointer', opacity: 0.6 }} />
            </div>
          )}
        </section>

        {/* About Section */}
        <section className="wa-section">
          <span className="wa-label">About</span>
          <p className="wa-value" style={{ color: 'var(--text-main)' }}>Hey there! I am using Kadi.</p>
          <p className="wa-date">Jan 12, 2024</p>
        </section>

        {/* Media Section */}
        <section className="wa-section">
          <div className="wa-media-header" style={{ cursor: 'pointer' }}>
            <span className="wa-label">Media, links and docs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="wa-date" style={{ fontSize: '0.85rem' }}>24</span>
              <ChevronRight size={16} className="wa-chevron" />
            </div>
          </div>
          <div className="wa-media-grid" style={{ marginTop: '12px' }}>
            <div className="wa-media-box" />
            <div className="wa-media-box" />
            <div className="wa-media-box" />
          </div>
        </section>

        {/* Settings List */}
        <section className="wa-section" style={{ padding: '10px 0' }}>
          <div className="wa-list-item" style={{ padding: '16px 30px', cursor: 'pointer' }} onClick={handleToggleMute}>
            <Volume2 className="wa-icon" size={20} style={{ color: isMuted ? 'var(--text-muted)' : 'var(--accent)' }} />
            <div className="wa-item-content">
              <span className="wa-item-title">{isMuted ? 'Unmute notifications' : 'Mute notifications'}</span>
            </div>
            {isMuted && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Muted</span>}
          </div>
          <div className="wa-list-item" style={{ padding: '16px 30px' }}>
            <History className="wa-icon" size={20} />
            <div className="wa-item-content">
              <span className="wa-item-title">Disappearing messages</span>
              <span className="wa-item-desc">Off</span>
            </div>
            <ChevronRight size={16} className="wa-chevron" />
          </div>
          <div className="wa-list-item" style={{ padding: '16px 30px' }}>
            <Lock className="wa-icon" size={20} />
            <div className="wa-item-content">
              <span className="wa-item-title">Encryption</span>
              <span className="wa-item-desc" style={{ fontSize: '0.8rem' }}>Messages and calls are end-to-end encrypted. Click to verify.</span>
            </div>
          </div>
        </section>

        {/* Groups info */}
        <section className="wa-section">
          <span className="wa-label">Groups in common</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
             <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={20} className="wa-icon" />
             </div>
             <span className="wa-item-title" style={{ fontSize: '0.95rem' }}>No groups in common</span>
          </div>
        </section>

        {/* Actions */}
        <section className="wa-section" style={{ padding: '10px 0' }}>
          <div className="wa-danger-item" style={{ padding: '16px 30px' }}>
            <Shield size={20} />
            <span style={{ fontWeight: 500 }}>Block {contact.username}</span>
          </div>
          <div className="wa-danger-item" style={{ padding: '16px 30px' }}>
            <AlertCircle size={20} />
            <span style={{ fontWeight: 500 }}>Report {contact.username}</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContactProfileModal;
