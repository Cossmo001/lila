import React from 'react';
import { MessageSquare, Phone, Users, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavRailProps {
  activeView: 'chats' | 'calls' | 'settings';
  onSetActiveView: (view: 'chats' | 'calls' | 'settings') => void;
  unreadCount?: number;
}

const NavRail: React.FC<NavRailProps> = ({ activeView, onSetActiveView, unreadCount = 0 }) => {
  const { userData } = useAuth();

  return (
    <nav className="nav-rail">
      <div className="nav-top">
        <div 
          className={`nav-item ${activeView === 'chats' ? 'active' : ''}`} 
          onClick={() => onSetActiveView('chats')}
          title="Chats"
        >
          <MessageSquare size={26} />
          <span className="mobile-label">Chats</span>
          {unreadCount > 0 && <div className="unread-badge">{unreadCount}</div>}
        </div>
        <div 
          className={`nav-item ${activeView === 'calls' ? 'active' : ''}`} 
          onClick={() => onSetActiveView('calls')}
          title="Calls"
        >
          <Phone size={26} />
          <span className="mobile-label">Calls</span>
        </div>
        <div className="nav-item communities-item" title="Groups">
          <Users size={26} />
          <span className="mobile-label">Groups</span>
        </div>
        <div 
          className={`nav-item ${activeView === 'settings' ? 'active' : ''}`} 
          onClick={() => onSetActiveView('settings')}
          title="Settings"
        >
          <Settings size={26} />
          <span className="mobile-label">Settings</span>
        </div>
      </div>
      <div className="nav-bottom">
        <div className="nav-item profile-item" title="Profile">
          <div className="mini-avatar" style={{ width: '28px', height: '28px' }}>
            {userData?.avatarUrl ? (
              <img src={userData.avatarUrl} alt="Me" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              userData?.username?.[0]?.toUpperCase() || 'U'
            )}
          </div>
          <span className="mobile-label">Profile</span>
        </div>
      </div>
    </nav>
  );
};

export default NavRail;
