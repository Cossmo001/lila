import React, { useEffect, useState } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface CallLog {
  id: string;
  caller_id: string;
  recipient_id: string;
  status: string;
  type: 'audio' | 'video';
  caller: {
    username: string;
    avatar_url?: string | null;
    id: string;
  };
  recipient: {
    username: string;
    avatar_url?: string | null;
    id: string;
  };
  created_at: any;
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

    const fetchCalls = async () => {
      const { data, error } = await supabase
        .from('calls')
        .select(`
          *,
          caller:profiles!caller_id(*),
          recipient:profiles!recipient_id(*)
        `)
        .or(`caller_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error("Calls fetch error:", error);
      } else {
        setCalls(data as any[]);
      }
      setLoading(false);
    };

    fetchCalls();

    const channel = supabase.channel('call_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => fetchCalls())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getCallType = (call: CallLog) => {
    if (call.caller_id === user?.id) return 'outgoing';
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
    const date = new Date(timestamp);
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
              const isOutgoing = type === 'outgoing';
              const displayContact = isOutgoing ? call.recipient : call.caller;
              const displayName = displayContact?.username || 'Unknown';
              const avatar = displayContact?.avatar_url;

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
                      <span className="chat-time" style={{ marginLeft: '4px' }}>{formatTime(call.created_at)}</span>
                    </div>
                  </div>
                  <div className="call-action" onClick={() => onInitiateCall?.(displayContact, call.type)}>
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
