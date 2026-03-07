import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';
import PasswordResetTab from './PasswordResetTab';

interface LoginProps {
  onToggle: () => void;
}

const Login: React.FC<LoginProps> = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const { requestNativePermission } = useNotification();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Request notification permissions
      await requestNativePermission();
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'reset') {
    return (
      <div className="auth-container">
        <PasswordResetTab 
          initialEmail={email} 
          onBack={() => setMode('login')} 
          onEmailChange={setEmail}
        />
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card fade-in">
        <div className="flashing-alert">
           ⚠️ <strong>Migration Update:</strong> Please reset your password to access your migrated data on the new platform.
        </div>
        <h1>Welcome Back</h1>
        <p>Login to continue your conversations.</p>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email</label>
            <input 
              type="email" 
              placeholder="email@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <button 
          className="password-reset-btn-link" 
          onClick={() => setMode('reset')}
          disabled={loading}
        >
          Forgot Password? Reset here
        </button>
        <div className="auth-footer">
          Don't have an account? <span onClick={onToggle}>Register</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
