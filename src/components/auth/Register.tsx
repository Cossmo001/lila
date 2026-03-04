import React, { useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
      // Check if username is taken
      try {
        const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
        if (usernameDoc.exists()) {
          throw new Error('Username already taken');
        }
      } catch (checkErr: any) {
        if (checkErr.code === 'permission-denied') {
          console.error("Firestore permission denied on usernames check. Ensure Security Rules allow read access.");
          throw new Error('Registration error: Username check failed due to insufficient permissions. Please contact support.');
        } else if (checkErr.code === 'unavailable') {
          throw new Error('Network error: Firestore is unavailable. Please check your internet connection.');
        }
        throw checkErr;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: username });

      // Save user data
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: username,
        usernameLower: username.toLowerCase(),
        email: email,
        photoURL: null,
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
      });

      // Reserve username
      await setDoc(doc(db, 'usernames', username.toLowerCase()), {
        uid: user.uid
      });

      // Request notification permissions
      await requestNativePermission();

    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === 'auth/network-request-failed' || err.message?.includes('offline')) {
        setError('Network error: Please check your internet connection and try again.');
      } else {
        setError(err.message || 'An unexpected error occurred during registration.');
      }
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
