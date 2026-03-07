import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotification } from '../../context/NotificationContext';

interface RegisterProps {
  onToggle: () => void;
}

const Register: React.FC<RegisterProps> = ({ onToggle }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { requestNativePermission } = useNotification();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Check if username is taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();
      
      if (existingUser) {
        throw new Error('Username already taken');
      }

      // 2. Sign up the user
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!user) throw new Error('Registration failed');

      // 3. Create the profile (Supabase triggers or direct insert)
      // Since we want to ensure it's created with our custom data:
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: username,
          avatar_url: null,
          status: 'online',
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      // 4. Request notification permissions
      await requestNativePermission();

    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p>Join Kadi Chat and connect with friends.</p>
        <form onSubmit={handleRegister}>
          <div className="input-group">
            <label>Username</label>
            <input 
              type="text" 
              placeholder="unique_username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>
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
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <div className="auth-footer">
          Already have an account? <span onClick={onToggle}>Login</span>
        </div>
      </div>
    </div>
  );
};

export default Register;
