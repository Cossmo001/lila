import React, { useState, useEffect } from 'react';
import { X, UserMinus, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, getDoc } from 'firebase/firestore';

interface GroupInfoModalProps {
  group: any;
  onClose: () => void;
}

const GroupInfoModal: React.FC<GroupInfoModalProps> = ({ group, onClose }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const isAdmin = group.groupMetadata?.admins?.includes(user?.uid);

  useEffect(() => {
    const fetchMembers = async () => {
      const memberData = await Promise.all(group.participants.map(async (uid: string) => {
        const userDoc = await getDoc(doc(db, 'users', uid));
        return userDoc.exists() ? { uid, ...userDoc.data() } : { uid, username: 'Unknown' };
      }));
      setMembers(memberData);
    };
    fetchMembers();
  }, [group.participants]);

  const handleAddMember = async (newMember: any) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'chats', group.id), {
        participants: arrayUnion(newMember.uid),
        updatedAt: serverTimestamp()
      });
      setSearchResults([]);
      setSearchTerm('');
      alert(`${newMember.username} added to group`);
    } catch (err) {
      console.error("Error adding member:", err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try {
      const searchLower = searchTerm.trim().toLowerCase();
      
      // Exact match check
      const usernameRef = doc(db, 'usernames', searchLower);
      const usernameDoc = await getDoc(usernameRef);
      
      const results: any[] = [];
      if (usernameDoc.exists()) {
        const uid = usernameDoc.data().uid;
        if (!group.participants.includes(uid)) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            results.push({ uid, ...userDoc.data() });
          }
        }
      }

      // Prefix search
      const q = query(
        collection(db, 'users'),
        where('usernameLower', '>=', searchLower),
        where('usernameLower', '<=', searchLower + '\uf8ff')
      );
      const snap = await getDocs(q);
      const wideResults = snap.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter(u => !group.participants.includes(u.uid) && !results.some(r => r.uid === u.uid));
        
      setSearchResults([...results, ...wideResults]);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRemoveMember = async (memberUid: string) => {
    if (!isAdmin || memberUid === user?.uid) return;
    try {
      await updateDoc(doc(db, 'chats', group.id), {
        participants: arrayRemove(memberUid),
        'groupMetadata.admins': arrayRemove(memberUid),
        updatedAt: serverTimestamp()
      });
      alert('Member removed successfully');
    } catch (err) {
      console.error("Error removing member:", err);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    if (confirm('Are you sure you want to leave this group?')) {
      try {
        await updateDoc(doc(db, 'chats', group.id), {
          participants: arrayRemove(user.uid),
          'groupMetadata.admins': arrayRemove(user.uid),
          updatedAt: serverTimestamp()
        });
        onClose();
      } catch (err) {
        console.error("Error leaving group:", err);
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content premium-modal">
        <header className="modal-header">
          <h2>Group Info</h2>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </header>

        <div className="modal-body scroll-v">
          <div className="profile-hero">
            <div className="profile-avatar large">
              {group.groupMetadata?.photoURL ? <img src={group.groupMetadata.photoURL} alt="" /> : group.groupMetadata.name[0].toUpperCase()}
            </div>
            <h1>{group.groupMetadata.name}</h1>
            <p>Group • {group.participants.length} members</p>
          </div>

          {isAdmin && (
            <section className="wa-section" style={{ padding: '16px' }}>
              <div className="section-title">ADD MEMBER</div>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Enter username" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-primary)' }}
                />
                <button type="submit" disabled={isSearching} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  Search
                </button>
              </form>
              
              {isSearching && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Searching...</p>}
              
              <div className="search-results scroll-v" style={{ maxHeight: '150px' }}>
                {searchResults.map(result => (
                  <div key={result.uid} className="member-item" style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px dotted var(--glass-border)' }}>
                     <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px', marginRight: '8px' }}>
                        {result.avatarUrl ? <img src={result.avatarUrl} alt="" /> : result.username[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.9rem', flex: 1 }}>{result.username}</span>
                      <button 
                        onClick={() => handleAddMember(result)}
                        style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        Add
                      </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="wa-section">
            <div className="section-title">MEMBERS</div>
            <div className="member-list">
              {members.map(member => (
                <div key={member.uid} className="member-item" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--glass-border)' }}>
                  <div className="avatar" style={{ marginRight: '12px' }}>
                    {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : member.username[0].toUpperCase()}
                  </div>
                  <div className="member-info" style={{ flex: 1 }}>
                    <div className="member-name" style={{ fontWeight: 500 }}>
                      {member.username} {member.uid === user?.uid && '(You)'}
                    </div>
                    {group.groupMetadata.admins.includes(member.uid) && (
                      <div className="admin-badge" style={{ fontSize: '0.7rem', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '1px 4px', display: 'inline-block', marginTop: '2px' }}>
                        Group Admin
                      </div>
                    )}
                  </div>
                  {isAdmin && member.uid !== user?.uid && (
                    <button 
                      onClick={() => handleRemoveMember(member.uid)}
                      style={{ background: 'none', border: 'none', color: '#ff4b4b', cursor: 'pointer' }}
                      title="Remove member"
                    >
                      <UserMinus size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="wa-section" style={{ marginTop: '20px' }}>
            <div 
              className="wa-danger-item" 
              style={{ padding: '16px 30px', cursor: 'pointer', color: '#ff4b4b' }}
              onClick={handleLeaveGroup}
            >
              <LogOut size={20} />
              <span style={{ fontWeight: 500 }}>Leave Group</span>
            </div>
            {isAdmin && (
              <div 
                className="wa-danger-item" 
                style={{ padding: '16px 30px', cursor: 'pointer', color: '#ff4b4b' }}
              >
                <Trash2 size={20} />
                <span style={{ fontWeight: 500 }}>Delete Group</span>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;
