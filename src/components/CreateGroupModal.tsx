import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Check, Camera, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

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

  // Fetch recent contacts from chats
  useEffect(() => {
    if (!user) return;
    const fetchRecent = async () => {
      try {
        const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
        const snap = await getDocs(q);
        const contactUids = new Set<string>();
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (!data.isGroup) {
            const recipientUid = data.participants.find((p: string) => p !== user.uid);
            if (recipientUid) contactUids.add(recipientUid);
          }
        });

        const contactData = await Promise.all(
          Array.from(contactUids).map(async (uid) => {
            const userRef = doc(db, 'users', uid);
            const userDoc = await getDoc(userRef);
            return userDoc.exists() ? { uid, ...userDoc.data() } : null;
          })
        );
        setRecentContacts(contactData.filter(Boolean));
      } catch (err) {
        console.error("Error fetching recent contacts:", err);
      }
    };
    fetchRecent();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    const searchLower = searchTerm.trim().toLowerCase();
    
    const usernameRef = doc(db, 'usernames', searchLower);
    const usernameDoc = await getDoc(usernameRef);
    
    let results: any[] = [];
    if (usernameDoc.exists()) {
      const uid = usernameDoc.data().uid;
      if (uid !== user?.uid) {
        const userRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          results.push({ uid, ...userDoc.data() });
        }
      }
    }

    const q = query(
      collection(db, 'users'),
      where('usernameLower', '>=', searchLower),
      where('usernameLower', '<=', searchLower + '\uf8ff')
    );
    const snap = await getDocs(q);
    const wideResults = snap.docs
      .map(doc => ({ uid: doc.id, ...doc.data() }))
      .filter(c => c.uid !== user?.uid && !results.some(r => r.uid === c.uid));
    
    setContacts([...results, ...wideResults]);
  };

  const toggleContact = (uid: string) => {
    setSelectedContacts(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedContacts.length === 0 || !user) return;
    setIsCreating(true);
    try {
      const groupId = `group_${Date.now()}`;
      const groupData = {
        id: groupId,
        isGroup: true,
        participants: [user.uid, ...selectedContacts],
        groupMetadata: {
          name: groupName,
          createdBy: user.uid,
          admins: [user.uid],
          description: ''
        },
        updatedAt: serverTimestamp(),
        lastMessage: {
          text: `${userData?.username || 'Someone'} created the group "${groupName}"`,
          senderId: 'system',
          timestamp: serverTimestamp()
        }
      };

      await setDoc(doc(db, 'chats', groupId), groupData);
      
      await setDoc(doc(db, 'chats', groupId, 'messages', 'init'), {
        text: `${userData?.username || 'Someone'} created the group "${groupName}"`,
        senderId: 'system',
        timestamp: serverTimestamp(),
        type: 'text'
      });

      onGroupCreated(groupData);
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
              {selectedContacts.map(uid => {
                const contact = [...recentContacts, ...contacts].find(c => c.uid === uid);
                if (!contact) return null;
                return (
                  <div key={uid} className="selected-avatar-mini" style={{ position: 'relative', flexShrink: 0 }}>
                    <div className="avatar" style={{ width: '40px', height: '40px', fontSize: '0.8rem' }}>
                      {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" /> : contact.username[0].toUpperCase()}
                    </div>
                    <button 
                      className="remove-selection" 
                      onClick={() => toggleContact(uid)}
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
                      key={contact.uid} 
                      className={`contact-item ${selectedContacts.includes(contact.uid) ? 'selected' : ''}`}
                      onClick={() => toggleContact(contact.uid)}
                      style={{ padding: '12px 24px' }}
                    >
                      <div className="avatar">
                        {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" /> : contact.username[0].toUpperCase()}
                      </div>
                      <div className="contact-info-small" style={{ flex: 1, marginLeft: '16px' }}>
                        <div className="contact-name" style={{ fontWeight: 400 }}>{contact.username}</div>
                        <div className="contact-status" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Hey there! I am using Kadi.</div>
                      </div>
                      <div className="selection-indicator">
                        <div className={`custom-checkbox ${selectedContacts.includes(contact.uid) ? 'checked' : ''}`} style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedContacts.includes(contact.uid) ? 'var(--accent)' : 'transparent' }}>
                          {selectedContacts.includes(contact.uid) && <Check size={14} color="#0b141a" />}
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
                      key={contact.uid} 
                      className={`contact-item ${selectedContacts.includes(contact.uid) ? 'selected' : ''}`}
                      onClick={() => toggleContact(contact.uid)}
                      style={{ padding: '12px 24px' }}
                    >
                      <div className="avatar">
                        {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" /> : contact.username[0].toUpperCase()}
                      </div>
                      <div className="contact-info-small" style={{ flex: 1, marginLeft: '16px' }}>
                        <div className="contact-name" style={{ fontWeight: 400 }}>{contact.username}</div>
                      </div>
                      <div className="selection-indicator">
                        <div className={`custom-checkbox ${selectedContacts.includes(contact.uid) ? 'checked' : ''}`} style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedContacts.includes(contact.uid) ? 'var(--accent)' : 'transparent' }}>
                          {selectedContacts.includes(contact.uid) && <Check size={14} color="#0b141a" />}
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
              <div className="large-avatar-whatsapp" style={{ width: '200px', height: '200px', borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                <Camera size={48} className="text-secondary" />
                <div className="avatar-overlay-hover" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}>
                  <Camera size={32} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, marginTop: '8px' }}>ADD GROUP ICON</span>
                </div>
              </div>
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
