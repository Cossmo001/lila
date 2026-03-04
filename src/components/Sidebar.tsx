import React, { useState, useEffect } from 'react';
import { Search, MessageSquarePlus, Check, CheckCheck, MoreVertical } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  onSelectChat: (chatId: string, recipient: any) => void;
  activeChatId: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ onSelectChat, activeChatId }) => {
  const { user, userData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favorites'>('all');

  // Load existing chats with real-time presence and unread logic
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'), 
      where('participants', 'array-contains', user.uid),
      // orderBy('updatedAt', 'desc') // Temporarily disabled to debug missing index
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const chatList = await Promise.all(snapshot.docs.map(async (chatDoc) => {
          const data = chatDoc.data();
          const recipientUid = data.participants.find((p: string) => p !== user?.uid);
          
          if (!recipientUid) return null;

          // Faster direct document lookup
          const userRef = doc(db, 'users', recipientUid);
          const userDoc = await getDoc(userRef);
          const recipientData = userDoc.exists() ? userDoc.data() : { username: 'Unknown User', uid: recipientUid };

          return {
            id: chatDoc.id,
            ...data,
            recipient: { uid: recipientUid, ...recipientData }
          };
        }));
        setChats(chatList.filter(Boolean));
      } catch (err) {
        console.error("Error processing chats:", err);
      }
    }, (error) => {
      console.error("Chats listener error:", error);
    });
    return unsubscribe;
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    try {
      const q = query(collection(db, 'users'), where('username', '==', searchTerm.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      const results = querySnapshot.docs
        .map(doc => doc.data())
        .filter(u => u.uid !== user?.uid);
      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const startChat = async (recipient: any) => {
    if (!user) return;
    
    const existingChat = chats.find(chat => chat.participants.includes(recipient.uid));
    
    if (existingChat) {
      onSelectChat(existingChat.id, recipient);
      setSearchResults([]);
      setSearchTerm('');
      return;
    }

    const chatId = [user.uid, recipient.uid].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    
    await setDoc(chatRef, {
      id: chatId,
      participants: [user.uid, recipient.uid],
      lastMessage: null,
      updatedAt: serverTimestamp(),
      unreadCount: 0,
      isFavorite: false
    }, { merge: true });

    onSelectChat(chatId, recipient);
    setSearchResults([]);
    setSearchTerm('');
  };

  const filteredChats = chats.filter(chat => {
    if (activeFilter === 'unread') return chat.lastMessage?.senderId !== user?.uid && !chat.lastMessage?.read;
    if (activeFilter === 'favorites') return chat.isFavorite;
    return true;
  });

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatusTicks = (lastMessage: any) => {
    if (!lastMessage || lastMessage.senderId !== user?.uid) return null;
    if (lastMessage.read) return <CheckCheck size={14} color="var(--accent)" style={{ marginRight: '4px' }} />;
    if (lastMessage.delivered) return <CheckCheck size={14} color="var(--text-secondary)" style={{ marginRight: '4px' }} />;
    return <Check size={14} color="var(--text-secondary)" style={{ marginRight: '4px' }} />;
  };

  return (
    <aside className="sidebar">
      <header className="chat-header">
        <div className="header-left">
          <div className="avatar" style={{ background: 'var(--accent-blue)' }}>
            {userData?.avatarUrl ? (
              <img src={userData.avatarUrl} alt="Me" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              userData?.username?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          <span style={{ fontWeight: 600 }}>Chats</span>
        </div>
        <div className="header-actions">
          <button className="action-btn" title="New Chat"><MessageSquarePlus size={20} /></button>
          <button className="action-btn" title="Menu"><MoreVertical size={20} /></button>
        </div>
      </header>

      <div className="search-container">
        <form onSubmit={handleSearch} className="search-bar">
          <Search size={18} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
          <input 
            type="text" 
            placeholder="Search username..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
        <div className="filter-chips">
          <button 
            className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-chip ${activeFilter === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveFilter('unread')}
          >
            Unread
          </button>
          <button 
            className={`filter-chip ${activeFilter === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveFilter('favorites')}
          >
            Favorites
          </button>
        </div>
      </div>

      <div className="chat-list">
        {searchResults.length > 0 && (
          <div className="search-results-section">
            <div className="section-title">PEOPLE</div>
            {searchResults.map(result => (
              <div key={result.uid} className="chat-item" onClick={() => startChat(result)}>
                <div className="avatar" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                  {result.avatarUrl ? (
                    <img src={result.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    result.username[0].toUpperCase()
                  )}
                </div>
                <div className="chat-info">
                  <div className="chat-name">{result.username}</div>
                  <div className="chat-last-msg">Lila user</div>
                </div>
              </div>
            ))}
            <hr className="section-divider" />
          </div>
        )}

        {filteredChats.length === 0 && (
          <div className="empty-chats">
            {activeFilter === 'unread' ? 'No unread messages' : 
             activeFilter === 'favorites' ? 'No favorite chats' : 
             'No chats yet. Search for a username to start messaging!'}
          </div>
        )}

        {filteredChats.map(chat => (
          <div 
            key={chat.id} 
            className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
            onClick={() => onSelectChat(chat.id, chat.recipient)}
          >
            <div className="avatar-container">
              <div className="avatar" style={{ background: 'var(--accent-blue)' }}>
                {chat.recipient?.avatarUrl ? (
                  <img src={chat.recipient.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  chat.recipient?.username?.[0]?.toUpperCase() || '?'
                )}
              </div>
              {chat.recipient?.isOnline && <div className="online-indicator" />}
            </div>
            <div className="chat-info">
              <div className="chat-top">
                <span className="chat-name">
                  {userData?.contacts?.[chat.recipient?.uid]?.alias || chat.recipient?.username}
                </span>
                <span className="chat-time">{formatTime(chat.updatedAt)}</span>
              </div>
              <div className="chat-bottom">
                <p className="chat-last-msg">
                  {renderStatusTicks(chat.lastMessage)}
                  {chat.lastMessage?.text || 'No messages yet'}
                </p>
                {chat.lastMessage?.senderId !== user?.uid && !chat.lastMessage?.read && (
                  <div className="unread-dot" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;

