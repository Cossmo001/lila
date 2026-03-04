import { useState, useEffect } from 'react';
import { MoreVertical, Phone, Video, MessageSquare, ShieldCheck, Laptop, Settings, ChevronLeft, ShieldAlert, Users, MessageCircle, X } from 'lucide-react';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { db } from './lib/firebase';
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
import { useAuth } from './context/AuthContext';
import { useAgora } from './context/AgoraContext';
import { useNotification } from './context/NotificationContext';
import { useChat } from './hooks/useChat';
import FeedbackSection from './components/FeedbackSection';
import { addDoc, serverTimestamp, updateDoc, writeBatch, increment } from 'firebase/firestore';
import './index.css';

function App() {
  const { user, userData, loading } = useAuth();
  const { join, leave } = useAgora();
  const { showToast, playTone, stopTone, sendNativeNotification, syncFCMToken } = useNotification();
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [recipientData, setRecipientData] = useState<any | null>(null);
  const { messages, sendMessage: originalSendMessage, sendMediaMessage, deleteMessage, editMessage } = useChat(activeChat?.id || null, user?.uid || null);
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
  } | null>(null);
  const [showPermissionOverlay, setShowPermissionOverlay] = useState(false);

  // Sync FCM Token and Handle Permission Flow Trigger
  useEffect(() => {
    if (!user) {
      setShowPermissionOverlay(false);
      return;
    }

    // Check if permissions have been handled for this user
    const handled = localStorage.getItem(`permissions_handled_${user.uid}`);
    if (!handled) {
      setShowPermissionOverlay(true);
    } else {
      syncFCMToken();
    }
  }, [user?.uid, syncFCMToken]);

  // Listen to total unread chats count
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const count = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.lastMessage?.senderId !== user.uid && data.lastMessage?.read === false;
      }).length;
      setUnreadChatsCount(count);
    });
    return unsubscribe;
  }, [user]);

  // Global New Message Listener for Notifications
  useEffect(() => {
    if (!user) return;

    // Listen to messages across all chats participant is in
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const chatData = change.doc.data();
          const lastMsg = chatData.lastMessage;

          // Only notify if:
          // 1. Message is incoming (not from current user)
          // 2. Message is new (based on timestamp or a transient "notified" flag we could track locally, but for now we check read status)
          // 3. User is NOT currently in this active chat
          // 4. Chat is NOT muted
          
          if (
            lastMsg && 
            lastMsg.senderId !== user.uid && 
            lastMsg.read === false &&
            activeChat?.id !== change.doc.id &&
            !userData?.settings?.muted?.[lastMsg.senderId] &&
            !userData?.blockedUsers?.[lastMsg.senderId]
          ) {
            // Play Tone if enabled
            if (userData?.settings?.notifications?.tones !== false) {
              playTone('incoming');
            }

            // Show Toast if Priority is enabled
            if (userData?.settings?.notifications?.priority !== false) {
              showToast({
                type: 'message',
                title: lastMsg.senderName || 'New Message',
                message: lastMsg.text || 'Sent an attachment',
                avatarUrl: lastMsg.senderAvatar
              });
            }

            // Show Native notification if browser/tab is hidden
            if (userData?.settings?.notifications?.desktop !== false) {
              sendNativeNotification(lastMsg.senderName || 'New Message', {
                body: lastMsg.text || 'Sent an attachment',
                icon: lastMsg.senderAvatar || '/pwa-192x192.png'
              });
            }
          }
        }
      });
    });

    return unsubscribe;
  }, [user, activeChat?.id, userData?.settings, playTone, showToast]);

  // Listen to recipient's presence and profile info
  useEffect(() => {
    if (!activeChat?.recipient?.uid) {
      setRecipientData(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', activeChat.recipient.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setRecipientData({
          uid: doc.id,
          ...data
        });
      }
    });

    return unsub;
  }, [activeChat]);

  // Call Signaling Listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'calls'),
      where('recipientId', '==', user.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty && !activeCall) {
        const callDoc = snapshot.docs[0];
        const data = callDoc.data();
        
        // Block check
        if (userData?.blockedUsers?.[data.callerId]) {
          console.log("Blocking incoming call from blocked user:", data.callerId);
          return;
        }

        setActiveCall({
          id: callDoc.id,
          status: 'ringing',
          type: data.type,
          recipient: data.caller,
          isIncoming: true
        });

        // Trigger Call Notification
        if (userData?.settings?.notifications?.tones !== false) {
          playTone('call', true);
        }

        if (userData?.settings?.notifications?.priority !== false) {
          showToast({
            type: 'call',
            title: `Incoming ${data.type} Call`,
            message: `${data.caller.username} is calling you...`,
            avatarUrl: data.caller.avatarUrl,
            duration: 0 // Keep till action
          });
        }

        if (userData?.settings?.notifications?.desktop !== false) {
          sendNativeNotification(`Incoming ${data.type} Call`, {
            body: `${data.caller.username} is calling you...`,
            icon: data.caller.avatarUrl || '/pwa-192x192.png',
            tag: 'incoming-call',
            requireInteraction: true
          });
        }
      }
    });

    return unsubscribe;
  }, [user, activeCall, playTone, userData?.settings]);

  // Listen for active call status changes
  useEffect(() => {
    if (!activeCall?.id) return;
    const unsub = onSnapshot(doc(db, 'calls', activeCall.id), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.status === 'ended') {
          console.log('Call ended from remote/status change');
          stopTone('call');
          leave();
          setActiveCall(null);
        } else if (data.status === 'active' && activeCall.status !== 'active') {
          console.log('Call joined...', { id: activeCall.id, type: activeCall.type });
          stopTone('call');
          join(activeCall.id, activeCall.type);
          setActiveCall(prev => prev ? { ...prev, status: 'active' } : null);
        }
      } else {
        console.log('Call document deleted');
        stopTone('call');
        leave();
        setActiveCall(null);
      }
    });
    return () => {
      unsub();
      // Only call leave if we had an active call that wasn't already ended
      // This is a safety cleanup for unmounting
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
  };

  const initiateCall = async (type: 'audio' | 'video') => {
    console.log('Initiating call...', { type, user: !!user, recipientData: !!recipientData, userData: !!userData });
    if (!user || !recipientData) {
      console.warn('Call initiation aborted: missing user or recipientData');
      return;
    }
    
    try {
      const callData = {
        callerId: user.uid,
        recipientId: recipientData.uid,
        participants: [user.uid, recipientData.uid],
        recipientName: recipientData.username,
        status: 'ringing',
        type,
        caller: {
          username: userData.username,
          avatarUrl: userData.avatarUrl || null,
          uid: user.uid
        },
        createdAt: serverTimestamp()
      };

      console.log('Adding call document to Firestore...', callData);
      const docRef = await addDoc(collection(db, 'calls'), callData);
      console.log('Call document added with ID:', docRef.id);
      
      // Log call in chat history
      const chatId = activeChat?.id || [user.uid, recipientData.uid].sort().join('_');
      const chatRef = doc(db, 'chats', chatId);
      const callMsgText = type === 'audio' ? 'Voice call' : 'Video call';
      
      const messageData = {
        text: callMsgText,
        type: 'call',
        senderId: user.uid,
        senderName: userData.username,
        timestamp: serverTimestamp(),
        read: false,
        delivered: false,
      };

      // Add to messages subcollection
      await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);

      // Update chat lastMessage and unreadCount
      await writeBatch(db).update(chatRef, {
        lastMessage: {
          text: callMsgText,
          senderId: user.uid,
          senderName: userData.username,
          read: false,
          delivered: false,
          type: 'call'
        },
        updatedAt: serverTimestamp(),
        unreadCount: increment(1)
      }).commit();

      setActiveCall({
        id: docRef.id,
        status: 'ringing',
        type,
        recipient: recipientData,
        isIncoming: false
      });
    } catch (error) {
      console.error('Failed to initiate call:', error);
      alert('Failed to start call. Please check your connection or Firebase permissions.');
    }
  };

  const acceptCall = async () => {
    if (activeCall) {
      stopTone('call');
      await updateDoc(doc(db, 'calls', activeCall.id), { status: 'active' });
      setActiveCall(prev => prev ? { ...prev, status: 'active' } : null);
    }
  };

  const endCall = async () => {
    if (activeCall) {
      stopTone('call');
      try {
        await updateDoc(doc(db, 'calls', activeCall.id), { status: 'ended' });
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
                    <div className="avatar" style={{ background: activeChat.isGroup ? 'var(--accent-purple)' : 'var(--accent-blue)' }}>
                      {activeChat.isGroup ? (
                        activeChat.groupMetadata?.photoURL ? (
                          <img src={activeChat.groupMetadata.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : <Users size={20} />
                      ) : (
                        recipientData?.avatarUrl ? (
                          <img src={recipientData.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          recipientData?.username?.[0]?.toUpperCase() || '?'
                        )
                      )}
                    </div>
                    <div className="header-info">
                      <h1 style={{ fontSize: '1rem', fontWeight: 600 }}>
                        {activeChat.isGroup ? activeChat.groupMetadata?.name : (userData?.contacts?.[recipientData?.uid]?.alias || recipientData?.username || 'Unknown')}
                      </h1>
                      <p style={{ fontSize: '0.75rem', color: (activeChat.isGroup || recipientData?.isOnline) ? 'var(--accent)' : 'var(--text-secondary)' }}>
                        {activeChat.isGroup ? `${activeChat.participants.length} members` : (recipientData?.isOnline ? 'online' : formatLastSeen(recipientData?.lastSeen))}
                      </p>
                    </div>
                  </div>
                  <div className="header-actions">
                    {!activeChat.isGroup && (
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
                />
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
        activeChat.isGroup ? (
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
          onEndCall={endCall}
          onAccept={acceptCall}
        />
      )}

      {showPermissionOverlay && (
        <PermissionRequestOverlay 
          onComplete={() => {
            setShowPermissionOverlay(false);
            if (user) {
              localStorage.setItem(`permissions_handled_${user.uid}`, 'true');
              syncFCMToken();
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
    </div>
  );
}

export default App;
