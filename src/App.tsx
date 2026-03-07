import { useState, useEffect } from 'react';
import { MoreVertical, Phone, Video, MessageSquare, ShieldCheck, Laptop, Settings, ChevronLeft, ShieldAlert, Users, MessageCircle, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import Sidebar from './components/Sidebar';
import NavRail from './components/NavRail';
import SettingsSection from './components/SettingsSection';
import CallsSection from './components/CallsSection';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ContactProfileModal from './components/ContactProfileModal';
import CallOverlay from './components/CallOverlay';
import GroupInfoModal from './components/GroupInfoModal';
import AdminPortal from './components/AdminPortal';
import PermissionRequestOverlay from './components/PermissionRequestOverlay';
import MediaPreview from './components/MediaPreview';
import MediaViewer from './components/MediaViewer';
import { useAuth } from './context/AuthContext';
import { useAgora } from './context/AgoraContext';
import { useNotification } from './context/NotificationContext';
import { useChat } from './hooks/useChat';
import FeedbackSection from './components/FeedbackSection';
import './index.css';

const PERMISSION_VERSION = "1.1"; // Increment this to force all users to re-request permissions

function App() {
  const { user, userData, loading } = useAuth();
  const { join, leave } = useAgora();
  const { showToast, playTone, stopTone, sendNativeNotification, syncFCMToken, syncOneSignalId, sendOneSignalNotification, refreshNotifications } = useNotification();
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [recipientData, setRecipientData] = useState<any | null>(null);
  const { messages, sendMessage: originalSendMessage, sendMediaMessage, deleteMessage, editMessage } = useChat(activeChat?.id || null, user?.id || null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentView, setCurrentView] = useState<'chats' | 'calls' | 'settings' | 'admin' | 'feedback'>('chats');
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [activeCall, setActiveCall] = useState<{
    id: string;
    status: 'ringing' | 'connecting' | 'active';
    type: 'audio' | 'video';
    recipient: any;
    isIncoming: boolean;
    isMinimized?: boolean;
  } | null>(null);
  const [showPermissionOverlay, setShowPermissionOverlay] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ file: File, type: 'image' | 'video' | 'audio' | 'file' }[] | null>(null);
  const [activeMedia, setActiveMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Sync FCM Token and Handle Permission Flow Trigger
  useEffect(() => {
    if (!user) {
      setShowPermissionOverlay(false);
      return;
    }

    // Apply theme to document body for global CSS variable scoping
    const theme = userData?.settings?.theme || 'dark';
    document.body.setAttribute('data-theme', theme);

    // Auto-refresh permissions if version changed (runs once per update per user)
    const versionKey = `last_permission_version_${user.id}`;
    const lastVersion = localStorage.getItem(versionKey);
    if (lastVersion !== PERMISSION_VERSION) {
      localStorage.removeItem(`permissions_handled_${user.id}`);
      localStorage.setItem(versionKey, PERMISSION_VERSION);
    }

    // Check if permissions have been handled for this user
    const handled = localStorage.getItem(`permissions_handled_${user.id}`);
    if (!handled) {
      setShowPermissionOverlay(true);
    } else {
      syncFCMToken();
      syncOneSignalId();
    }
  }, [user?.id, userData?.settings?.theme, syncFCMToken, syncOneSignalId, refreshNotifications]);

  // Listen to total unread chats count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      const { data, error } = await supabase
        .from('chat_participants')
        .select(`
          unread_count
        `)
        .eq('user_id', user.id);

      if (!error && data) {
        const total = data.reduce((acc: number, curr: any) => acc + (curr.unread_count || 0), 0);
        setUnreadChatsCount(total);
      }
    };

    fetchUnreadCount();

    // Subscribe to changes in participants for this user
    const channel = supabase
      .channel(`unread_count_${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Global New Message Listener for Notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, async (payload) => {
        const newMsg = payload.new;
        
        // 1. Is it for a chat I am in? (Check participant)
        const { data: participant } = await supabase
          .from('chat_participants')
          .select('id')
          .eq('chat_id', newMsg.chat_id)
          .eq('user_id', user.id)
          .single();

        if (!participant) return;

        // 2. Is it from me?
        if (newMsg.sender_id === user.id) return;

        // 3. Is it the active chat?
        if (activeChat?.id === newMsg.chat_id) return;

        // 4. Fetch sender info for notification
        const { data: sender } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', newMsg.sender_id)
          .single();

        // 5. Check if muted or blocked
        if (userData?.settings?.muted?.[newMsg.sender_id] || userData?.blockedUsers?.[newMsg.sender_id]) return;

        // Tone
        if (userData?.settings?.notifications?.tones !== false) {
          playTone('incoming');
        }

        // Toast
        if (userData?.settings?.notifications?.priority !== false) {
          showToast({
            type: 'message',
            title: sender?.username || 'New Message',
            message: newMsg.text || 'Sent an attachment',
            avatarUrl: sender?.avatar_url
          });
        }

        // Native
        if (userData?.settings?.notifications?.desktop !== false) {
          sendNativeNotification(sender?.username || 'New Message', {
            body: newMsg.text || 'Sent an attachment',
            icon: sender?.avatar_url || '/pwa-192x192.png',
            data: { chatId: newMsg.chat_id }
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeChat?.id, userData?.settings, playTone, showToast]);

  // Listen to recipient's presence and profile info
  useEffect(() => {
    if (!activeChat?.recipient?.id) {
      setRecipientData(null);
      return;
    }

    const fetchRecipient = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', activeChat.recipient.id)
        .single();
      
      if (!error && data) {
        setRecipientData(data);
      }
    };

    fetchRecipient();

    const channel = supabase
      .channel(`recipient_presence_${activeChat.recipient.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${activeChat.recipient.id}`
      }, (payload) => {
        setRecipientData(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat?.recipient?.id]);

  // Call Signaling Listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('incoming_calls')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'calls',
        filter: `recipient_id=eq.${user.id}`
      }, async (payload) => {
        const data = payload.new;
        if (data.status === 'ringing' && !activeCall) {
          // Block check
          if (userData?.blockedUsers?.[data.caller_id]) return;

          // Fetch caller data
          const { data: callerProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.caller_id)
            .single();

          setActiveCall({
            id: data.id,
            status: 'ringing',
            type: data.type,
            recipient: callerProfile,
            isIncoming: true,
            isMinimized: false
          });

          if (userData?.settings?.notifications?.tones !== false) {
            playTone('call', true);
          }

          if (userData?.settings?.notifications?.priority !== false) {
            showToast({
              type: 'call',
              title: `Incoming ${data.type} Call`,
              message: `${callerProfile?.username || 'Someone'} is calling you...`,
              avatarUrl: callerProfile?.avatar_url,
              duration: 0
            });
          }

          if (userData?.settings?.notifications?.desktop !== false) {
            sendNativeNotification(`Incoming ${data.type} Call`, {
              body: `${callerProfile?.username || 'Someone'} is calling you...`,
              icon: callerProfile?.avatar_url || '/pwa-192x192.png',
              tag: 'incoming-call',
              requireInteraction: true
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeCall, playTone, userData?.settings, userData?.blockedUsers]);

  // Listen for active call status changes
  useEffect(() => {
    if (!activeCall?.id) return;

    const channel = supabase
      .channel(`call_status_${activeCall.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${activeCall.id}`
      }, (payload) => {
        const data = payload.new;
        if (data.status === 'ended') {
          stopTone('call');
          leave();
          setActiveCall(null);
        } else if (data.status === 'active' && activeCall.status !== 'active') {
          stopTone('call');
          join(activeCall.id, activeCall.type);
          setActiveCall(prev => prev ? { ...prev, status: 'active' } : null);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${activeCall.id}`
      }, () => {
        stopTone('call');
        leave();
        setActiveCall(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCall?.id, join, leave]);

  const sendMessage = async (text: string) => {
    if (editingMessage) {
      await editMessage(editingMessage.id, text);
      setEditingMessage(null);
    } else {
      const replyData = replyingTo ? {
        messageId: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderName
      } : undefined;
      
      await originalSendMessage(text, 'text', undefined, replyData);
      setReplyingTo(null);
    }
    
    if (userData?.settings?.notifications?.tones !== false) {
      playTone('outgoing');
    }

    // Trigger OneSignal Background Notification
    if (recipientData?.oneSignalId) {
      sendOneSignalNotification(
        recipientData.oneSignalId,
        userData.username || 'New Message',
        text || 'Sent an attachment',
        { chatId: activeChat?.id }
      );
    }
  };

  const initiateCall = async (type: 'audio' | 'video') => {
    if (!user || !recipientData) return;
    
    try {
      // 1. Create call record
      const { data: callData, error: callError } = await supabase
        .from('calls')
        .insert({
          caller_id: user.id,
          recipient_id: recipientData.id,
          status: 'ringing',
          type
        })
        .select()
        .single();

      if (callError) throw callError;

      // 2. Log call in chat history as a message
      const chatId = activeChat?.id || null;
      if (chatId) {
        const callMsgText = type === 'audio' ? 'Voice call' : 'Video call';
        await supabase
          .from('messages')
          .insert({
            chat_id: chatId,
            sender_id: user.id,
            text: callMsgText,
            type: 'call'
          });
      }

      setActiveCall({
        id: callData.id,
        status: 'ringing',
        type,
        recipient: recipientData,
        isIncoming: false,
        isMinimized: false
      });
    } catch (error) {
      console.error('Failed to initiate call:', error);
      alert('Failed to start call. Please check your connection.');
    }
  };

  const acceptCall = async () => {
    if (activeCall) {
      stopTone('call');
      await supabase
        .from('calls')
        .update({ status: 'active' })
        .eq('id', activeCall.id);
      setActiveCall(prev => prev ? { ...prev, status: 'active' } : null);
    }
  };

  const endCall = async () => {
    if (activeCall) {
      stopTone('call');
      try {
        await supabase
          .from('calls')
          .update({ status: 'ended' })
          .eq('id', activeCall.id);
      } catch (error) {
        console.error('Error updating call status to ended:', error);
      }
      leave();
      setActiveCall(null);
    }
  };

  if (loading) {
    return <div className="loading-screen">KADI</div>;
  }

  if (!user) {
    return isRegistering ? (
      <Register onToggle={() => setIsRegistering(false)} />
    ) : (
      <Login onToggle={() => setIsRegistering(true)} />
    );
  }

  const formatLastSeen = (lastSeen: any) => {
    if (!lastSeen) return '';
    const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    return `last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderSidebar = () => {
    if (currentView === 'chats') {
      return (
        <Sidebar 
          onSelectChat={(chat) => setActiveChat(chat)} 
          activeChatId={activeChat?.id || null} 
        />
      );
    }
    if (currentView === 'calls') return <CallsSection onInitiateCall={(recipient: any, type: 'audio' | 'video') => {
      setRecipientData(recipient);
      initiateCall(type);
    }} />;
    if (currentView === 'settings') return <SettingsSection />;
    if (currentView === 'feedback') return <FeedbackSection />;
    if (currentView === 'admin') return <AdminPortal />;
    return null;
  };

  return (
    <div className={`main-layout ${activeChat ? 'chat-active' : ''} ${currentView !== 'chats' ? 'sidebar-hidden' : ''}`} data-theme={userData?.settings?.theme || 'dark'}>
      <NavRail activeView={currentView} onSetActiveView={setCurrentView} unreadCount={unreadChatsCount} />
      
      {renderSidebar()}

      <div className="chat-main-container">
        <div className="chat-area">
          {currentView === 'chats' ? (
            activeChat ? (
              <>
                <header className="chat-header">
                  <div className="mobile-back" onClick={() => setActiveChat(null)}>
                    <ChevronLeft size={24} />
                  </div>
                  <div className="header-left" onClick={() => setShowProfileModal(!showProfileModal)} style={{ cursor: 'pointer' }}>
                    <div className="avatar" style={{ background: activeChat.is_group ? 'var(--accent-purple)' : 'var(--accent-blue)' }}>
                      {activeChat.is_group ? (
                        activeChat.icon_url ? (
                          <img src={activeChat.icon_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : <Users size={20} />
                      ) : (
                        recipientData?.avatar_url ? (
                          <img src={recipientData.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          recipientData?.username?.[0]?.toUpperCase() || '?'
                        )
                      )}
                    </div>
                    <div className="header-info">
                      <h1 style={{ fontSize: '1rem', fontWeight: 600 }}>
                        {activeChat.is_group ? activeChat.name : (userData?.contacts?.[recipientData?.id]?.alias || recipientData?.username || 'Unknown')}
                      </h1>
                      <p style={{ fontSize: '0.75rem', color: (activeChat.is_group || recipientData?.status === 'online') ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        {activeChat.is_group ? `${activeChat.participants?.length || 0} members` : (recipientData?.status === 'online' ? 'online' : formatLastSeen(recipientData?.last_seen))}
                      </p>
                    </div>
                  </div>
                  <div className="header-actions">
                    {!activeChat.is_group && (
                      <>
                        <button className="action-btn" onClick={() => initiateCall('video')}><Video size={20} /></button>
                        <button className="action-btn" onClick={() => initiateCall('audio')}><Phone size={20} /></button>
                      </>
                    )}
                    <div className="divider" style={{ width: '1px', height: '20px', background: 'var(--glass-border)', margin: '0 8px' }}></div>
                    <button className="action-btn" onClick={() => setActiveChat(null)} title="Close Chat"><X size={20} /></button>
                    <button className="action-btn"><MoreVertical size={20} /></button>
                  </div>
                </header>
                
                <MessageList 
                  messages={messages} 
                  wallpaper={userData?.settings?.chats?.wallpaper} 
                  onDeleteMessage={deleteMessage}
                  onReplyMessage={(msg) => setReplyingTo(msg)}
                  onEditMessage={(msg) => setEditingMessage(msg)}
                  onMediaClick={setActiveMedia}
                />
                
                <ChatInput 
                  onSendMessage={sendMessage} 
                  onSendMedia={sendMediaMessage} 
                  replyingTo={replyingTo}
                  editingMessage={editingMessage}
                  onCancelAction={() => {
                    setReplyingTo(null);
                    setEditingMessage(null);
                  }}
                  onMediaSelected={setPendingMedia}
                  isUploadingExternal={isUploadingMedia}
                />
                {pendingMedia && pendingMedia.length > 0 && (
                  <MediaPreview 
                    media={pendingMedia} 
                    onClose={() => setPendingMedia(null)} 
                    onAddMedia={(newMedia) => setPendingMedia(prev => prev ? [...prev, ...newMedia] : newMedia)}
                    onUpdateMedia={(index, updatedMedia) => {
                      setPendingMedia(prev => {
                        if (!prev) return null;
                        const newArray = [...prev];
                        newArray[index] = updatedMedia;
                        return newArray;
                      });
                    }}
                    onSend={async (mediaItems) => {
                      setIsUploadingMedia(true);
                      try {
                        for (const item of mediaItems) {
                          await sendMediaMessage(item.file, item.type, item.caption);
                        }
                      } finally {
                        setIsUploadingMedia(false);
                        setPendingMedia(null);
                      }
                    }}
                  />
                )}
              </>
            ) : (
              <div className="empty-state-container">
                <div className="empty-content">
                  <div className="welcome-icon">
                    <MessageSquare size={80} strokeWidth={1} />
                  </div>
                  <h1>Kadi Chat for Windows</h1>
                  <p>Send and receive messages without keeping your phone online.<br/>Use Kadi Chat on up to 4 linked devices and 1 phone at the same time.</p>
                  
                  <div className="encryption-notice">
                    <ShieldCheck size={14} />
                    <span>End-to-end encrypted</span>
                  </div>
                </div>
                <div className="empty-footer">
                  <Laptop size={16} />
                  <span>Kadi Desktop App</span>
                </div>
              </div>
            )
          ) : (
            <div className="empty-state-container">
              {/* Common background for non-chat views if no item is selected */}
              <div className="empty-content">
                 <div className="welcome-icon">
                  {currentView === 'calls' ? <Phone size={80} strokeWidth={1} /> : 
                   currentView === 'settings' ? <Settings size={80} strokeWidth={1} /> :
                   <ShieldAlert size={80} strokeWidth={1} />}
                </div>
                <h1 style={{ textTransform: 'capitalize' }}>{currentView}</h1>
                <p>Selection will appear here.</p>
              </div>
            </div>
          )}
        </div>

        {showProfileModal && activeChat && (
        activeChat.is_group ? (
          <GroupInfoModal 
            group={activeChat} 
            onClose={() => setShowProfileModal(false)} 
          />
        ) : recipientData && (
          <ContactProfileModal 
            contact={recipientData} 
            chatId={activeChat.id}
            onClose={() => setShowProfileModal(false)} 
          />
        )
      )}
      </div>

      {activeCall && (
        <CallOverlay 
          status={activeCall.status}
          type={activeCall.type}
          recipient={activeCall.recipient}
          isIncoming={activeCall.isIncoming}
          isMinimized={activeCall.isMinimized}
          onEndCall={endCall}
          onAccept={acceptCall}
          onMinimize={() => setActiveCall(prev => prev ? { ...prev, isMinimized: true } : null)}
          onRestore={() => setActiveCall(prev => prev ? { ...prev, isMinimized: false } : null)}
        />
      )}

      {showPermissionOverlay && (
        <PermissionRequestOverlay 
          onComplete={() => {
            setShowPermissionOverlay(false);
            if (user) {
              localStorage.setItem(`permissions_handled_${user.id}`, 'true');
              syncFCMToken();
              syncOneSignalId(); // Immediately sync OneSignal after permissions are handled
            }
          }} 
        />
      )}

      {/* Floating Feedback Button for Mobile */}
      <div className="mobile-fab-container feedback-fab-wrapper">
        <button 
          className="mobile-fab feedback-fab" 
          onClick={() => setCurrentView('feedback')}
          title="Send Feedback"
        >
          <MessageCircle size={24} />
        </button>
        <span className="fab-label">Feedback</span>
      </div>

      {activeMedia && (
        <MediaViewer 
          url={activeMedia.url} 
          type={activeMedia.type} 
          onClose={() => setActiveMedia(null)} 
        />
      )}
    </div>
  );
}

export default App;
