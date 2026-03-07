import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft } from 'lucide-react';

interface PasswordResetTabProps {
  initialEmail: string;
  onBack: () => void;
  onEmailChange: (email: string) => void;
}

const PasswordResetTab: React.FC<PasswordResetTabProps> = ({ initialEmail, onBack, onEmailChange }) => {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [username, setUsername] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-send OTP if email is provided
  useEffect(() => {
    if (initialEmail && step === 'email') {
      handleSendOTP();
    }
  }, []);

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!initialEmail) {
      setError('Please enter your email first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: initialEmail,
        options: {
          shouldCreateUser: false,
        }
      });
      if (error) throw error;
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Error sending code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleStraightReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // 1. Verify OTP (This logs the user in)
      const { data: { session }, error: verifyError } = await supabase.auth.verifyOtp({
        email: initialEmail,
        token,
        type: 'email'
      });
      if (verifyError) throw verifyError;
      
      if (!session) throw new Error("Verification failed. Please try again.");

      // 2. Update Password (Straight update since email confirm is disabled)
      const { error: pwdError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (pwdError) throw pwdError;

      // 3. Update Profile (Upsert to create if missing for migrated users)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          id: session.user.id,
          username,
          updated_at: new Date().toISOString()
        });
      if (profileError) throw profileError;
      
      // Success - Refresh to boot into app
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Verification failed. Check your code or password length.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card reset-tab fade-in">
      <div className="auth-header-with-back">
        <button onClick={onBack} className="back-btn-auth"><ArrowLeft size={20} /></button>
        <h2>Account Recovery</h2>
      </div>
      
      <p className="auth-subtitle">
        {step === 'email' && "Enter your email to receive a secure login code."}
        {step === 'verify' && "Check your email for the code and set your new details below."}
      </p>

      {step === 'email' && (
        <form onSubmit={handleSendOTP}>
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              placeholder="email@example.com"
              value={initialEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              required 
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Sending...' : 'Send Login Code'}
          </button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleStraightReset}>
          <div className="input-group">
            <label>6-Digit Code</label>
            <input 
              type="text" 
              placeholder="123456"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label>New Password</label>
            <input 
              type="password" 
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required 
              minLength={6}
            />
          </div>
          <div className="input-group">
            <label>Confirm Username</label>
            <input 
              type="text" 
              placeholder="DisplayName"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Finalizing...' : 'Update & Login'}
          </button>
          <button type="button" className="text-btn" onClick={() => setStep('email')}>
            Change Email or Resend
          </button>
        </form>
      )}
    </div>
  );
};

export default PasswordResetTab;
