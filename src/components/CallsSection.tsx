import React, { useEffect, useState } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from 'lucide-react';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

interface CallLog {
  id: string;
  callerId: string;
  recipientId: string;
  participants: string[];
  status: string;
  type: 'audio' | 'video';
  caller: {
    username: string;
    avatarUrl?: string | null;
    uid: string;
  };
  recipientName?: string;
  createdAt: any;
}

interface CallsSectionProps {
  onInitiateCall?: (recipient: any, type: 'audio' | 'video') => void;
}

const CallsSection: React.FC<CallsSectionProps> = ({ onInitiateCall }) => {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch calls where user is either caller or recipient
    const q = query(
      collection(db, 'calls'),
      where('participants', 'array-contains', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CallLog[];
      setCalls(logs);
      setLoading(false);
    }, (error) => {
      console.error("Calls listener error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const getCallType = (call: CallLog) => {
    if (call.callerId === user?.uid) return 'outgoing';
    if (call.status === 'ringing') return 'missed';
    return 'incoming';
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'incoming': return <PhoneIncoming size={16} color="var(--accent)" />;
      case 'outgoing': return <PhoneOutgoing size={16} color="var(--accent)" />;
      default: return <PhoneMissed size={16} color="#ea0038" />;
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="section-container fade-in">
        <header className="section-header"><h1>Calls</h1></header>
        <div className="section-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '40px' }}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container fade-in">
      <header className="section-header">
        <h1>Calls</h1>
      </header>
      
      <div className="section-content">
        <div className="section-title">RECENT</div>
        <div className="calls-list">
          {calls.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No recent calls
            </div>
          ) : (
            calls.map(call => {
              const type = getCallType(call);
              const displayName = type === 'outgoing' ? (call as any).recipientName || 'Contact' : call.caller.username;
              const avatar = type === 'outgoing' ? null : call.caller.avatarUrl;

              return (
                <div key={call.id} className="chat-item">
                  <div className="avatar" style={{ background: 'var(--bg-active)' }}>
                    {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : displayName[0]}
                  </div>
                  <div className="chat-info">
                    <div className="chat-top">
                      <span className="chat-name">{displayName}</span>
                    </div>
                    <div className="chat-bottom">
                      {getIcon(type)}
                      <span className="chat-time" style={{ marginLeft: '4px' }}>{formatTime(call.createdAt)}</span>
                    </div>
                  </div>
                  <div className="call-action" onClick={() => onInitiateCall?.(type === 'outgoing' ? { uid: call.recipientId, username: displayName } : call.caller, call.type)}>
                    {call.type === 'video' ? <Video size={20} color="var(--accent)" /> : <Phone size={20} color="var(--accent)" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default CallsSection;
