import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  BarChart3, 
  Search, 
  ShieldCheck, 
  CheckCircle,
  XCircle,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AdminStats {
  totalUsers: number;
  totalFeedback: number;
  totalChats: number;
  activeUsers: number;
}

const AdminPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'feedback'>('dashboard');
  const [users, setUsers] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalFeedback: 0,
    totalChats: 0,
    activeUsers: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Initial fetches
        const { data: profilesData, count: uCount } = await supabase.from('profiles').select('*', { count: 'exact' });
        const { data: feedbackData, count: fCount } = await supabase.from('feedback').select('*', { count: 'exact' }).order('created_at', { ascending: false });
        const { count: cCount } = await supabase.from('chats').select('*', { count: 'exact', head: true });

        if (profilesData) {
          setUsers(profilesData);
          setStats(prev => ({ 
            ...prev, 
            totalUsers: uCount || 0,
            activeUsers: profilesData.filter(u => u.status === 'online').length
          }));
        }
        if (feedbackData) {
          setFeedbacks(feedbackData);
          setStats(prev => ({ ...prev, totalFeedback: fCount || 0 }));
        }
        setStats(prev => ({ ...prev, totalChats: cCount || 0 }));

      } catch (err) {
        console.error("Error fetching admin data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up Realtime subscriptions
    const profilesChannel = supabase.channel('admin_profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe();

    const feedbackChannel = supabase.channel('admin_feedback')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => fetchData())
      .subscribe();

    const chatsChannel = supabase.channel('admin_chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(feedbackChannel);
      supabase.removeChannel(chatsChannel);
    };
  }, []);

  const handleUpdateFeedbackStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
       console.error("Error updating feedback status:", err);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this feedback?")) {
      try {
        const { error } = await supabase
          .from('feedback')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (err) {
         console.error("Error deleting feedback:", err);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderDashboard = () => (
    <div className="admin-dashboard fade-in">
      <div className="stats-grid">
        <div className="stat-card premium-glass">
          <div className="stat-icon users"><Users size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Users</span>
            <span className="stat-value">{stats.totalUsers}</span>
          </div>
        </div>
        <div className="stat-card premium-glass">
          <div className="stat-icon online"><ShieldCheck size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Online Now</span>
            <span className="stat-value">{stats.activeUsers}</span>
          </div>
        </div>
        <div className="stat-card premium-glass">
          <div className="stat-icon chats"><MessageSquare size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Total Chats</span>
            <span className="stat-value">{stats.totalChats}</span>
          </div>
        </div>
        <div className="stat-card premium-glass">
          <div className="stat-icon feedback"><BarChart3 size={24} /></div>
          <div className="stat-info">
            <span className="stat-label">Feedback Recv</span>
            <span className="stat-value">{stats.totalFeedback}</span>
          </div>
        </div>
      </div>

      <div className="recent-activity-section">
        <h3>Recent Feedbacks</h3>
        <div className="recent-list">
          {feedbacks.slice(0, 5).map(f => (
            <div key={f.id} className="recent-item premium-glass">
              <div className="user-mini">
                 <div className="avatar-xs">{f.username?.[0]}</div>
                 <span>{f.username}</span>
              </div>
              <p className="msg-preview">{f.message}</p>
              <div className="status-badge" data-status={f.status}>{f.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="admin-users-view fade-in">
      <div className="view-header">
        <div className="search-bar premium-glass">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search users by name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="users-table-container premium-glass">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="user-cell">
                    <div className="avatar-sm">
                      {user.avatar_url ? <img src={user.avatar_url} alt="" /> : user.username?.[0]}
                    </div>
                    <div className="user-meta">
                      <span className="name">{user.username}</span>
                      <span className="email">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status-dot ${user.status === 'online' ? 'online' : 'offline'}`} />
                  {user.status === 'online' ? 'Online' : 'Offline'}
                </td>
                <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                   <button className="icon-btn"><ChevronRight size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFeedback = () => (
    <div className="admin-feedback-view fade-in">
      <div className="feedback-list">
        {feedbacks.map(f => (
          <div key={f.id} className="feedback-card premium-glass">
            <div className="card-header">
              <div className="user-info">
                <span className="user-name">{f.username}</span>
                <span className="user-email">{f.email}</span>
              </div>
              <div className="rating">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={`star ${i < f.rating ? 'filled' : ''}`}>★</span>
                ))}
              </div>
            </div>
            <div className="card-body">
              <div className="category-tag">{f.category}</div>
              <p className="feedback-text">{f.message}</p>
            </div>
            <div className="card-footer">
              <span className="date">{f.created_at ? new Date(f.created_at).toLocaleString() : 'N/A'}</span>
              <div className="actions">
                <button 
                  className="status-btn resolve" 
                  onClick={() => handleUpdateFeedbackStatus(f.id, 'resolved')}
                  title="Mark as Resolved"
                >
                  <CheckCircle size={18} />
                </button>
                <button 
                  className="status-btn dismiss" 
                  onClick={() => handleUpdateFeedbackStatus(f.id, 'dismissed')}
                  title="Dismiss"
                >
                  <XCircle size={18} />
                </button>
                <button 
                  className="status-btn delete" 
                  onClick={() => handleDeleteFeedback(f.id)}
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="admin-portal-layout">
      <header className="admin-header">
        <div className="header-title">
          <ShieldCheck className="admin-icon" size={24} />
          <h1>Admin Portal</h1>
        </div>
        <div className="admin-tabs">
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button 
            className={`tab ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            Feedback {stats.totalFeedback > 0 && <span className="badge">{stats.totalFeedback}</span>}
          </button>
        </div>
      </header>

      <main className="admin-content">
        {loading ? (
          <div className="admin-loading">Loading Management Data...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'feedback' && renderFeedback()}
          </>
        )}
      </main>

      <style>{`
        .admin-portal-layout {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        .admin-header {
          padding: 24px 32px 0;
          border-bottom: 1px solid var(--glass-border);
          background: var(--glass-bg);
          backdrop-filter: blur(10px);
        }
        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        .admin-icon {
          color: var(--accent);
        }
        .header-title h1 {
          font-size: 1.5rem;
          font-weight: 700;
        }
        .admin-tabs {
          display: flex;
          gap: 32px;
        }
        .tab {
          padding: 12px 4px;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-weight: 600;
          cursor: pointer;
          position: relative;
          transition: color 0.2s;
        }
        .tab.active {
          color: var(--accent);
        }
        .tab.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent);
        }
        .badge {
          background: var(--accent);
          color: white;
          font-size: 0.7rem;
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: 4px;
        }
        .admin-content {
          flex: 1;
          overflow-y: auto;
          padding: 32px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .stat-card {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-icon.users { background: rgba(58, 188, 244, 0.1); color: #3abcf4; }
        .stat-icon.online { background: rgba(46, 204, 113, 0.1); color: #2ecc71; }
        .stat-icon.chats { background: rgba(155, 89, 182, 0.1); color: #9b59b6; }
        .stat-icon.feedback { background: rgba(241, 196, 15, 0.1); color: #f1c40f; }
        .stat-label {
          display: block;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
        }
        .recent-activity-section h3 {
          margin-bottom: 16px;
          font-size: 1.1rem;
        }
        .recent-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .recent-item {
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .user-mini {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 120px;
        }
        .avatar-xs {
          width: 24px;
          height: 24px;
          background: var(--accent);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          color: white;
        }
        .msg-preview {
          flex: 1;
          font-size: 0.9rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .status-badge {
          font-size: 0.75rem;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: capitalize;
          background: rgba(255, 255, 255, 0.05);
        }
        .status-badge[data-status='pending'] { color: #f1c40f; background: rgba(241, 196, 15, 0.1); }
        .status-badge[data-status='resolved'] { color: #2ecc71; background: rgba(46, 204, 113, 0.1); }

        .admin-users-view {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          max-width: 400px;
        }
        .search-bar input {
          background: none;
          border: none;
          color: var(--text-primary);
          width: 100%;
          outline: none;
        }
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .admin-table th {
          padding: 16px;
          font-size: 0.85rem;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--glass-border);
        }
        .admin-table td {
          padding: 16px;
          border-bottom: 1px solid var(--glass-border);
        }
        .user-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .user-meta .name { display: block; font-weight: 600; }
        .user-meta .email { display: block; font-size: 0.75rem; color: var(--text-secondary); }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 8px;
        }
        .status-dot.online { background: #2ecc71; box-shadow: 0 0 8px #2ecc71; }
        .status-dot.offline { background: var(--text-secondary); }

        .feedback-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }
        .feedback-card {
           padding: 20px;
           display: flex;
           flex-direction: column;
           gap: 16px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
        }
        .user-name { display: block; font-weight: 600; margin-bottom: 2px; }
        .user-email { display: block; font-size: 0.75rem; color: var(--text-secondary); }
        .rating { color: #f1c40f; }
        .star { opacity: 0.3; }
        .star.filled { opacity: 1; }
        .category-tag {
          display: inline-block;
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 12px;
          background: var(--accent-blue);
          color: white;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .feedback-text {
          font-size: 0.95rem;
          line-height: 1.5;
          color: var(--text-secondary);
        }
        .card-footer {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid var(--glass-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .date { font-size: 0.75rem; color: var(--text-secondary); }
        .actions { display: flex; gap: 8px; }
        .status-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          color: var(--text-secondary);
          transition: all 0.2s;
        }
        .status-btn.resolve:hover { background: rgba(46, 204, 113, 0.1); color: #2ecc71; border-color: #2ecc71; }
        .status-btn.dismiss:hover { background: rgba(231, 76, 60, 0.1); color: #e74c3c; border-color: #e74c3c; }
        .status-btn.delete:hover { background: rgba(231, 76, 60, 0.1); color: #e74c3c; border-color: #e74c3c; }

        .premium-glass {
          background: var(--glass-bg);
          backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
        }
        .avatar-sm, .avatar-xs {
           width: 36px;
           height: 36px;
           background: var(--accent-blue);
           border-radius: 50%;
           display: flex;
           align-items: center;
           justify-content: center;
           color: white;
           overflow: hidden;
        }
        .avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </div>
  );
};

export default AdminPortal;
