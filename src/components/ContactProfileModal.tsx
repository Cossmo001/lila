import React, { useState, useEffect } from 'react';
import { X, Edit2, MessageSquare, Phone, Video, Shield, ChevronRight, Volume2, History, Lock, AlertCircle, FileText, ExternalLink, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ContactProfileModalProps {
  contact: any;
  chatId?: string;
  onClose: () => void;
}

const ContactProfileModal: React.FC<ContactProfileModalProps> = ({ contact, chatId, onClose }) => {
  const { userData, setContactAlias, updateProfile } = useAuth();
  const currentAlias = userData?.contacts?.[contact.uid]?.alias || '';
  const [alias, setAlias] = useState(currentAlias);
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isMuted = userData?.settings?.muted?.[contact.uid] || false;

  const [media, setMedia] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'all-media'>('info');
  const [mediaSubTab, setMediaSubTab] = useState<'media' | 'docs' | 'links'>('media');

  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMedia: any[] = [];
      const allDocs: any[] = [];
      const allLinks: any[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'image' || data.type === 'video') {
          allMedia.push({ id: doc.id, ...data });
        } else if (data.type === 'file') {
          allDocs.push({ id: doc.id, ...data });
        } else if (data.type === 'link') {
          allLinks.push({ id: doc.id, ...data });
        }
      });

      setMedia(allMedia);
      setDocs(allDocs);
      setLinks(allLinks);
    });

    return unsubscribe;
  }, [chatId]);

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

  if (activeTab === 'all-media') {
    return (
      <div className="profile-modal">
        <header className="modal-header whatsapp-style">
          <button className="close-btn" onClick={() => setActiveTab('info')}><ChevronLeft size={24} /></button>
          <h2>Media, links and docs</h2>
        </header>
        
        <div className="wa-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-sidebar)' }}>
          <div className={`wa-tab ${mediaSubTab === 'media' ? 'active' : ''}`} onClick={() => setMediaSubTab('media')} style={{ flex: 1, textAlign: 'center', padding: '12px', cursor: 'pointer', borderBottom: mediaSubTab === 'media' ? '3px solid var(--accent)' : 'none', color: mediaSubTab === 'media' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600 }}>Media</div>
          <div className={`wa-tab ${mediaSubTab === 'docs' ? 'active' : ''}`} onClick={() => setMediaSubTab('docs')} style={{ flex: 1, textAlign: 'center', padding: '12px', cursor: 'pointer', borderBottom: mediaSubTab === 'docs' ? '3px solid var(--accent)' : 'none', color: mediaSubTab === 'docs' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600 }}>Docs</div>
          <div className={`wa-tab ${mediaSubTab === 'links' ? 'active' : ''}`} onClick={() => setMediaSubTab('links')} style={{ flex: 1, textAlign: 'center', padding: '12px', cursor: 'pointer', borderBottom: mediaSubTab === 'links' ? '3px solid var(--accent)' : 'none', color: mediaSubTab === 'links' ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600 }}>Links</div>
        </div>

        <div className="profile-scroll-v3" style={{ padding: '16px' }}>
          {mediaSubTab === 'media' && (
            <div className="wa-media-grid">
              {media.map(item => (
                <div key={item.id} className="wa-media-box" style={{ background: 'var(--bg-active)', overflow: 'hidden' }}>
                  {item.type === 'image' ? (
                    <img src={item.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                      <Video size={24} color="white" />
                    </div>
                  )}
                </div>
              ))}
              {media.length === 0 && <p style={{ gridColumn: 'span 3', textAlign: 'center', color: 'var(--text-secondary)', marginTop: '20px' }}>No media shared</p>}
            </div>
          )}

          {mediaSubTab === 'docs' && (
            <div className="wa-docs-list">
              {docs.map(item => (
                <div key={item.id} className="wa-list-item" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ width: '40px', height: '40px', background: '#5f66cd', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} color="white" />
                  </div>
                  <div className="wa-item-content">
                    <span className="wa-item-title" style={{ fontSize: '0.9rem' }}>{item.text || 'Document'}</span>
                    <span className="wa-item-desc" style={{ fontSize: '0.75rem' }}>{item.timestamp?.toDate().toLocaleDateString()}</span>
                  </div>
                  <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    <ExternalLink size={16} />
                  </a>
                </div>
              ))}
              {docs.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '20px' }}>No documents shared</p>}
            </div>
          )}

          {mediaSubTab === 'links' && (
            <div className="wa-links-list">
              {links.map(item => (
                <div key={item.id} className="wa-list-item" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ width: '40px', height: '40px', background: 'var(--bg-active)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ExternalLink size={20} color="var(--accent)" />
                  </div>
                  <div className="wa-item-content">
                    <span className="wa-item-title" style={{ fontSize: '0.9rem', color: 'var(--accent)', textDecoration: 'underline' }}>
                      {item.text}
                    </span>
                    <span className="wa-item-desc" style={{ fontSize: '0.75rem' }}>{item.timestamp?.toDate().toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {links.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '20px' }}>No links shared</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

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
          <div className="wa-media-header" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('all-media')}>
            <span className="wa-label">Media, links and docs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="wa-date" style={{ fontSize: '0.85rem' }}>{media.length + docs.length + links.length}</span>
              <ChevronRight size={16} className="wa-chevron" />
            </div>
          </div>
          <div className="wa-media-grid" style={{ marginTop: '12px' }}>
            {media.slice(0, 3).map(item => (
              <div key={item.id} className="wa-media-box" style={{ background: 'var(--bg-active)', overflow: 'hidden' }}>
                {item.type === 'image' ? (
                  <img src={item.mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                    <Video size={18} color="white" />
                  </div>
                )}
              </div>
            ))}
            {media.length === 0 && (
              <div style={{ gridColumn: 'span 3', padding: '10px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No media shared yet
              </div>
            )}
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
