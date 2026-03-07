import React, { useState, useEffect } from 'react';
import { X, UserMinus, LogOut, Trash2, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useRef } from 'react';

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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('chat_participants')
      .select(`
        user:profiles (*),
        role
      `)
      .eq('chat_id', group.id);

    if (!error && data) {
      // Cast to any because Supabase join inference can sometimes treat 'user' as any[] in generic contexts
      setMembers(data.map((m: any) => ({ ...m.user, role: m.role })));
      const me = data.find((m: any) => m.user.id === user?.id);
      setCurrentUserRole(me?.role || null);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [group.id]);

  const isAdmin = currentUserRole === 'admin' || group.created_by === user?.id;

  const handleAddMember = async (newMember: any) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from('chat_participants')
        .insert({
          chat_id: group.id,
          user_id: newMember.id,
          role: 'member'
        });

      if (error) throw error;

      await fetchMembers();
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchTerm.trim()}%`)
        .limit(10);
      
      if (error) throw error;

      const existingMemberIds = members.map(m => m.id);
      const results = data.filter(u => !existingMemberIds.includes(u.id));
        
      setSearchResults(results || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin || memberId === user?.id) return;
    try {
      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', group.id)
        .eq('user_id', memberId);

      if (error) throw error;

      await fetchMembers();
      alert('Member removed successfully');
    } catch (err) {
      console.error("Error removing member:", err);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    if (confirm('Are you sure you want to leave this group?')) {
      try {
        const { error } = await supabase
          .from('chat_participants')
          .delete()
          .eq('chat_id', group.id)
          .eq('user_id', user.id);

        if (error) throw error;
        onClose();
      } catch (err) {
        console.error("Error leaving group:", err);
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `groups/${group.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('chats')
        .update({ icon_url: publicUrl })
        .eq('id', group.id);

      if (updateError) throw updateError;
      
      alert('Group icon updated');
    } catch (err: any) {
      console.error("Upload group icon error:", err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="profile-modal">
      <header className="modal-header whatsapp-style">
        <button className="close-btn" onClick={onClose}><X size={24} /></button>
        <h2>Group info</h2>
      </header>

      <div className="profile-scroll-v3">
        <section className="wa-section wa-hero">
          <div 
            className={`wa-avatar-container ${isAdmin ? 'editable' : ''}`}
            onClick={() => isAdmin && fileInputRef.current?.click()}
            style={{ cursor: isAdmin ? 'pointer' : 'default', position: 'relative' }}
          >
            {isUploading ? (
              <div className="upload-spinner" />
            ) : group.icon_url ? (
              <img src={group.icon_url} alt={group.name} />
            ) : (
              <div className="avatar-fallback" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-blue)', color: 'white', fontSize: '5rem', fontWeight: 600, width: '100%', height: '100%', borderRadius: '50%' }}>
                {group.name?.[0]?.toUpperCase() || 'G'}
              </div>
            )}
            {isAdmin && !isUploading && (
              <div className="avatar-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', borderRadius: '50%' }}>
                <Camera size={24} color="white" />
              </div>
            )}
          </div>
          {isAdmin && (
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              style={{ display: 'none' }} 
            />
          )}
          <h1>{group.name}</h1>
          <p className="wa-phone">Group • {members.length} members</p>
        </section>

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
                <div key={result.id} className="member-item" style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px dotted var(--glass-border)' }}>
                    <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '12px', marginRight: '8px' }}>
                      {result.avatar_url ? <img src={result.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : result.username[0].toUpperCase()}
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
              <div key={member.id} className="member-item" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--glass-border)' }}>
                <div className="avatar" style={{ marginRight: '12px', overflow: 'hidden' }}>
                  {member.avatar_url ? <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (member.username?.[0]?.toUpperCase() || '?')}
                </div>
                <div className="member-info" style={{ flex: 1 }}>
                  <div className="member-name" style={{ fontWeight: 500 }}>
                    {member.username} {member.id === user?.id && '(You)'}
                  </div>
                  {member.role === 'admin' && (
                    <div className="admin-badge" style={{ fontSize: '0.7rem', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '1px 4px', display: 'inline-block', marginTop: '2px' }}>
                      Group Admin
                    </div>
                  )}
                </div>
                {isAdmin && member.id !== user?.id && (
                  <button 
                    onClick={() => handleRemoveMember(member.id)}
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

        <section className="wa-section" style={{ marginTop: '20px', paddingBottom: '20px' }}>
          <div 
            className="wa-danger-item" 
            style={{ padding: '16px 30px', cursor: 'pointer', color: '#ff4b4b', display: 'flex', alignItems: 'center', gap: '12px' }}
            onClick={handleLeaveGroup}
          >
            <LogOut size={20} />
            <span style={{ fontWeight: 500 }}>Leave Group</span>
          </div>
          {isAdmin && (
            <div 
              className="wa-danger-item" 
              style={{ padding: '16px 30px', cursor: 'pointer', color: '#ff4b4b', display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <Trash2 size={20} />
              <span style={{ fontWeight: 500 }}>Delete Group</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );

};

export default GroupInfoModal;
