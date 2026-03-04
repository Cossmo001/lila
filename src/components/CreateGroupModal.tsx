import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Check, Camera, ArrowRight } from 'lucide-react';
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
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);

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
      } finally {
        setIsLoadingRecent(false);
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
            <div className="search-container">
              <form onSubmit={handleSearch} className="search-bar">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Type contact name" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </form>
            </div>

            <div className="contact-list">
              {!searchTerm && recentContacts.length > 0 && (
                <>
                  <div className="section-title">RECENT CONTACTS</div>
                  {recentContacts.map(contact => (
                    <div 
                      key={contact.uid} 
                      className={`contact-item ${selectedContacts.includes(contact.uid) ? 'selected' : ''}`}
                      onClick={() => toggleContact(contact.uid)}
                    >
                      <div className="avatar">
                        {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" /> : contact.username[0].toUpperCase()}
                      </div>
                      <div className="contact-name">{contact.username}</div>
                      <div className="selection-indicator">
                        {selectedContacts.includes(contact.uid) && <Check size={16} />}
                      </div>
                    </div>
                  ))}
                  <hr className="section-divider" />
                </>
              )}
              
              {searchTerm && (
                <>
                  <div className="section-title">SEARCH RESULTS</div>
                  {contacts.map(contact => (
                    <div 
                      key={contact.uid} 
                      className={`contact-item ${selectedContacts.includes(contact.uid) ? 'selected' : ''}`}
                      onClick={() => toggleContact(contact.uid)}
                    >
                      <div className="avatar">
                        {contact.avatarUrl ? <img src={contact.avatarUrl} alt="" /> : contact.username[0].toUpperCase()}
                      </div>
                      <div className="contact-name">{contact.username}</div>
                      <div className="selection-indicator">
                        {selectedContacts.includes(contact.uid) && <Check size={16} />}
                      </div>
                    </div>
                  ))}
                  {contacts.length === 0 && <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>No users found.</div>}
                </>
              )}

              {!searchTerm && recentContacts.length === 0 && !isLoadingRecent && (
                <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6 }}>Search for users to add them.</div>
              )}
            </div>

            {selectedContacts.length > 0 && (
              <div className="panel-footer-actions">
                <button className="fab-btn" onClick={() => setStep(2)}>
                  <ArrowRight size={24} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="group-info-inputs" style={{ padding: '24px' }}>
            <div className="avatar-edit" style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto 40px' }}>
              <div className="large-avatar" style={{ width: '100%', height: '100%' }}>
                <Camera size={48} />
              </div>
              <div className="avatar-overlay" style={{ opacity: 1, background: 'rgba(0,0,0,0.1)' }}>
                <span>ADD GROUP ICON</span>
              </div>
            </div>
            
            <div className="input-group">
              <input 
                type="text" 
                placeholder="Group Subject" 
                autoFocus
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                style={{ borderBottom: '2px solid var(--accent)', borderRadius: 0, background: 'transparent', padding: '12px 0' }}
              />
            </div>

            <div className="panel-footer-actions" style={{ marginTop: '40px', background: 'transparent' }}>
              <button 
                className="fab-btn" 
                disabled={!groupName.trim() || isCreating}
                onClick={handleCreateGroup}
              >
                <Check size={24} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateGroupPanel;
