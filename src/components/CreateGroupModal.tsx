import React, { useState } from 'react';
import { X, Search, Check, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface CreateGroupModalProps {
  onClose: () => void;
  onGroupCreated: (groupData: any) => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose, onGroupCreated }) => {
  const { user, userData } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Load contacts (for simplicity, we search users)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    const searchLower = searchTerm.trim().toLowerCase();
    const q = query(
      collection(db, 'users'),
      where('usernameLower', '>=', searchLower),
      where('usernameLower', '<=', searchLower + '\uf8ff')
    );
    const snap = await getDocs(q);
    setContacts(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })).filter(c => c.uid !== user?.uid));
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
      
      // Also add initial system message to subcollection
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

  return (
    <div className="modal-overlay">
      <div className="modal-content premium-modal">
        <header className="modal-header">
          <h2>New Group</h2>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </header>

        <div className="modal-body">
          <div className="group-info-inputs">
            <div className="group-avatar-upload">
              <div className="avatar-placeholder">
                <Camera size={32} />
              </div>
            </div>
            <div className="input-group">
              <input 
                type="text" 
                placeholder="Group Subject" 
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
            </div>
          </div>

          <div className="contact-selection">
            <div className="section-title">ADD MEMBERS ({selectedContacts.length})</div>
            <form onSubmit={handleSearch} className="search-bar" style={{ marginBottom: '16px' }}>
              <Search size={18} />
              <input 
                type="text" 
                placeholder="Search contacts..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </form>

            <div className="contact-list scroll-v">
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
            </div>
          </div>
        </div>

        <footer className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button 
            className="save-btn" 
            disabled={!groupName.trim() || selectedContacts.length === 0 || isCreating}
            onClick={handleCreateGroup}
          >
            {isCreating ? 'Creating...' : 'Create Group'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CreateGroupModal;
