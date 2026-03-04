import React, { useState, useEffect } from 'react';
import { Camera, Mic, Bell, HardDrive, ShieldCheck, ArrowRight } from 'lucide-react';
import { usePermissionManager } from '../hooks/usePermissionManager';

interface PermissionRequestOverlayProps {
  onComplete: () => void;
}

const PermissionRequestOverlay: React.FC<PermissionRequestOverlayProps> = ({ onComplete }) => {
  const { status, checkPermissions, requestAll } = usePermissionManager();
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const handleRequestAll = async () => {
    setIsRequesting(true);
    await requestAll();
    setIsRequesting(false);
    onComplete(); // Dismiss after attempt
  };

  const permissions = [
    {
      id: 'notifications',
      icon: <Bell size={20} />,
      title: 'Notifications',
      desc: 'To keep you updated on new messages and calls.',
      status: status.notifications
    },
    {
      id: 'camera',
      icon: <Camera size={20} />,
      title: 'Camera',
      desc: 'To make video calls and send photos.',
      status: status.camera
    },
    {
      id: 'microphone',
      icon: <Mic size={20} />,
      title: 'Microphone',
      desc: 'To make voice calls and send voice notes.',
      status: status.microphone
    },
    {
      id: 'storage',
      icon: <HardDrive size={20} />,
      title: 'Storage & Media',
      desc: 'To save and send files, photos, and videos.',
      status: status.storage
    }
  ];

  return (
    <div className="permission-overlay">
      <div className="permission-card">
        <div className="permission-icons">
          <div className="permission-icon-wrapper active">
            <ShieldCheck size={32} />
          </div>
        </div>

        <h1>Permission Required</h1>
        <p>To provide the best experience, Kadi needing access to the following features on your device.</p>

        <div className="permission-list">
          {permissions.map((p) => (
            <div key={p.id} className="permission-item">
              <div className="p-icon">{p.icon}</div>
              <div className="p-info">
                <h3>{p.title}</h3>
                <span>{p.desc}</span>
              </div>
              <div className={`p-status ${p.status === 'granted' ? 'granted' : 'pending'}`}>
                {p.status === 'granted' ? 'Allowed' : 'Pending'}
              </div>
            </div>
          ))}
        </div>

        <button 
          className="allow-all-btn" 
          onClick={handleRequestAll}
          disabled={isRequesting}
        >
          {isRequesting ? 'Requesting...' : 'Grant All Permissions'}
          {!isRequesting && <ArrowRight size={20} />}
        </button>

        <span className="skip-text" onClick={onComplete}>
          I'll do it later
        </span>
      </div>
    </div>
  );
};

export default PermissionRequestOverlay;
