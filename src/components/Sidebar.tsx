import React, { useState, useEffect } from 'react';
import { Search, MessageSquarePlus, Check, CheckCheck, MoreVertical, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import CreateGroupPanel from './CreateGroupModal';

interface SidebarProps {
  onSelectChat: (chat: any) => void;
  activeChatId: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ onSelectChat, activeChatId }) => {
  const { user, userData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favorites'>('all');
  const [currentPanel, setCurrentPanel] = useState<'chats' | 'new-group'>('chats');

  // Load existing chats with real-time updates
  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_participants')
          .select(`
            chat_id,
            unread_count,
            chat:chats (
              *,
              last_message:messages(content, sender_id, created_at, type, is_read)
            )
          `)
          .eq('user_id', user.id);

        if (error) {
          console.error("Error fetching chats:", error);
          return;
        }

        if (!data) return;

        const formattedChats = data.map((item: any) => {
          try {
            const chat = item.chat;
            if (!chat) return null;

            const lastMsgRaw = chat.last_message?.[0];
            let previewText = lastMsgRaw?.content || '';
            if (lastMsgRaw?.type === 'image') previewText = `📷 Photo${previewText ? ': ' + previewText : ''}`;
            else if (lastMsgRaw?.type === 'video') previewText = `🎥 Video${previewText ? ': ' + previewText : ''}`;
            else if (lastMsgRaw?.type === 'audio') previewText = `🎵 Audio`;
            else if (lastMsgRaw?.type === 'file') previewText = `📄 Document`;

            const lastMsg = lastMsgRaw ? {
              ...lastMsgRaw,
              text: previewText,
              sender_id: lastMsgRaw.sender_id,
              is_read: lastMsgRaw.is_read
            } : null;

            const recipientParticipant = chat.participants?.find((p: any) => p.user && p.user.id !== user.id);
            
            const baseChat = {
              id: chat.id,
              ...chat,
              unread_count: item.unread_count || 0,
              last_message: lastMsg,
              recipient: recipientParticipant?.user
            };

            if (chat.is_group) {
              return { ...baseChat, name: chat.name || 'Unnamed Group' };
            }
            
            return baseChat;
          } catch (err) {
            console.error("Error formatting individual chat:", err, item);
            return null;
          }
        }).filter(Boolean);

        setChats(formattedChats.sort((a, b) => {
          const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          if (isNaN(timeA) || isNaN(timeB)) return 0;
          return timeB - timeA;
        }));
      } catch (err) {
        console.error("Global Sidebar fetch error:", err);
      }
    };

    fetchChats();

    const setupSubscriptions = async () => {
      const chatChannel = supabase
        .channel('sidebar-chats')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => fetchChats())
        .subscribe();

      const msgChannel = supabase
        .channel('sidebar-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchChats())
        .subscribe();

      const participantChannel = supabase
        .channel('sidebar-participants')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'chat_participants',
          filter: `user_id=eq.${user.id}`
        }, () => fetchChats())
        .subscribe();

      return () => {
        supabase.removeChannel(chatChannel);
        supabase.removeChannel(msgChannel);
        supabase.removeChannel(participantChannel);
      };
    };

    const cleanup = setupSubscriptions();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchTerm.trim()}%`)
        .neq('id', user?.id)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const startChat = async (recipient: any) => {
    if (!user) return;
    
    // Check if chat already exists
    const existingChat = chats.find(chat => 
      !chat.is_group && chat.recipient?.id === recipient.id
    );
    
    if (existingChat) {
      onSelectChat(existingChat);
      setSearchResults([]);
      setSearchTerm('');
      return;
    }

    try {
      // 1. Create chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({ is_group: false })
        .select()
        .single();

      if (chatError) throw chatError;

      // 2. Add participants
      await supabase
        .from('chat_participants')
        .insert([
          { chat_id: newChat.id, user_id: user.id },
          { chat_id: newChat.id, user_id: recipient.id }
        ]);

      const chatWithRecipient = {
        ...newChat,
        recipient
      };

      onSelectChat(chatWithRecipient);
      setSearchResults([]);
      setSearchTerm('');
    } catch (err) {
      console.error("Error starting chat:", err);
    }
  };

  const filteredChats = chats.filter(chat => {
    // Note: unread logic needs backend or junction flags in Supabase
    if (activeFilter === 'unread') return chat.unread_count > 0; 
    if (activeFilter === 'favorites') return chat.is_favorite;
    return true;
  });

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatusTicks = (lastMessage: any) => {
    if (!lastMessage || lastMessage.sender_id !== user?.id) return null;
    if (lastMessage.is_read) return <CheckCheck size={14} color="var(--accent)" style={{ marginRight: '4px' }} />;
    if (lastMessage.delivered) return <CheckCheck size={14} color="var(--text-secondary)" style={{ marginRight: '4px' }} />;
    return <Check size={14} color="var(--text-secondary)" style={{ marginRight: '4px' }} />;
  };

  if (currentPanel === 'new-group') {
    return (
      <aside className="sidebar">
        <CreateGroupPanel 
          onClose={() => setCurrentPanel('chats')} 
          onGroupCreated={(groupData) => {
            onSelectChat(groupData);
            setCurrentPanel('chats');
          }}
        />
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <header className="chat-header">
        <div className="header-left">
          <div className="avatar" style={{ background: 'var(--accent-blue)' }}>
            {userData?.avatar_url ? (
              <img src={userData.avatar_url} alt="Me" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              userData?.username?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          <span style={{ fontWeight: 600 }}>Chats</span>
        </div>
        <div className="header-actions">
          <button className="action-btn" title="New Chat" onClick={() => setActiveFilter('all')}><MessageSquarePlus size={20} /></button>
          <button className="action-btn" title="New Group" onClick={() => setCurrentPanel('new-group')}><Users size={20} /></button>
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

      <div className="chat-list scroll-v">
        {(isSearching || hasSearched) && (
          <div className="search-results-section">
            <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="section-title">PEOPLE</div>
              {hasSearched && !isSearching && (
                <button 
                  className="close-search" 
                  onClick={() => { setHasSearched(false); setSearchResults([]); setSearchTerm(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px' }}
                >
                  Clear
                </button>
              )}
            </div>

            {isSearching ? (
              <div className="search-status" style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map(result => (
                <div key={result.id} className="chat-item" onClick={() => startChat(result)}>
                  <div className="avatar" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                    {result.avatar_url ? (
                      <img src={result.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      result.username[0].toUpperCase()
                    )}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">{result.username}</div>
                    <div className="chat-last-msg">Kadi user</div>
                  </div>
                </div>
              ))
            ) : hasSearched ? (
              <div className="search-status" style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                No users found matching "{searchTerm}"
              </div>
            ) : null}
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
            className={`active-item chat-item ${activeChatId === chat.id ? 'active' : ''}`}
            onClick={() => onSelectChat(chat)}
          >
            <div className="avatar-container">
              <div className="avatar" style={{ background: chat.is_group ? 'var(--accent-purple)' : 'var(--accent-blue)' }}>
                {chat.is_group ? (
                  chat.icon_url ? <img src={chat.icon_url} alt="" /> : <Users size={20} />
                ) : chat.recipient?.avatar_url ? (
                  <img src={chat.recipient.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  chat.recipient?.username?.[0]?.toUpperCase() || '?'
                )}
              </div>
              {!chat.is_group && chat.recipient?.status === 'online' && <div className="online-indicator" />}
            </div>
            <div className="chat-info">
              <div className="chat-top">
                <span className="chat-name">
                  {chat.is_group ? chat.name : (userData?.contacts?.[chat.recipient?.id]?.alias || chat.recipient?.username)}
                </span>
                <span className="chat-time">{formatTime(chat.updated_at)}</span>
              </div>
              <div className="chat-bottom">
                <p className="chat-last-msg">
                  {renderStatusTicks(chat.last_message)}
                  {chat.last_message?.text || 'No messages yet'}
                </p>
                {chat.unread_count > 0 && chat.last_message?.sender_id !== user?.id && (
                  <div className="unread-badge" style={{ 
                    background: 'var(--accent)', 
                    color: '#0b141a', 
                    borderRadius: '50%', 
                    padding: '2px 6px', 
                    fontSize: '0.7rem', 
                    fontWeight: 700,
                    minWidth: '20px',
                    textAlign: 'center'
                  }}>
                    {chat.unread_count}
                  </div>
                )}
                {(!chat.unread_count || chat.unread_count === 0) && chat.last_message?.sender_id !== user?.id && chat.last_message && !chat.last_message?.is_read && (
                  <div className="unread-badge" style={{ 
                    background: 'var(--accent)', 
                    color: '#0b141a', 
                    borderRadius: '50%', 
                    padding: '2px 6px', 
                    fontSize: '0.7rem', 
                    fontWeight: 700,
                    minWidth: '20px',
                    textAlign: 'center'
                  }}>
                    1
                  </div>
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

