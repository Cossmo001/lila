import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Check, Camera, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useRef } from 'react';

interface CreateGroupPanelProps {
  onClose: () => void;
  onGroupCreated: (groupData: any) => void;
}

const CreateGroupPanel: React.FC<CreateGroupPanelProps> = ({ onClose, onGroupCreated }) => {
  const { user, userData } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [recentContacts, setRecentContacts] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch recent contacts from chats
  useEffect(() => {
    if (!user) return;
    const fetchRecent = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_participants')
          .select(`
            chat:chats (
              is_group,
              participants:chat_participants (
                user:profiles (*)
              )
            )
          `)
          .eq('user_id', user.id);

        if (error) throw error;

        const contactMap = new Map();
        data.forEach((item: any) => {
          if (!item.chat.is_group) {
            const recipient = item.chat.participants.find((p: any) => p.user.id !== user.id);
            if (recipient) {
              contactMap.set(recipient.user.id, recipient.user);
            }
          }
        });

        setRecentContacts(Array.from(contactMap.values()));
      } catch (err) {
        console.error("Error fetching recent contacts:", err);
      }
    };
    fetchRecent();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchTerm.trim()}%`)
        .neq('id', user?.id)
        .limit(20);

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedContacts.length === 0 || !user) return;
    setIsCreating(true);
    try {
      let icon_url = '';
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const filePath = `group_icons/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, selectedFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);
        
        icon_url = publicUrl;
      }

      // 1. Create chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          is_group: true,
          name: groupName,
          icon_url,
          created_by: user.id
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // 2. Add participants
      const participants = [user.id, ...selectedContacts].map(uid => ({
        chat_id: newChat.id,
        user_id: uid
      }));

      await supabase
        .from('chat_participants')
        .insert(participants);

      // 3. System message
      const systemMessage = {
        chat_id: newChat.id,
        sender_id: user.id, // Or a dedicated system user ID if you have one
        text: `${userData?.username || 'Someone'} created the group "${groupName}"`,
        type: 'text'
      };

      await supabase
        .from('messages')
        .insert(systemMessage);

      // Format for UI expectations
      const groupDataForUI = {
        ...newChat,
        participants: [user.id, ...selectedContacts]
      };

      onGroupCreated(groupDataForUI);
      onClose();
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Failed to create group.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      onClose();
    }
  };

  return (
    <div className="sidebar-panel-container">
      <header className="sidebar-panel-header">
        <div className="panel-header-content">
          <button className="action-btn" onClick={handleBack}><ArrowLeft size={24} /></button>
          <div className="panel-info">
            <h2 className="panel-title">{step === 1 ? 'Add group members' : 'New group'}</h2>
          </div>
        </div>
      </header>

      <div className="sidebar-panel-body scroll-v">
        {step === 1 ? (
          <>
            <div className="search-container" style={{ padding: '12px 16px', background: 'var(--bg-sidebar)' }}>
              <form onSubmit={handleSearch} className="search-bar">
                <Search size={18} className="text-secondary" />
                <input 
                  type="text" 
                  placeholder="Type contact name" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ fontSize: '0.95rem' }}
                />
              </form>
            </div>

            <div className="selected-contacts-stripe" style={{ padding: '8px 16px', display: 'flex', gap: '8px', overflowX: 'auto', background: 'var(--bg-sidebar)', minHeight: selectedContacts.length > 0 ? '60px' : '0' }}>
              {selectedContacts.map(id => {
                const contact = [...recentContacts, ...contacts].find(c => c.id === id);
                if (!contact) return null;
                return (
                  <div key={id} className="selected-avatar-mini" style={{ position: 'relative', flexShrink: 0 }}>
                    <div className="avatar" style={{ background: 'var(--bg-active)' }}>
                      {contact.avatar_url ? (
                        <img src={contact.avatar_url} alt="" />
                      ) : contact.username[0]}
                    </div>
                    <button 
                      className="remove-selection" 
                      onClick={() => toggleContact(id)}
                      style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--bg-deep)', borderRadius: '50%', border: '1px solid var(--glass-border)', padding: '2px', display: 'flex' }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="contact-list">
              {!searchTerm && recentContacts.length > 0 && (
                <>
                  <div className="section-title" style={{ padding: '16px 24px 8px', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>RECENT CONTACTS</div>
                  {recentContacts.map(contact => (
                    <div 
                      key={contact.id} 
                      className={`contact-item ${selectedContacts.includes(contact.id) ? 'selected' : ''}`}
                      onClick={() => toggleContact(contact.id)}
                      style={{ padding: '12px 24px' }}
                    >
                      <div className="avatar">
                        {contact.avatar_url ? <img src={contact.avatar_url} alt="" /> : contact.username[0].toUpperCase()}
                      </div>
                      <div className="contact-info-small" style={{ flex: 1, marginLeft: '16px' }}>
                        <div className="contact-name" style={{ fontWeight: 400 }}>{contact.username}</div>
                        <div className="contact-status" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Hey there! I am using Lila.</div>
                      </div>
                      <div className="selection-indicator">
                        <div className={`custom-checkbox ${selectedContacts.includes(contact.id) ? 'checked' : ''}`} style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedContacts.includes(contact.id) ? 'var(--accent)' : 'transparent' }}>
                          {selectedContacts.includes(contact.id) && <Check size={14} color="#0b141a" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  <hr className="section-divider" style={{ margin: '8px 0', opacity: 0.1 }} />
                </>
              )}
              
              {searchTerm && (
                <>
                  <div className="section-title" style={{ padding: '16px 24px 8px', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>SEARCH RESULTS</div>
                  {contacts.map(contact => (
                    <div 
                      key={contact.id} 
                      className={`contact-item ${selectedContacts.includes(contact.id) ? 'selected' : ''}`}
                      onClick={() => toggleContact(contact.id)}
                      style={{ padding: '12px 24px' }}
                    >
                      <div className="avatar">
                        {contact.avatar_url ? <img src={contact.avatar_url} alt="" /> : contact.username[0].toUpperCase()}
                      </div>
                      <div className="contact-info-small" style={{ flex: 1, marginLeft: '16px' }}>
                        <div className="contact-name" style={{ fontWeight: 400 }}>{contact.username}</div>
                      </div>
                      <div className="selection-indicator">
                        <div className={`custom-checkbox ${selectedContacts.includes(contact.id) ? 'checked' : ''}`} style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedContacts.includes(contact.id) ? 'var(--accent)' : 'transparent' }}>
                          {selectedContacts.includes(contact.id) && <Check size={14} color="#0b141a" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  {contacts.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', opacity: 0.6 }}>No users found.</div>}
                </>
              )}
            </div>

            {selectedContacts.length > 0 && (
              <div className="panel-footer-actions" style={{ position: 'sticky', bottom: 0, padding: '30px', background: 'transparent', display: 'flex', justifyContent: 'center' }}>
                <button className="fab-btn" onClick={() => setStep(2)} style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent)', color: '#0b141a', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  <ArrowRight size={28} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="group-info-inputs" style={{ padding: '32px 24px' }}>
            <div className="avatar-edit-large" style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
              <div 
                className="large-avatar-whatsapp" 
                onClick={() => fileInputRef.current?.click()}
                style={{ width: '200px', height: '200px', borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '1px solid var(--glass-border)' }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Camera size={48} className="text-secondary" />
                )}
                <div className="avatar-overlay-hover" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: previewUrl ? 0 : 1, transition: 'opacity 0.2s' }}>
                  <Camera size={32} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, marginTop: '8px' }}>{previewUrl ? 'CHANGE ICON' : 'ADD GROUP ICON'}</span>
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
            </div>
            
            <div className="input-group-modern" style={{ borderBottom: '2px solid var(--accent)', paddingBottom: '8px' }}>
              <input 
                type="text" 
                placeholder="Group Subject" 
                autoFocus
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '1.1rem' }}
              />
            </div>
            <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Provide a group subject and optional group icon</p>

            <div className="panel-footer-actions" style={{ marginTop: '60px', display: 'flex', justifyContent: 'center' }}>
              <button 
                className="fab-btn" 
                disabled={!groupName.trim() || isCreating}
                onClick={handleCreateGroup}
                style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent)', color: '#0b141a', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', opacity: !groupName.trim() || isCreating ? 0.6 : 1 }}
              >
                <Check size={28} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateGroupPanel;
